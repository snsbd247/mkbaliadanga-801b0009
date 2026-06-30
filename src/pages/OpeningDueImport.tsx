import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import { useAuth } from "@/auth/AuthProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Upload, Download, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { decodeSpreadsheetBuffer } from "@/lib/csvDecode";
import { normalizeFarmerCode } from "@/lib/farmerCode";

/**
 * Opening (carry-forward) Due Import — per land/dag line.
 *
 * Each row becomes an "opening" irrigation invoice for the selected season so
 * the amount flows through the existing due / payment / carry-forward engine.
 * A land is matched by `owner_farmer_id` + `dag_no`; the row's `previous_due`
 * is stored in `previous_due_amount` and any `fine` in `delay_fee`.
 */

type Cell = string | number | null;
type RowMap = Record<string, Cell>;

type RowState = {
  idx: number;
  raw: RowMap;
  status: "pending" | "valid" | "invalid" | "saving" | "saved" | "error";
  errorMsg: string | null;
};

const COLUMNS = ["owner_farmer_id", "dag_no", "previous_due", "fine", "note"] as const;

function normalizeKey(k: string) {
  return k.trim().toLowerCase().replace(/\s+/g, "_");
}
const num = (v: unknown): number => {
  const x = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(x) ? x : 0;
};
const round2 = (v: number) => Math.round(v * 100) / 100;

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

