import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Upload, Download, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { toast } from "sonner";
import {
  validateLocationChain, parseLocationDbError, type LocationLevel,
} from "@/lib/locationValidation";

/**
 * Bulk Farmer Import — names-based CSV / Excel
 *
 * Required columns (case-insensitive):
 *   name_en
 * Optional but recommended:
 *   name_bn, father_name, mother_name, nid, mobile, member_no, status,
 *   division, district, upazila, union, ward, village, mouza
 *
 * Locations are resolved from name → ID using existing tables. The same
 * cascading rules as LocationPicker apply: each level must belong to its parent.
 * Rows that fail are highlighted with the EXACT failing level so the user
 * can fix in-place and re-validate before saving.
 */

type Cell = string | number | null;
type RowMap = Record<string, Cell>;

type LocResolved = Partial<Record<
  "division_id" | "district_id" | "upazila_id" | "union_id" | "ward_id" | "village_id" | "mouza_id",
  string | null
>>;

type RowState = {
  idx: number;
  raw: RowMap;
  // Editable copies of the location names so the user can correct in-place.
  loc: {
    division: string; district: string; upazila: string; mouza: string;
  };
  resolved: LocResolved;
  failedLevel: LocationLevel | null;
  errorMsg: string | null;
  status: "pending" | "valid" | "invalid" | "saving" | "saved" | "error";
};

const REQUIRED = ["name_en"];
const ALL_HEADERS = [
  "name_en", "name_bn", "father_name", "mother_name", "nid", "mobile",
  "member_no", "is_voter", "status", "village", "address",
  "division", "district", "upazila", "mouza",
];

// Notes:
// - account_number is auto-generated (not imported).
// - member_no is optional; if provided AND is_voter=true, must be unique.
// - is_voter accepts: true/false/yes/no/1/0 (default false).
// - post_office removed from template.

// We keep the legacy free-text "village" column as-is, and use "village_loc"
// for the cascading hierarchy village name (to avoid colliding with the
// existing free-text village field on the farmers table).

import { decodeSpreadsheetBuffer } from "@/lib/csvDecode";

function readBookFromFile(file: File): Promise<XLSX.WorkBook> {
  // Treat .csv and .txt (Excel "Unicode Text" export, tab-delimited UTF-16) as text.
  const isText = /\.(csv|txt|tsv)$/i.test(file.name) || file.type === "text/csv" || file.type === "text/plain";
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      try {
        if (isText) {
          const text = decodeSpreadsheetBuffer(reader.result as ArrayBuffer);
          // XLSX auto-detects delimiter (comma / tab) when raw text is passed.
          resolve(XLSX.read(text, { type: "string", raw: true }));
        } else {
          resolve(XLSX.read(reader.result as ArrayBuffer, { type: "array" }));
        }
      } catch (e) { reject(e); }
    };
    reader.readAsArrayBuffer(file);
  });
}

function normalizeKey(k: string) {
  return k.trim().toLowerCase().replace(/\s+/g, "_");
}

function parseSheet(wb: XLSX.WorkBook): RowMap[] {
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
  return json.map((r) => {
    const out: RowMap = {};
    for (const k of Object.keys(r)) {
      const v = r[k];
      out[normalizeKey(k)] = v === "" ? null : (typeof v === "string" ? v.trim() : v);
    }
    return out;
  });
}

