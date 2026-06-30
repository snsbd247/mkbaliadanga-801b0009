import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import { useAuth } from "@/auth/AuthProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Upload, Download, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { decodeSpreadsheetBuffer } from "@/lib/csvDecode";
import { normalizeFarmerCode } from "@/lib/farmerCode";

/**
 * Bulk Lands Import — owner-cultivated + barga (sharecropper) lands in one file.
 *
 * Each row = one land parcel for `owner_farmer_id`. When `owner_type = borga`
 * the row also creates a `land_relations` record (owner + sharecropper). Use
 * the same `land_ref` value across multiple rows to attach several
 * sharecroppers to the SAME parcel (only the first row creates the land).
 */

type Cell = string | number | null;
type RowMap = Record<string, Cell>;

type RowState = {
  idx: number;
  raw: RowMap;
  status: "pending" | "valid" | "invalid" | "saving" | "saved" | "error";
  errorMsg: string | null;
  warnMsg: string | null;
};

const COLUMNS = [
  "owner_farmer_id", "land_ref", "mouza", "dag_no", "land_type", "field_type",
  "land_size", "owner_type", "sharecropper_id", "borga_area", "share_percentage", "note",
] as const;

const FIELD_TYPE_MAP: Record<string, string> = {
  "উচু": "high_land", "উঁচু": "high_land", "high": "high_land", "high_land": "high_land",
  "নিচু": "low_land", "low": "low_land", "low_land": "low_land",
  "মাঝারি": "medium_land", "medium": "medium_land", "medium_land": "medium_land",
  "অন্যান্য": "other", "other": "other",
};

function normalizeKey(k: string) {
  return k.trim().toLowerCase().replace(/\s+/g, "_");
}

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

const num = (v: unknown): number => {
  const x = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(x) ? x : 0;
};
const round4 = (v: number) => Math.round(v * 10000) / 10000;
const isBorgaType = (v: unknown) =>
  ["borga", "borgadar", "বর্গা", "বর্গাদার", "share", "sharecrop"].includes(String(v ?? "").trim().toLowerCase());

