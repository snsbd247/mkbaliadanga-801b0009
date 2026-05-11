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
import { Upload, Download, AlertTriangle, Loader2 } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { toast } from "sonner";
import { decodeSpreadsheetBuffer } from "@/lib/csvDecode";
import { normalizeFarmerCode } from "@/lib/farmerCode";

/**
 * Bulk Farmer Import — simplified
 *
 * Columns (case-insensitive):
 *   farmer_id     (optional) — যদি দেয়া হয় ও already exist করে, এটি UPDATE হবে; না দিলে INSERT।
 *   voter_number  (optional) — থাকলে farmer অটো voter / savings active সদস্য হিসেবে গণ্য হবে।
 *   name_en       (required)
 *   name_bn       (optional)
 *   father_name   (optional)
 *   mobile        (optional)
 *   village       (optional, free-text)
 *
 * File: .csv বা .xlsx
 */

type Cell = string | number | null;
type RowMap = Record<string, Cell>;

type RowState = {
  idx: number;
  raw: RowMap;
  status: "pending" | "valid" | "invalid" | "saving" | "saved" | "error";
  errorMsg: string | null;
  action: "insert" | "update" | null;
};

const COLUMNS = ["farmer_id", "voter_number", "name_en", "name_bn", "father_name", "mobile", "village"] as const;