export default function OpeningDueImport() {
  const { officeId } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<RowState[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [seasonId, setSeasonId] = useState<string>("");

  useEffect(() => {
    document.title = "ওপেনিং বকেয়া ইমপোর্ট — Opening Due Import";
    db.from("seasons").select("id,name,year,due_date").then(({ data }) => {
      setSeasons(data ?? []);
    });
  }, []);

  function downloadTemplate(format: "xlsx" | "csv") {
    const headers = [...COLUMNS];
    const sample = [
      ["00001", "12", "1500", "150", "গত আমন সিজনের বকেয়া"],
      ["00001", "15", "800", "0", ""],
      ["00002", "30", "2200", "220", "জরিমানাসহ"],
    ];
    if (format === "csv") {
      const csv = [headers, ...sample]
        .map((r) => r.map((v) => /[",\n]/.test(String(v ?? "")) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? "")).join(","))
        .join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "opening-due-template.csv"; a.click();
      URL.revokeObjectURL(url);
      return;
    }
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sample]);
    const notes = XLSX.utils.aoa_to_sheet([
      ["Column", "Required", "Notes"],
      ["owner_farmer_id", "Yes", "মালিকের Farmer ID (যেমন 00001)"],
      ["dag_no", "Yes", "জমির দাগ নং — এই দাগ দিয়ে জমি খুঁজে বকেয়া বসবে"],
      ["previous_due", "Yes", "গত সিজনের বকেয়া টাকা"],
      ["fine", "No", "বকেয়ার জরিমানা (না দিলে ০)"],
      ["note", "No", "মন্তব্য"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "OpeningDue");
    XLSX.utils.book_append_sheet(wb, notes, "Instructions");
    XLSX.writeFile(wb, "opening-due-template.xlsx");
  }

  async function handleFile(f: File | null) {
    if (!f) return;
    try {
      const wb = await readBookFromFile(f);
      const parsed = parseSheet(wb);
      if (parsed.length === 0) { toast.error("File is empty."); return; }

      const initial: RowState[] = parsed.map((raw, idx) => {
        const errors: string[] = [];
        const ownerRaw = String(raw.owner_farmer_id ?? "").trim();
        if (!ownerRaw) errors.push("owner_farmer_id আবশ্যক");
        else {
          const r = normalizeFarmerCode(ownerRaw);
          if (r.ok === false) errors.push(`মালিকের ID সঠিক নয়: ${ownerRaw}`);
          else raw.owner_farmer_id = r.value;
        }
        if (!String(raw.dag_no ?? "").trim()) errors.push("dag_no আবশ্যক");
        if (num(raw.previous_due) <= 0) errors.push("previous_due অবশ্যই ০ এর বেশি");
        if (num(raw.fine) < 0) errors.push("fine ঋণাত্মক হতে পারে না");
        return {
          idx, raw,
          status: errors.length ? "invalid" : "valid",
          errorMsg: errors.length ? errors.join("; ") : null,
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
    if (!seasonId) { toast.error("আগে সিজন নির্বাচন করুন"); return; }
    if (validRows.length === 0) { toast.error("No valid rows to import."); return; }
    setSaving(true);
    let inserted = 0, failed = 0;
    const updated = [...rows];

    const season = seasons.find((s) => s.id === seasonId);
    const dueDate = season?.due_date ?? new Date().toISOString().slice(0, 10);

    // Resolve farmers + their lands.
    const farmerMap = new Map<string, string>();
    const landByOwnerDag = new Map<string, string>(); // `${ownerId}|${dag}` → land_id
    try {
      const [{ data: fm }, { data: ld }] = await Promise.all([
        db.from("farmers").select("id,farmer_code"),
        db.from("lands").select("id,owner_farmer_id,dag_no,dag_numbers"),
      ]);
      (fm ?? []).forEach((f: any) => { if (f.farmer_code) farmerMap.set(String(f.farmer_code).trim(), f.id); });
      (ld ?? []).forEach((l: any) => {
        const dags: string[] = [];
        if (l.dag_no) dags.push(String(l.dag_no).trim());
        if (Array.isArray(l.dag_numbers)) l.dag_numbers.forEach((d: any) => dags.push(String(d).trim()));
        dags.filter(Boolean).forEach((d) => landByOwnerDag.set(`${l.owner_farmer_id}|${d}`, l.id));
      });
    } catch (e: any) {
      toast.error("লুকআপ ডেটা লোড করা যায়নি: " + (e?.message ?? ""));
      setSaving(false);
      return;
    }

    const stamp = Date.now().toString(36).toUpperCase();
    let seq = 0;

    for (const r of validRows) {
      const i = updated.findIndex((x) => x.idx === r.idx);
      updated[i] = { ...updated[i], status: "saving", errorMsg: null };
      setRows([...updated]);
      try {
        const ownerCode = String(r.raw.owner_farmer_id ?? "").trim();
        const ownerId = farmerMap.get(ownerCode);
        if (!ownerId) throw new Error(`মালিক পাওয়া যায়নি (Farmer ID ${ownerCode})`);
        const dag = String(r.raw.dag_no ?? "").trim();
        const landId = landByOwnerDag.get(`${ownerId}|${dag}`);
        if (!landId) throw new Error(`জমি পাওয়া যায়নি (মালিক ${ownerCode}, দাগ ${dag})`);

        const prevDue = round2(num(r.raw.previous_due));
        const fine = round2(num(r.raw.fine));
        const payable = round2(prevDue + fine);
        seq += 1;
        const invoiceNo = `OPEN-${stamp}-${String(seq).padStart(4, "0")}`;

        const payload: any = {
          invoice_no: invoiceNo,
          office_id: officeId ?? null,
          season_id: seasonId,
          land_id: landId,
          owner_farmer_id: ownerId,
          farmer_id: ownerId,
          is_borga: false,
          irrigation_amount: 0,
          maintenance_amount: 0,
          canal_amount: 0,
          delay_fee: fine,
          other_charge: 0,
          payable_amount: payable,
          paid_amount: 0,
          due_amount: payable,
          previous_due_amount: prevDue,
          due_date: dueDate,
          invoice_status: "generated",
          note: `ওপেনিং বকেয়া ইমপোর্ট${r.raw.note ? " — " + String(r.raw.note) : ""}`,
        };
        const { error } = await db.from("irrigation_invoices").insert(payload);
        if (error) throw new Error(error.message);

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
        module: "irrigation_opening_due",
        mode: "insert",
        rows_processed: validRows.length,
        rows_inserted: inserted,
        rows_updated: 0,
        rows_failed: failed,
        summary: { season_id: seasonId, source: "OpeningDueImport" },
      });
    } catch { /* best-effort */ }

    if (failed === 0) toast.success(`${inserted} টি বকেয়া ইমপোর্ট হয়েছে`);
    else toast.warning(`${inserted} টি সফল, ${failed} টি ব্যর্থ`);
  }

  return (
    <>
      <PageHeader title="ওপেনিং বকেয়া ইমপোর্ট" description="প্রতি জমি/দাগ অনুযায়ী গত সিজনের বকেয়া আপলোড করুন" />

      <Card className="p-4 space-y-4">
        <div className="max-w-xs">
          <Label className="mb-1 block">সিজন</Label>
          <Select value={seasonId} onValueChange={setSeasonId}>
            <SelectTrigger><SelectValue placeholder="সিজন নির্বাচন করুন" /></SelectTrigger>
            <SelectContent>
              {seasons.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}{s.year ? ` (${s.year})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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
            <Button onClick={importValid} disabled={saving || !seasonId} className="ml-auto">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {validRows.length} টি বকেয়া ইমপোর্ট করুন
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
                <TableHead>দাগ</TableHead>
                <TableHead>বকেয়া</TableHead>
                <TableHead>জরিমানা</TableHead>
                <TableHead>মন্তব্য</TableHead>
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
                  <TableCell className="font-mono text-xs">{String(r.raw.dag_no ?? "")}</TableCell>
                  <TableCell className="text-right">{String(r.raw.previous_due ?? "")}</TableCell>
                  <TableCell className="text-right">{String(r.raw.fine ?? "")}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{String(r.raw.note ?? "")}</TableCell>
                  <TableCell className="text-xs max-w-[280px]">
                    {r.errorMsg && <span className="text-destructive">{r.errorMsg}</span>}
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