export default function FarmersImport() {
  const { t } = useLang();
  const { isAdmin, officeId, rolesLoaded } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<RowState[]>([]);
  const [resolving, setResolving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  useEffect(() => {
    document.title = `Bulk Farmer Import — ${t("appName")}`;
  }, [t]);

  function levelLabel(l: LocationLevel) {
    const map: Record<LocationLevel, string> = {
      division: t("division"), district: t("district"), upazila: t("upazila"),
      union: t("union"), ward: t("ward"), village: t("village"), mouza: t("mouza"),
    };
    return map[l];
  }

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
      ALL_HEADERS,
      [
        "Md. Abdur Rahman", "মোঃ আব্দুর রহমান", "Md. Karim Uddin", "Mst. Salma Begum",
        "1234567890123", "01711000000", "", "true", "active",
        "Bagbari (free text)", "Holding 12, Road 3",
        "Rajshahi", "Chapainawabganj", "Chapainawabganj Sadar", "Mouza A",
      ],
      [
        "Mst. Rahima Khatun", "মোসাঃ রহিমা খাতুন", "Md. Jashim Uddin", "Mst. Khaleda",
        "9876543210987", "01811000000", "", "false", "active",
        "", "",
        "Rajshahi", "Chapainawabganj", "Shibganj", "Mouza B",
      ],
    ]);
    // Add a notes sheet so users know which columns are required.
    const notes = XLSX.utils.aoa_to_sheet([
      ["Column", "Required", "Notes"],
      ["name_en", "Yes", "Farmer name in English"],
      ["name_bn", "No", "Farmer name in Bangla"],
      ["father_name", "No", ""],
      ["mother_name", "No", ""],
      ["nid", "No", "10 / 13 / 17 digits"],
      ["mobile", "No", "11-digit BD number, e.g. 017XXXXXXXX"],
      ["member_no", "No", "Required only if is_voter=true"],
      ["is_voter", "No", "true / false (default false)"],
      ["status", "No", "active / inactive (default active)"],
      ["village", "No", "Free-text village (legacy)"],
      ["address", "No", "Holding / road / address"],
      ["division / district / upazila / mouza", "No", "Must match an existing location and belong to its parent."],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Farmers");
    XLSX.utils.book_append_sheet(wb, notes, "Instructions");
    XLSX.writeFile(wb, "farmer-import-template.xlsx");
  }

  async function handleFile(f: File | null) {
    if (!f) return;
    try {
      const wb = await readBookFromFile(f);
      const parsed = parseSheet(wb);
      if (parsed.length === 0) { toast.error("File is empty."); return; }
      const initial: RowState[] = parsed.map((raw, idx) => ({
        idx,
        raw,
        loc: {
          division: String(raw.division ?? ""),
          district: String(raw.district ?? ""),
          upazila:  String(raw.upazila  ?? ""),
          mouza:    String(raw.mouza    ?? ""),
        },
        resolved: {},
        failedLevel: null,
        errorMsg: null,
        status: "pending",
      }));
      setRows(initial);
      setSavedCount(0);
      await resolveAll(initial);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to read file");
    }
  }

  // Resolve names → IDs row-by-row with strict parent constraints.
  async function resolveAll(list: RowState[]) {
    setResolving(true);
    try {
      const next: RowState[] = [];
      for (const r of list) {
        next.push(await resolveOne(r));
      }
      setRows(next);
    } finally {
      setResolving(false);
    }
  }

  async function lookup(table: string, name: string, parentCol?: string, parentId?: string | null) {
    const cleaned = name.trim();
    if (!cleaned) return null;
    let q: any = (supabase as any).from(table).select("id,name,name_bn").eq("is_active", true).limit(2);
    // Match on either English or Bengali name (case-insensitive)
    q = q.or(`name.ilike.${cleaned},name_bn.ilike.${cleaned}`);
    if (parentCol && parentId) q = q.eq(parentCol, parentId);
    const { data } = await q;
    if (!data || data.length === 0) return { id: null as string | null, ambiguous: false, missing: true };
    if (data.length > 1) return { id: data[0].id as string, ambiguous: true, missing: false };
    return { id: data[0].id as string, ambiguous: false, missing: false };
  }

  async function resolveOne(r: RowState): Promise<RowState> {
    const out: RowState = { ...r, resolved: {}, failedLevel: null, errorMsg: null };

    if (!String(r.raw.name_en ?? "").trim()) {
      out.status = "invalid";
      out.errorMsg = "Missing required field: name_en";
      return out;
    }

    const chain: { lvl: LocationLevel; table: string; name: string; parentCol?: string; parentKey?: keyof LocResolved }[] = [
      { lvl: "division", table: "divisions", name: r.loc.division },
      { lvl: "district", table: "districts", name: r.loc.district, parentCol: "division_id", parentKey: "division_id" },
      { lvl: "upazila",  table: "upazilas",  name: r.loc.upazila,  parentCol: "district_id", parentKey: "district_id" },
      { lvl: "mouza",    table: "mouzas",    name: r.loc.mouza,    parentCol: "upazila_id",  parentKey: "upazila_id" },
    ];

    for (const step of chain) {
      if (!step.name.trim()) continue; // optional level; client validator catches missing parents below
      const parentId = step.parentKey ? out.resolved[step.parentKey] : undefined;
      if (step.parentKey && !parentId) {
        out.failedLevel = step.parentKey.replace("_id", "") as LocationLevel;
        out.errorMsg = `Cannot pick ${levelLabel(step.lvl)} without selecting ${levelLabel(out.failedLevel)} first.`;
        out.status = "invalid"; return out;
      }
      const res = await lookup(step.table, step.name, step.parentCol, parentId);
      if (!res || res.missing) {
        out.failedLevel = step.lvl;
        out.errorMsg = `${levelLabel(step.lvl)} "${step.name}" not found under selected ${step.parentCol ? levelLabel(step.parentKey!.replace("_id", "") as LocationLevel) : "root"}.`;
        out.status = "invalid"; return out;
      }
      if (res.ambiguous) {
        out.failedLevel = step.lvl;
        out.errorMsg = `${levelLabel(step.lvl)} "${step.name}" is ambiguous. Please make it unique.`;
        out.status = "invalid"; return out;
      }
      out.resolved[`${step.lvl === "division" ? "division" :
                      step.lvl === "district" ? "district" :
                      step.lvl === "upazila"  ? "upazila"  :
                      step.lvl === "union"    ? "union"    :
                      step.lvl === "ward"     ? "ward"     :
                      step.lvl === "village"  ? "village"  : "mouza"}_id` as keyof LocResolved] = res.id;
    }

    // Mirror the strict cascading rule client-side.
    const v = validateLocationChain(out.resolved);
    if (v.ok === false) {
      out.failedLevel = v.level;
      out.errorMsg = `Please provide ${levelLabel(v.level)} before its child level.`;
      out.status = "invalid"; return out;
    }
    out.status = "valid";
    return out;
  }

  function updateLoc(idx: number, key: keyof RowState["loc"], val: string) {
    setRows((prev) => prev.map((r) => r.idx === idx
      ? { ...r, loc: { ...r.loc, [key]: val }, status: "pending", errorMsg: null, failedLevel: null }
      : r));
  }

  async function revalidateRow(idx: number) {
    const r = rows.find((x) => x.idx === idx);
    if (!r) return;
    const next = await resolveOne(r);
    setRows((prev) => prev.map((x) => x.idx === idx ? next : x));
  }

  async function revalidateAll() {
    await resolveAll(rows);
  }

  const validRows = useMemo(() => rows.filter((r) => r.status === "valid"), [rows]);
  const invalidRows = useMemo(() => rows.filter((r) => r.status === "invalid"), [rows]);

  async function importValid() {
    if (validRows.length === 0) { toast.error("No valid rows to import."); return; }
    setSaving(true);
    let saved = 0;
    const updated = [...rows];

    for (const r of validRows) {
      const i = updated.findIndex((x) => x.idx === r.idx);
      updated[i] = { ...updated[i], status: "saving", errorMsg: null };
      setRows([...updated]);

      const isVoter = ((): boolean => {
        const v = String(r.raw.is_voter ?? "").toLowerCase().trim();
        return v === "true" || v === "1" || v === "yes" || v === "y";
      })();
      const memberNo = r.raw.member_no ? String(r.raw.member_no).trim() : null;

      const payload: any = {
        name_en:      r.raw.name_en,
        name_bn:      r.raw.name_bn      ?? null,
        father_name:  r.raw.father_name  ?? null,
        mother_name:  r.raw.mother_name  ?? null,
        nid:          r.raw.nid          ?? null,
        mobile:       r.raw.mobile       ?? null,
        member_no:    memberNo,
        is_voter:     isVoter,
        // If voter + member_no provided, mirror it as account_number/voter_number
        ...(isVoter && memberNo ? { account_number: memberNo, voter_number: memberNo } : {}),
        status:       (r.raw.status as string) || "active",
        village:      r.raw.village      ?? null,
        address:      r.raw.address      ?? null,
        office_id:    officeId ?? null,
        ...r.resolved,
      };

      const { error } = await supabase.from("farmers").insert(payload);
      if (error) {
        const lvl = parseLocationDbError(error.message);
        updated[i] = {
          ...updated[i],
          status: "error",
          failedLevel: lvl ?? updated[i].failedLevel,
          errorMsg: lvl
            ? `Server rejected: ${levelLabel(lvl)} doesn't belong to its parent.`
            : error.message,
        };
      } else {
        updated[i] = { ...updated[i], status: "saved" };
        saved++;
      }
      setRows([...updated]);
    }

    setSaving(false);
    setSavedCount(saved);
    if (saved > 0) toast.success(`Imported ${saved} farmer${saved === 1 ? "" : "s"}.`);
  }

  if (rolesLoaded && !isAdmin) {
    return (
      <Card className="p-6 m-4">
        <p className="text-muted-foreground">You don't have permission to import farmers.</p>
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        title="Bulk Farmer Import"
        description="Upload a CSV or Excel (.xlsx) file. Location names are matched against the cascading hierarchy."
      />

      <Card className="p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[260px]">
            <Label>File (.csv or .xlsx)</Label>
            <Input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls,.txt,.tsv"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-1" /> Template
          </Button>
          <Button variant="outline" onClick={revalidateAll} disabled={rows.length === 0 || resolving}>
            {resolving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
            Re-validate
          </Button>
          <Button onClick={importValid} disabled={validRows.length === 0 || saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
            Import {validRows.length} valid row{validRows.length === 1 ? "" : "s"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Required column: <code>name_en</code>. Hierarchy columns:{" "}
          <code>division, district, upazila, mouza</code>.
          Each level must belong to the parent above it.
        </p>
      </Card>

      {rows.length > 0 && (
        <Card className="p-3 mb-3">
          <div className="flex flex-wrap gap-3 text-sm">
            <Badge variant="default">Total: {rows.length}</Badge>
            <Badge variant="secondary">Valid: {validRows.length}</Badge>
            <Badge variant="destructive">Invalid: {invalidRows.length}</Badge>
            {savedCount > 0 && <Badge>Saved: {savedCount}</Badge>}
          </div>
        </Card>
      )}

      {invalidRows.length > 0 && (
        <Alert variant="destructive" className="mb-3" role="alert" aria-live="polite">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{invalidRows.length} row(s) need attention</AlertTitle>
          <AlertDescription>
            The failing dropdown for each row is outlined in red. Edit the value and the row
            will re-validate automatically when you click "Re-validate" or attempt to import.
          </AlertDescription>
        </Alert>
      )}

      {rows.length > 0 && (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead>Division</TableHead>
                <TableHead>District</TableHead>
                <TableHead>Upazila</TableHead>
                <TableHead>Mouza</TableHead>
                <TableHead>Issue</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const cellCls = (lvl: LocationLevel) =>
                  r.failedLevel === lvl
                    ? "border border-destructive ring-2 ring-destructive/30 rounded"
                    : "";
                return (
                  <TableRow key={r.idx} data-status={r.status} data-testid={`import-row-${r.idx}`}>
                    <TableCell className="font-mono text-xs">{r.idx + 1}</TableCell>
                    <TableCell>
                      {r.status === "saved" && (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Saved
                        </Badge>
                      )}
                      {r.status === "valid" && <Badge variant="secondary">Valid</Badge>}
                      {r.status === "invalid" && <Badge variant="destructive">Invalid</Badge>}
                      {r.status === "saving" && <Badge variant="outline">Saving…</Badge>}
                      {r.status === "error" && <Badge variant="destructive">Server reject</Badge>}
                      {r.status === "pending" && <Badge variant="outline">Pending</Badge>}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="font-medium">{String(r.raw.name_en ?? "")}</div>
                      {r.raw.name_bn && <div className="text-xs text-muted-foreground">{String(r.raw.name_bn)}</div>}
                    </TableCell>
                    <TableCell className="text-xs">{String(r.raw.mobile ?? "")}</TableCell>

                    {(["division","district","upazila","mouza"] as LocationLevel[]).map((lvl) => (
                      <TableCell key={lvl} className="min-w-[140px]">
                        <Input
                          className={cellCls(lvl)}
                          value={r.loc[lvl as keyof RowState["loc"]]}
                          onChange={(e) => updateLoc(r.idx, lvl as keyof RowState["loc"], e.target.value)}
                          onBlur={() => revalidateRow(r.idx)}
                          aria-invalid={r.failedLevel === lvl || undefined}
                        />
                      </TableCell>
                    ))}

                    <TableCell className="text-xs max-w-[260px]">
                      {r.errorMsg && (
                        <span className="text-destructive" data-testid={`row-err-${r.idx}`}>
                          {r.errorMsg}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => revalidateRow(r.idx)} disabled={resolving}>
                        Recheck
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