export default function LandsImport() {
  const { officeId } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<RowState[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  useEffect(() => {
    document.title = "জমি ইমপোর্ট — Lands Import";
  }, []);

  function downloadTemplate(format: "xlsx" | "csv") {
    const headers = [...COLUMNS];
    const sample = [
      ["00001", "L1", "Mouza A", "12,15", "আমন২৬", "উচু", "33.0000", "own", "", "", "", "মালিক নিজে চাষ"],
      ["00002", "L2", "Mouza A", "30", "ইরি২৬", "নিচু", "50.0000", "borga", "00003", "20.0000", "", "বর্গাদার ২০ শতক"],
      ["00002", "L2", "Mouza A", "30", "ইরি২৬", "নিচু", "50.0000", "borga", "00004", "", "30", "একই জমিতে ২য় বর্গাদার (একই land_ref)"],
    ];
    if (format === "csv") {
      const csv = [headers, ...sample]
        .map((r) => r.map((v) => /[",\n]/.test(String(v ?? "")) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? "")).join(","))
        .join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "lands-import-template.csv"; a.click();
      URL.revokeObjectURL(url);
      return;
    }
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sample]);
    const notes = XLSX.utils.aoa_to_sheet([
      ["Column", "Required", "Notes"],
      ["owner_farmer_id", "Yes", "মালিকের Farmer ID (যেমন 00001)"],
      ["land_ref", "No", "একই জমিতে একাধিক বর্গাদার দিতে একই ref ব্যবহার করুন (যেমন L2)। খালি হলে প্রতি সারি আলাদা জমি।"],
      ["mouza", "No", "মৌজার নাম — থাকলে mouza_id রিসলভ হবে"],
      ["dag_no", "No", "দাগ নং — একাধিক হলে কমা দিয়ে: 12,15,30"],
      ["land_type", "No", "জমির ধরন — land_types এর code বা নাম (যেমন আমন২৬)"],
      ["field_type", "No", "উচু / নিচু / মাঝারি / অন্যান্য (ধান হলে)"],
      ["land_size", "Yes", "জমির পরিমাণ (শতক) — . এর পর ৪ ডিজিট পর্যন্ত"],
      ["owner_type", "No", "own / borga (ডিফল্ট own)"],
      ["sharecropper_id", "borga হলে Yes", "বর্গাদারের Farmer ID"],
      ["borga_area", "No", "বর্গাদারকে দেয়া শতক (share_percentage এর চেয়ে অগ্রাধিকার)"],
      ["share_percentage", "No", "borga_area না দিলে শতাংশ (০-১০০)"],
      ["note", "No", "মন্তব্য"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Lands");
    XLSX.utils.book_append_sheet(wb, notes, "Instructions");
    XLSX.writeFile(wb, "lands-import-template.xlsx");
  }

  async function handleFile(f: File | null) {
    if (!f) return;
    try {
      const wb = await readBookFromFile(f);
      const parsed = parseSheet(wb);
      if (parsed.length === 0) { toast.error("File is empty."); return; }

      // Per-land_ref area accounting to catch borga overlap within the file.
      const borgaAreaByRef: Record<string, number> = {};
      const sizeByRef: Record<string, number> = {};
      parsed.forEach((raw) => {
        const ref = String(raw.land_ref ?? "").trim();
        if (!ref) return;
        if (sizeByRef[ref] == null) sizeByRef[ref] = num(raw.land_size);
        if (isBorgaType(raw.owner_type)) {
          borgaAreaByRef[ref] = (borgaAreaByRef[ref] ?? 0) + num(raw.borga_area);
        }
      });

      const initial: RowState[] = parsed.map((raw, idx) => {
        const errors: string[] = [];
        const warns: string[] = [];

        const ownerRaw = String(raw.owner_farmer_id ?? "").trim();
        if (!ownerRaw) errors.push("owner_farmer_id আবশ্যক");
        else {
          const r = normalizeFarmerCode(ownerRaw);
          if (r.ok === false) errors.push(`মালিকের ID সঠিক নয়: ${ownerRaw}`);
          else raw.owner_farmer_id = r.value;
        }

        const size = num(raw.land_size);
        if (size <= 0) errors.push("land_size অবশ্যই ০ এর বেশি হতে হবে");

        const borga = isBorgaType(raw.owner_type);
        if (borga) {
          const scRaw = String(raw.sharecropper_id ?? "").trim();
          if (!scRaw) errors.push("borga হলে sharecropper_id আবশ্যক");
          else {
            const r = normalizeFarmerCode(scRaw);
            if (r.ok === false) errors.push(`বর্গাদার ID সঠিক নয়: ${scRaw}`);
            else {
              raw.sharecropper_id = r.value;
              if (raw.sharecropper_id === raw.owner_farmer_id)
                errors.push("মালিক ও বর্গাদার একই হতে পারে না");
            }
          }
          const ba = num(raw.borga_area);
          const pct = num(raw.share_percentage);
          if (ba <= 0 && pct <= 0) errors.push("borga হলে borga_area অথবা share_percentage দিতে হবে");
          if (ba > size) errors.push("borga_area জমির পরিমাণের চেয়ে বেশি");
          if (pct < 0 || pct > 100) errors.push("share_percentage ০-১০০ এর মধ্যে হতে হবে");
        }

        const ref = String(raw.land_ref ?? "").trim();
        if (ref && (borgaAreaByRef[ref] ?? 0) > (sizeByRef[ref] ?? 0) + 0.0001) {
          errors.push(`একই জমির (${ref}) বর্গা area জমির পরিমাণ অতিক্রম করেছে`);
        }
        if (raw.field_type && !FIELD_TYPE_MAP[String(raw.field_type).trim().toLowerCase()] && !FIELD_TYPE_MAP[String(raw.field_type).trim()])
          warns.push(`field_type চেনা যায়নি (উচু/নিচু/মাঝারি): ${raw.field_type}`);

        return {
          idx,
          raw,
          status: errors.length ? "invalid" : "valid",
          errorMsg: errors.length ? errors.join("; ") : null,
          warnMsg: warns.length ? warns.join("; ") : null,
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
    let inserted = 0, failed = 0;
    const updated = [...rows];

    // Resolve lookup maps.
    const farmerMap = new Map<string, string>(); // farmer_code → id
    const landTypeMap = new Map<string, string>(); // code/name → id
    const mouzaMap = new Map<string, string>();
    try {
      const [{ data: fm }, { data: lt }, { data: mz }] = await Promise.all([
        db.from("farmers").select("id,farmer_code"),
        db.from("land_types").select("id,code,name,name_bn,name_en"),
        db.from("mouzas").select("id,name,name_bn,code"),
      ]);
      (fm ?? []).forEach((f: any) => { if (f.farmer_code) farmerMap.set(String(f.farmer_code).trim(), f.id); });
      (lt ?? []).forEach((l: any) => {
        [l.code, l.name, l.name_bn, l.name_en].forEach((k) => { if (k) landTypeMap.set(String(k).trim().toLowerCase(), l.id); });
      });
      (mz ?? []).forEach((m: any) => {
        [m.name, m.name_bn, m.code].forEach((k) => { if (k) mouzaMap.set(String(k).trim().toLowerCase(), m.id); });
      });
    } catch (e: any) {
      toast.error("লুকআপ ডেটা লোড করা যায়নি: " + (e?.message ?? ""));
      setSaving(false);
      return;
    }

    // Track lands created in this run by land_ref so multiple borga rows reuse them.
    const landIdByRef = new Map<string, string>();

    for (const r of validRows) {
      const i = updated.findIndex((x) => x.idx === r.idx);
      updated[i] = { ...updated[i], status: "saving", errorMsg: null };
      setRows([...updated]);

      try {
        const ownerCode = String(r.raw.owner_farmer_id ?? "").trim();
        const ownerId = farmerMap.get(ownerCode);
        if (!ownerId) throw new Error(`মালিক পাওয়া যায়নি (Farmer ID ${ownerCode})`);

        const ref = String(r.raw.land_ref ?? "").trim();
        let landId = ref ? landIdByRef.get(ref) : undefined;

        if (!landId) {
          const dagRaw = String(r.raw.dag_no ?? "").trim();
          const dagNumbers = dagRaw ? dagRaw.split(/[,;]/).map((s) => s.trim()).filter(Boolean) : [];
          const mouzaName = String(r.raw.mouza ?? "").trim();
          const mouzaId = mouzaName ? mouzaMap.get(mouzaName.toLowerCase()) ?? null : null;
          const ltKey = String(r.raw.land_type ?? "").trim().toLowerCase();
          const landTypeId = ltKey ? landTypeMap.get(ltKey) ?? null : null;
          const ftRaw = String(r.raw.field_type ?? "").trim();
          const fieldType = FIELD_TYPE_MAP[ftRaw.toLowerCase()] ?? FIELD_TYPE_MAP[ftRaw] ?? "medium_land";
          const borga = isBorgaType(r.raw.owner_type);

          const landPayload: any = {
            farmer_id: ownerId,
            owner_farmer_id: ownerId,
            office_id: officeId ?? null,
            mouza: mouzaName || null,
            mouza_id: mouzaId,
            dag_no: dagNumbers[0] ?? (dagRaw || null),
            dag_numbers: dagNumbers,
            land_size: round4(num(r.raw.land_size)),
            owner_type: borga ? "borgadar" : "owner",
            field_type: fieldType,
            land_type_id: landTypeId,
            notes: r.raw.note ? String(r.raw.note) : null,
          };
          const { data: ins, error } = await db.from("lands").insert(landPayload).select("id").single();
          if (error) throw new Error(error.message);
          landId = (ins as any)?.id;
          if (!landId) throw new Error("জমি তৈরি হয়নি");
          if (ref) landIdByRef.set(ref, landId);
        }

        // Create barga relation when applicable.
        if (isBorgaType(r.raw.owner_type)) {
          const scCode = String(r.raw.sharecropper_id ?? "").trim();
          const scId = farmerMap.get(scCode);
          if (!scId) throw new Error(`বর্গাদার পাওয়া যায়নি (Farmer ID ${scCode})`);
          const ba = num(r.raw.borga_area);
          const pct = num(r.raw.share_percentage);
          const relPayload: any = {
            land_id: landId,
            owner_farmer_id: ownerId,
            sharecropper_farmer_id: scId,
            area_decimal: ba > 0 ? round4(ba) : null,
            share_percentage: ba > 0 ? 0 : (pct || 50),
            office_id: officeId ?? null,
            note: r.raw.note ? String(r.raw.note) : null,
          };
          const { error: relErr } = await db.from("land_relations").insert(relPayload);
          if (relErr) throw new Error(relErr.message);
        }

        updated[i] = { ...updated[i], status: "saved", errorMsg: null };
        inserted++;
      } catch (e: any) {
        updated[i] = { ...updated[i], status: "error", errorMsg: e?.message ?? "ত্রুটি" };
        failed++;
      }
      setRows([...updated]);
    }

    setSavedCount(inserted);
    setSaving(false);

    try {
      await db.from("import_audit_logs").insert({
        office_id: officeId ?? null,
        module: "lands",
        mode: "insert",
        rows_processed: validRows.length,
        rows_inserted: inserted,
        rows_updated: 0,
        rows_failed: failed,
        summary: { source: "LandsImport" },
      });
    } catch { /* audit best-effort */ }

    if (failed === 0) toast.success(`${inserted} টি জমি ইমপোর্ট হয়েছে`);
    else toast.warning(`${inserted} টি সফল, ${failed} টি ব্যর্থ`);
  }

  return (
    <>
      <PageHeader title="জমি ইমপোর্ট" subtitle="নিজের চাষ ও বর্গা জমি একসাথে আপলোড করুন" />

      <Card className="p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls,.txt,.tsv"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
          <Button onClick={() => fileRef.current?.click()} variant="default">
            <Upload className="h-4 w-4 mr-2" /> ফাইল নির্বাচন করুন
          </Button>
          <Button onClick={() => downloadTemplate("xlsx")} variant="outline">
            <Download className="h-4 w-4 mr-2" /> টেমপ্লেট (XLSX)
          </Button>
          <Button onClick={() => downloadTemplate("csv")} variant="outline">
            <Download className="h-4 w-4 mr-2" /> টেমপ্লেট (CSV)
          </Button>
          {validRows.length > 0 && (
            <Button onClick={importValid} disabled={saving} className="ml-auto">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {validRows.length} টি জমি ইমপোর্ট করুন
            </Button>
          )}
        </div>

        {rows.length > 0 && (
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="secondary">মোট: {rows.length}</Badge>
            <Badge variant="default">প্রস্তুত: {validRows.length}</Badge>
            <Badge variant="destructive">ত্রুটি: {invalidRows.length}</Badge>
            {savedCount > 0 && <Badge>সংরক্ষিত: {savedCount}</Badge>}
          </div>
        )}

        {invalidRows.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>কিছু সারিতে ত্রুটি আছে</AlertTitle>
            <AlertDescription>ত্রুটিপূর্ণ সারি ইমপোর্ট হবে না। নিচে কারণ দেখুন।</AlertDescription>
          </Alert>
        )}
      </Card>

      {rows.length > 0 && (
        <Card className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>অবস্থা</TableHead>
                <TableHead>মালিক ID</TableHead>
                <TableHead>land_ref</TableHead>
                <TableHead>মৌজা</TableHead>
                <TableHead>দাগ</TableHead>
                <TableHead>ধরন</TableHead>
                <TableHead>পরিমাণ</TableHead>
                <TableHead>own/borga</TableHead>
                <TableHead>বর্গাদার</TableHead>
                <TableHead>সমস্যা</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.idx} className={r.status === "invalid" || r.status === "error" ? "bg-destructive/10" : ""}>
                  <TableCell>{r.idx + 1}</TableCell>
                  <TableCell>
                    {r.status === "saved" && <Badge>সংরক্ষিত</Badge>}
                    {r.status === "saving" && <Badge variant="secondary"><Loader2 className="h-3 w-3 animate-spin mr-1" />…</Badge>}
                    {r.status === "valid" && <Badge variant="secondary">প্রস্তুত</Badge>}
                    {r.status === "invalid" && <Badge variant="destructive">ত্রুটি</Badge>}
                    {r.status === "error" && <Badge variant="destructive">ব্যর্থ</Badge>}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{String(r.raw.owner_farmer_id ?? "")}</TableCell>
                  <TableCell className="font-mono text-xs">{String(r.raw.land_ref ?? "")}</TableCell>
                  <TableCell>{String(r.raw.mouza ?? "")}</TableCell>
                  <TableCell className="font-mono text-xs">{String(r.raw.dag_no ?? "")}</TableCell>
                  <TableCell>{String(r.raw.land_type ?? "")}</TableCell>
                  <TableCell className="text-right">{String(r.raw.land_size ?? "")}</TableCell>
                  <TableCell>{isBorgaType(r.raw.owner_type) ? "borga" : "own"}</TableCell>
                  <TableCell className="font-mono text-xs">{String(r.raw.sharecropper_id ?? "")}</TableCell>
                  <TableCell className="text-xs max-w-[280px]">
                    {r.errorMsg && <span className="text-destructive">{r.errorMsg}</span>}
                    {r.warnMsg && <span className="block text-amber-600">⚠ {r.warnMsg}</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