function readBookFromFile(file: File): Promise<XLSX.WorkBook> {
  const isText = /\.(csv|txt|tsv)$/i.test(file.name) || file.type === "text/csv" || file.type === "text/plain";
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      try {
        if (isText) {
          const text = decodeSpreadsheetBuffer(reader.result as ArrayBuffer);
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
  const { t, tx } = useLang();
  const { isAdmin, officeId, rolesLoaded } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<RowState[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  useEffect(() => {
    document.title = `Bulk Farmer Import — ${t("appName")}`;
  }, [t]);

  function downloadTemplate(format: "xlsx" | "csv") {
    const headers = [...COLUMNS];
    const sample = [
      ["00001", "10001", "Md. Abdur Rahman", "মোঃ আব্দুর রহমান", "Md. Karim Uddin", "01711000000", "Bagbari"],
      ["",      "",      "Mst. Rahima Khatun", "মোসাঃ রহিমা খাতুন", "Md. Jashim", "01811000000", "Char Bhabanipur"],
    ];
    if (format === "csv") {
      const csv = [headers, ...sample]
        .map((r) => r.map((v) => /[",\n]/.test(String(v ?? "")) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? "")).join(","))
        .join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "farmer-import-template.csv"; a.click();
      URL.revokeObjectURL(url);
      return;
    }
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sample]);
    const notes = XLSX.utils.aoa_to_sheet([
      ["Column", "Required", "Notes"],
      ["farmer_id", "No", "5-digit padded code (e.g. 00001). 'F-00001', '1', '2026-00000001' এর মতো ইনপুট স্বয়ংক্রিয়ভাবে 00001 হবে। existing হলে UPDATE, খালি হলে নতুন তৈরি হবে।"],
      ["voter_number", "No", "নম্বর থাকলে অটো Voter / Savings active সদস্য।"],
      ["name_en", "Yes", "ইংরেজী নাম"],
      ["name_bn", "No", "বাংলা নাম"],
      ["father_name", "No", ""],
      ["mobile", "No", "11-digit BD number, e.g. 017XXXXXXXX"],
      ["village", "No", "Free-text গ্রাম"],
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
      const initial: RowState[] = parsed.map((raw, idx) => {
        const nameEn = String(raw.name_en ?? "").trim();
        const farmerIdRaw = String(raw.farmer_id ?? raw.member_no ?? "").trim();
        let farmerIdErr: string | null = null;
        if (farmerIdRaw) {
          const r = normalizeFarmerCode(farmerIdRaw);
          if (r.ok === false) farmerIdErr = r.error;
          else raw.farmer_id = r.value; // canonicalize in-place for the save loop
        }
        const errorMsg = !nameEn ? "name_en is required" : farmerIdErr;
        return {
          idx,
          raw,
          status: errorMsg ? "invalid" : "valid",
          errorMsg,
          action: farmerIdRaw && !farmerIdErr ? "update" : "insert",
        };
      });
      setRows(initial);
      setSavedCount(0);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to read file");
    }
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

      const farmerId = String(r.raw.farmer_id ?? r.raw.member_no ?? "").trim();
      const voterNumber = String(r.raw.voter_number ?? "").trim();
      const isVoter = !!voterNumber;

      const basePayload: any = {
        name_en:     String(r.raw.name_en ?? "").trim(),
        name_bn:     r.raw.name_bn     ? String(r.raw.name_bn).trim()     : null,
        father_name: r.raw.father_name ? String(r.raw.father_name).trim() : null,
        mobile:      r.raw.mobile      ? String(r.raw.mobile).trim()      : null,
        village:     r.raw.village     ? String(r.raw.village).trim()     : null,
        ...(isVoter
          ? { voter_number: voterNumber, account_number: voterNumber, is_voter: true }
          : {}),
      };

      try {
        if (farmerId) {
          // Find existing farmer by member_no
          const { data: existing } = await supabase
            .from("farmers")
            .select("id")
            .eq("member_no", farmerId)
            .maybeSingle();
          if (existing?.id) {
            const { error } = await supabase.from("farmers").update(basePayload).eq("id", existing.id);
            if (error) throw error;
          } else {
            const { error } = await supabase
              .from("farmers")
              .insert({ ...basePayload, member_no: farmerId, office_id: officeId ?? null });
            if (error) throw error;
          }
        } else {
          const { error } = await supabase
            .from("farmers")
            .insert({ ...basePayload, office_id: officeId ?? null });
          if (error) throw error;
        }
        updated[i] = { ...updated[i], status: "saved" };
        saved++;
      } catch (e: any) {
        updated[i] = { ...updated[i], status: "error", errorMsg: e?.message ?? "Save failed" };
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
        description={tx("Upload a .csv or .xlsx file. If voter_number is set, the farmer auto-becomes a Voter / Savings active member.", ".csv বা .xlsx ফাইল আপলোড করুন। voter_number থাকলে farmer অটো Voter / Savings active সদস্য হবে।")}
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
          <Button variant="outline" onClick={() => downloadTemplate("xlsx")}>
            <Download className="h-4 w-4 mr-1" /> XLSX Template
          </Button>
          <Button variant="outline" onClick={() => downloadTemplate("csv")}>
            <Download className="h-4 w-4 mr-1" /> CSV Template
          </Button>
          <Button onClick={importValid} disabled={validRows.length === 0 || saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
            Import {validRows.length} valid row{validRows.length === 1 ? "" : "s"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Required: <code>name_en</code>. Optional: <code>farmer_id, voter_number, name_bn, father_name, mobile, village</code>.
          <br />
          <span
            title={tx(
              "Farmer ID format: 5-digit padded number (e.g. 00001). Inputs like 'F-00001', '1', '2026-00000001' are auto-normalized to 00001. Letters or non-numeric values are rejected.",
              "Farmer ID ফরম্যাট: 5-digit padded (যেমন 00001)। 'F-00001', '1', '2026-00000001' এর মতো ইনপুট স্বয়ংক্রিয়ভাবে 00001 হবে। অক্ষর / সংখ্যা ছাড়া ভ্যালু রিজেক্ট হবে।"
            )}
            className="inline-flex h-4 w-4 mr-1 items-center justify-center rounded-full border text-[10px] cursor-help"
          >?</span>
          {tx("If farmer_id is given, existing farmer is updated, else a new one is created.", "farmer_id দিলে existing farmer থাকলে update, না থাকলে নতুন তৈরি হবে।")}
          <span className="ml-2">{tx("If voter_number is given, auto Voter / Savings active member.", "voter_number দিলে অটো Voter / Savings active সদস্য।")}</span>
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
          <AlertTitle>{invalidRows.length} row(s) skipped</AlertTitle>
          <AlertDescription>
            {tx("Only rows containing name_en will be imported.", "শুধু যেসব row-তে name_en আছে সেগুলোই import হবে।")}
          </AlertDescription>
        </Alert>
      )}

      {rows.length > 0 && (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("action")}</TableHead>
                <TableHead>{t("farmerIdCol")}</TableHead>
                <TableHead>{t("voterNo")}</TableHead>
                <TableHead>{t("name")} (EN)</TableHead>
                <TableHead>{t("name")} (BN)</TableHead>
                <TableHead>{t("fatherName")}</TableHead>
                <TableHead>{t("mobile")}</TableHead>
                <TableHead>{t("village")}</TableHead>
                <TableHead>{t("issueCol")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.idx} className={r.status === "invalid" || r.status === "error" ? "bg-destructive/10" : ""}>
                  <TableCell>{r.idx + 1}</TableCell>
                  <TableCell>
                    {r.status === "saved" && <Badge variant="default">{t("saved")}</Badge>}
                    {r.status === "saving" && <Badge variant="secondary"><Loader2 className="h-3 w-3 animate-spin mr-1" />{t("loading")}</Badge>}
                    {r.status === "valid" && <Badge variant="secondary">{t("readyBadge")}</Badge>}
                    {r.status === "invalid" && <Badge variant="destructive">{t("invalidBadge")}</Badge>}
                    {r.status === "error" && <Badge variant="destructive">{t("errorBadge")}</Badge>}
                    {r.status === "pending" && <Badge variant="outline">{t("pending")}</Badge>}
                  </TableCell>
                  <TableCell>{r.action === "update" ? <Badge variant="outline">{t("update")}</Badge> : <Badge variant="outline">{t("insertAction")}</Badge>}</TableCell>
                  <TableCell className="font-mono text-xs">{String(r.raw.farmer_id ?? r.raw.member_no ?? "")}</TableCell>
                  <TableCell className="font-mono text-xs">{String(r.raw.voter_number ?? "")}</TableCell>
                  <TableCell>{String(r.raw.name_en ?? "")}</TableCell>
                  <TableCell>{String(r.raw.name_bn ?? "")}</TableCell>
                  <TableCell>{String(r.raw.father_name ?? "")}</TableCell>
                  <TableCell>{String(r.raw.mobile ?? "")}</TableCell>
                  <TableCell>{String(r.raw.village ?? "")}</TableCell>
                  <TableCell className="text-xs text-destructive max-w-[300px]">{r.errorMsg}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
