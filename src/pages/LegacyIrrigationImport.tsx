import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Upload, Loader2, AlertTriangle, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import { decodeSpreadsheetBuffer } from "@/lib/csvDecode";
import {
  LegacyIrrigationApi, LegacyIrrigationRow, LegacyBatch,
} from "@/lib/api/legacyIrrigation";
import { SeasonsApi } from "@/lib/api/catalog";
import { ApiError } from "@/lib/api/client";
import { useLang } from "@/i18n/LanguageProvider";

const MONTHS: Record<string, string> = {
  JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
  JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
};

const COLUMNS = [
  "FARMER_NAME", "FATHER_NM", "VILLAGE", "MOBILE_NO", "MOUZA_NAME", "SESSON_YEAR",
  "LAND", "DAG_NO", "RATE", "OWNER_ID_NM", "DUE_AMOUNT", "PAID_AMOUNT",
  "OWNER_TP_NAME", "OWNER_FATHER_NM", "OWNER_VILLAGE", "OWNER_MOBILE_NO",
  "OWNER_FID", "RECEIPT_NO", "COLLECTION_DATE",
];
const REQUIRED_HEADERS = ["FARMER_NAME", "SESSON_YEAR", "RECEIPT_NO", "PAID_AMOUNT"];
const CHUNK = 300;

/** Alias → canonical column. Keys normalized (uppercase, no spaces/underscores). */
const HEADER_ALIASES: Record<string, string> = {
  FARMERNAME: "FARMER_NAME", NAME: "FARMER_NAME", KRISHOKNAME: "FARMER_NAME",
  FATHERNAME: "FATHER_NM", FATHERNM: "FATHER_NM", FATHER: "FATHER_NM",
  VILLAGE: "VILLAGE", GRAM: "VILLAGE",
  MOBILE: "MOBILE_NO", MOBILENO: "MOBILE_NO", PHONE: "MOBILE_NO", MOBILENUMBER: "MOBILE_NO",
  MOUZA: "MOUZA_NAME", MOUZANAME: "MOUZA_NAME",
  SEASON: "SESSON_YEAR", SEASONYEAR: "SESSON_YEAR", SESSONYEAR: "SESSON_YEAR", SESSION: "SESSON_YEAR", SESSIONYEAR: "SESSON_YEAR",
  LAND: "LAND", LANDSHATAK: "LAND", SHATAK: "LAND", JOMI: "LAND",
  DAG: "DAG_NO", DAGNO: "DAG_NO",
  RATE: "RATE",
  OWNERIDNM: "OWNER_ID_NM", OWNERIDNAME: "OWNER_ID_NM", OWNERNAME: "OWNER_ID_NM",
  DUE: "DUE_AMOUNT", DUEAMOUNT: "DUE_AMOUNT", BAKEYA: "DUE_AMOUNT",
  PAID: "PAID_AMOUNT", PAIDAMOUNT: "PAID_AMOUNT", AMOUNT: "PAID_AMOUNT",
  OWNERTPNAME: "OWNER_TP_NAME", OWNERTYPE: "OWNER_TP_NAME", OWNERTYPENAME: "OWNER_TP_NAME",
  OWNERFATHERNM: "OWNER_FATHER_NM", OWNERFATHERNAME: "OWNER_FATHER_NM",
  OWNERVILLAGE: "OWNER_VILLAGE",
  OWNERMOBILE: "OWNER_MOBILE_NO", OWNERMOBILENO: "OWNER_MOBILE_NO",
  OWNERFID: "OWNER_FID",
  RECEIPT: "RECEIPT_NO", RECEIPTNO: "RECEIPT_NO", RECEIPTNUMBER: "RECEIPT_NO", RASHID: "RECEIPT_NO",
  COLLECTIONDATE: "COLLECTION_DATE", DATE: "COLLECTION_DATE", COLLECTDATE: "COLLECTION_DATE",
};
const normHeader = (h: string) => h.trim().toUpperCase().replace(/[\s_\-.]/g, "");
/** Resolve an incoming header to a canonical column name (exact or alias). */
function resolveHeader(h: string): string | null {
  const canonicalSet = new Set(COLUMNS);
  const up = h.trim().toUpperCase().replace(/[\s\-.]/g, "_").replace(/_+/g, "_");
  if (canonicalSet.has(up)) return up;
  const n = normHeader(h);
  const byNorm = COLUMNS.find((c) => normHeader(c) === n);
  if (byNorm) return byNorm;
  return HEADER_ALIASES[n] ?? null;
}

/** "03-JUL-2025" | Date | Excel serial → "YYYY-MM-DD" | null */
function parseDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    return d ? `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}` : null;
  }
  const s = String(v).trim().toUpperCase();
  const m = s.match(/^(\d{1,2})[-/\s]([A-Z]{3})[-/\s](\d{4})$/);
  if (m && MONTHS[m[2]]) return `${m[3]}-${MONTHS[m[2]]}-${m[1].padStart(2, "0")}`;
  const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  return null;
}
const num = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const x = typeof v === "number" ? v : parseFloat(String(v).replace(/,/g, ""));
  return Number.isFinite(x) ? x : null;
};
const str = (v: unknown): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
};
function extractCode(name: unknown): string | null {
  const m = String(name ?? "").match(/\((\d+)\)\s*$/);
  return m ? m[1] : null;
}

type ParsedRow = {
  idx: number;
  row: LegacyIrrigationRow;
  errors: string[];
  dupInFile: boolean;
};

function mapRow(r: Record<string, unknown>): { row: LegacyIrrigationRow; errors: string[] } {
  const g = (k: string) => r[k];
  const errors: string[] = [];
  const code = extractCode(g("FARMER_NAME"));
  const receipt = str(g("RECEIPT_NO"));
  const season = str(g("SESSON_YEAR"));
  const paid = num(g("PAID_AMOUNT"));
  const rawDate = g("COLLECTION_DATE");
  const collDate = parseDate(rawDate);

  if (!code) errors.push("ফার্মার কোড নেই (নামের শেষে বন্ধনীতে কোড থাকতে হবে)");
  if (!receipt) errors.push("রশিদ নং নেই");
  if (!season) errors.push("সিজন নেই");
  if (paid == null) errors.push("পরিশোধিত টাকা নেই/ভুল");
  if (rawDate != null && String(rawDate).trim() !== "" && !collDate) errors.push("তারিখ ফরম্যাট ভুল");

  const row: LegacyIrrigationRow = {
    legacy_farmer_code: code,
    farmer_name: str(g("FARMER_NAME")),
    father_name: str(g("FATHER_NM")),
    village: str(g("VILLAGE")),
    mobile_no: str(g("MOBILE_NO")),
    mouza_name: str(g("MOUZA_NAME")),
    season_year: season,
    land_shatak: num(g("LAND")),
    dag_no: str(g("DAG_NO")),
    rate: num(g("RATE")),
    owner_id_name: str(g("OWNER_ID_NM")),
    due_amount: num(g("DUE_AMOUNT")),
    paid_amount: paid,
    owner_type_name: str(g("OWNER_TP_NAME")),
    owner_father_name: str(g("OWNER_FATHER_NM")),
    owner_village: str(g("OWNER_VILLAGE")),
    owner_mobile_no: str(g("OWNER_MOBILE_NO")),
    owner_fid: str(g("OWNER_FID")),
    receipt_no: receipt,
    collection_date: collDate,
  };
  return { row, errors };
}

export default function LegacyIrrigationImport() {
  const { tx } = useLang();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [headerWarnings, setHeaderWarnings] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dupMode, setDupMode] = useState<"skip" | "block">("skip");
  const [skipDbDup, setSkipDbDup] = useState(true);
  const [fileName, setFileName] = useState("");
  const [resumeId, setResumeId] = useState("");
  const [resumeInfo, setResumeInfo] = useState<string | null>(null);
  const [report, setReport] = useState<{ inserted: number; skippedFile: number; skippedDb: string[]; batchId: string } | null>(null);

  // season mapping
  const [seasonNames, setSeasonNames] = useState<Set<string>>(new Set());
  const [seasonOptions, setSeasonOptions] = useState<string[]>([]);
  const [seasonMap, setSeasonMap] = useState<Record<string, string>>({});

  const [batches, setBatches] = useState<LegacyBatch[]>([]);

  const distinctSeasons = useMemo(
    () => Array.from(new Set(parsed.map((p) => p.row.season_year).filter(Boolean) as string[])),
    [parsed],
  );
  const unmatchedSeasons = useMemo(
    () => distinctSeasons.filter((s) => !seasonNames.has(s) && !seasonMap[s]),
    [distinctSeasons, seasonNames, seasonMap],
  );

  function downloadTemplate() {
    const wb = XLSX.utils.book_new();
    const sample: Record<string, unknown> = {
      FARMER_NAME: "মো আকবর আলী(2473)", FATHER_NM: "মো ইয়াসিন আলী", VILLAGE: "পুরাতন কাউন্সিল",
      MOBILE_NO: "1714232228", MOUZA_NAME: "মানপুর", SESSON_YEAR: "আমন-2025", LAND: 34,
      DAG_NO: "159.160.42", RATE: 1300, OWNER_ID_NM: "মো আকবর আলী(2473)", DUE_AMOUNT: "",
      PAID_AMOUNT: 1339, OWNER_TP_NAME: "মালিক", OWNER_FATHER_NM: "", OWNER_VILLAGE: "",
      OWNER_MOBILE_NO: "", OWNER_FID: "", RECEIPT_NO: "1", COLLECTION_DATE: "03-JUL-2025",
    };
    const ws = XLSX.utils.json_to_sheet([sample], { header: COLUMNS });
    XLSX.utils.book_append_sheet(wb, ws, "Data");

    const guide = [
      ["কলাম", "অর্থ", "ফরম্যাট / আবশ্যক"],
      ["FARMER_NAME", "কৃষকের নাম (শেষে বন্ধনীতে কোড)", "আবশ্যক — কোড সহ, যেমন নাম(2473)"],
      ["SESSON_YEAR", "সিজন-বছর", "আবশ্যক — যেমন আমন-2025"],
      ["RECEIPT_NO", "রশিদ নম্বর", "আবশ্যক — ইউনিক"],
      ["PAID_AMOUNT", "পরিশোধিত টাকা", "আবশ্যক — সংখ্যা"],
      ["LAND", "জমি (শতক)", "সংখ্যা"],
      ["RATE", "রেট", "সংখ্যা"],
      ["DUE_AMOUNT", "বকেয়া", "সংখ্যা (ঐচ্ছিক)"],
      ["COLLECTION_DATE", "আদায়ের তারিখ", "03-JUL-2025 বা YYYY-MM-DD"],
      ["OWNER_TP_NAME", "মালিক / বর্গাদার - নাম", "টেক্সট"],
      ["বাকি কলাম", "সহায়ক তথ্য", "ঐচ্ছিক"],
    ];
    const gws = XLSX.utils.aoa_to_sheet(guide);
    gws["!cols"] = [{ wch: 20 }, { wch: 34 }, { wch: 34 }];
    XLSX.utils.book_append_sheet(wb, gws, "Guide");
    XLSX.writeFile(wb, "legacy-irrigation-template.xlsx");
  }

  async function onFile(file: File) {
    setHeaderError(null);
    setHeaderWarnings([]);
    setParsed([]);
    setReport(null);
    setSeasonMap({});
    setFileName(file.name);
    // load seasons for matching (best-effort)
    try {
      const seasons = await SeasonsApi.list();
      const names = new Set<string>();
      const opts: string[] = [];
      for (const s of seasons) {
        if (s.name) { names.add(s.name); opts.push(s.name); }
        if (s.name && s.year) { const combo = `${s.name}-${s.year}`; names.add(combo); opts.push(combo); }
      }
      setSeasonNames(names);
      setSeasonOptions(Array.from(new Set(opts)));
    } catch { /* seasons optional */ }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const isText = /\.(csv|txt|tsv)$/i.test(file.name);
        const wb = isText
          ? XLSX.read(decodeSpreadsheetBuffer(reader.result as ArrayBuffer), { type: "string", raw: true })
          : XLSX.read(reader.result as ArrayBuffer, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
        if (!json.length) { setHeaderError(tx("No rows in file.", "ফাইলে কোনো সারি নেই।")); return; }

        // ── Auto header mapping ──
        const rawHeaders = Object.keys(json[0]);
        const headerMap = new Map<string, string>(); // raw → canonical
        const warnings: string[] = [];
        const mappedCanonicals = new Set<string>();
        for (const h of rawHeaders) {
          const canonical = resolveHeader(h);
          if (canonical) {
            headerMap.set(h, canonical);
            mappedCanonicals.add(canonical);
            if (normHeader(h) !== normHeader(canonical)) {
              warnings.push(tx(`Column "${h}" mapped as "${canonical}"`, `"${h}" কলামটি "${canonical}" হিসেবে ধরা হয়েছে`));
            }
          } else {
            warnings.push(tx(`Column "${h}" not recognized — will be ignored`, `"${h}" কলামটি চেনা যায়নি — উপেক্ষা করা হবে`));
          }
        }
        const missing = REQUIRED_HEADERS.filter((h) => !mappedCanonicals.has(h));
        if (missing.length) {
          setHeaderError(tx(`Required columns missing or unrecognized: ${missing.join(", ")}`, `প্রয়োজনীয় কলাম নেই বা চেনা যায়নি: ${missing.join(", ")}`));
          setHeaderWarnings(warnings);
          return;
        }
        setHeaderWarnings(warnings);

        const seen = new Map<string, number>();
        const rows: ParsedRow[] = json.map((r, i) => {
          const up: Record<string, unknown> = {};
          for (const k of Object.keys(r)) {
            const canonical = headerMap.get(k);
            if (canonical) up[canonical] = r[k];
          }
          const { row, errors } = mapRow(up);
          return { idx: i + 2, row, errors, dupInFile: false };
        });
        // mark within-file receipt duplicates (2nd+ occurrence)
        for (const p of rows) {
          const rn = p.row.receipt_no;
          if (!rn) continue;
          const c = (seen.get(rn) ?? 0) + 1;
          seen.set(rn, c);
          if (c > 1) p.dupInFile = true;
        }
        setParsed(rows);
        toast.success(tx(`${rows.length} rows read`, `${rows.length} সারি পড়া হয়েছে`));
      } catch (e) {
        setHeaderError(e instanceof Error ? e.message : tx("Could not read file.", "ফাইল পড়া যায়নি।"));
      }
    };
    reader.readAsArrayBuffer(file);
  }

  const invalidRows = parsed.filter((p) => p.errors.length > 0);
  const dupRows = parsed.filter((p) => p.dupInFile);
  const cleanRows = parsed.filter((p) => p.errors.length === 0);
  const importableRows = dupMode === "skip"
    ? cleanRows.filter((p) => !p.dupInFile)
    : cleanRows;
  const blockedByDup = dupMode === "block" && dupRows.length > 0;
  const canImport = parsed.length > 0 && importableRows.length > 0 && unmatchedSeasons.length === 0 && !blockedByDup;

  function downloadInvalid() {
    const rows = parsed.filter((p) => p.errors.length > 0 || p.dupInFile);
    if (!rows.length) return;
    const data = rows.map((p) => {
      const issues = [...p.errors];
      if (p.dupInFile) issues.push("ফাইলের মধ্যে ডুপ্লিকেট রশিদ");
      return {
        সারি: p.idx,
        সমস্যা: issues.join("; "),
        FARMER_NAME: p.row.farmer_name ?? "",
        FATHER_NM: p.row.father_name ?? "",
        VILLAGE: p.row.village ?? "",
        MOBILE_NO: p.row.mobile_no ?? "",
        MOUZA_NAME: p.row.mouza_name ?? "",
        SESSON_YEAR: p.row.season_year ?? "",
        LAND: p.row.land_shatak ?? "",
        DAG_NO: p.row.dag_no ?? "",
        RATE: p.row.rate ?? "",
        DUE_AMOUNT: p.row.due_amount ?? "",
        PAID_AMOUNT: p.row.paid_amount ?? "",
        RECEIPT_NO: p.row.receipt_no ?? "",
        COLLECTION_DATE: p.row.collection_date ?? "",
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Invalid");
    XLSX.writeFile(wb, `legacy-irrigation-invalid-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function downloadSkipped() {
    if (!report) return;
    const dbSet = new Set(report.skippedDb);
    const data: Record<string, unknown>[] = [];
    for (const p of parsed) {
      const rn = p.row.receipt_no ?? "";
      const isDb = rn !== "" && dbSet.has(rn);
      const isFile = report.skippedFile > 0 && p.dupInFile;
      if (!isDb && !isFile) continue;
      data.push({
        সারি: p.idx,
        কারণ: isDb ? "ডাটাবেজে একই রশিদ আগে থেকেই আছে" : "ফাইলের মধ্যে ডুপ্লিকেট রশিদ",
        FARMER_NAME: p.row.farmer_name ?? "",
        VILLAGE: p.row.village ?? "",
        MOBILE_NO: p.row.mobile_no ?? "",
        SESSON_YEAR: p.row.season_year ?? "",
        RECEIPT_NO: rn,
        PAID_AMOUNT: p.row.paid_amount ?? "",
        COLLECTION_DATE: p.row.collection_date ?? "",
      });
    }
    if (!data.length) return;
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Skipped");
    XLSX.writeFile(wb, `legacy-irrigation-skipped-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  async function checkResume() {
    const id = resumeId.trim();
    setResumeInfo(null);
    if (!id) return;
    try {
      const s = await LegacyIrrigationApi.batchStatus(id);
      if (!s.exists) { setResumeInfo(tx("Batch ID not found — will run as a new batch.", "এই ব্যাচ আইডি পাওয়া যায়নি — নতুন ব্যাচ হিসেবে চলবে।")); return; }
      const a = s.audit;
      setResumeInfo(
        tx(
          `Status: ${a?.status ?? "—"} • Imported so far: ${s.record_count}` +
            (a?.total_rows ? ` / ${a.total_rows}` : "") +
            `${a?.file_name ? ` • File: ${a.file_name}` : ""}`,
          `স্টেটাস: ${a?.status ?? "—"} • এখন পর্যন্ত ইমপোর্ট: ${s.record_count}` +
            (a?.total_rows ? ` / ${a.total_rows}` : "") +
            `${a?.file_name ? ` • ফাইল: ${a.file_name}` : ""}`,
        ),
      );
      setSkipDbDup(true); // resume: skip already-inserted receipts
      toast.info(tx("Resume mode: existing receipts will be skipped", "রিজিউম মোড: আগে থেকে থাকা রশিদ স্কিপ করা হবে"));
    } catch (e) {
      setResumeInfo(e instanceof ApiError ? e.message : tx("Could not fetch status", "স্টেটাস আনা যায়নি"));
    }
  }

  async function save() {
    if (!canImport) return;
    setSaving(true);
    setProgress(0);
    setReport(null);
    // Resume an interrupted batch with the same id, else start a new one.
    const batchId = resumeId.trim() || crypto.randomUUID();
    const payload = importableRows.map((p) => {
      const sy = p.row.season_year;
      const mapped = sy && seasonMap[sy] ? seasonMap[sy] : sy;
      return { ...p.row, season_year: mapped };
    });
    let inserted = 0;
    const skippedDb: string[] = [];
    try {
      for (let i = 0; i < payload.length; i += CHUNK) {
        const chunk = payload.slice(i, i + CHUNK);
        const isLast = i + CHUNK >= payload.length;
        const res = await LegacyIrrigationApi.import(chunk, {
          batch_id: batchId,
          skip_duplicate_receipts: skipDbDup,
          file_name: fileName || undefined,
          total_rows: payload.length,
          final: isLast,
        });
        inserted += res.inserted;
        skippedDb.push(...res.skipped);
        setProgress(Math.round(((i + chunk.length) / payload.length) * 100));
      }
      setReport({
        inserted,
        skippedFile: dupMode === "skip" ? dupRows.length : 0,
        skippedDb,
        batchId,
      });
      toast.success(tx(`${inserted} rows imported`, `${inserted} সারি ইমপোর্ট হয়েছে`));
      setParsed([]);
      setResumeId("");
      setResumeInfo(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      toast.error(
        e instanceof ApiError
          ? tx(`${e.message} — you can resume with the same batch ID (${batchId}).`, `${e.message} — একই ব্যাচ আইডি (${batchId}) দিয়ে রিজিউম করতে পারেন।`)
          : tx("Import failed", "ইমপোর্ট ব্যর্থ হয়েছে"),
      );
    } finally {
      setSaving(false);
    }
  }



  async function loadBatches() {
    try {
      const res = await LegacyIrrigationApi.batches();
      // Backend may return a raw array or a wrapped/paginated payload; normalise to an array.
      const list = Array.isArray(res) ? res : Array.isArray((res as any)?.data) ? (res as any).data : [];
      setBatches(list);
    } catch { setBatches([]); }
  }
  async function removeBatch(id: string) {
    if (!confirm(tx("Delete this entire batch?", "এই পুরো ব্যাচ মুছে ফেলবেন?"))) return;
    try {
      const res = await LegacyIrrigationApi.deleteBatch(id);
      toast.success(tx(`${res.deleted} rows deleted`, `${res.deleted} সারি মোছা হয়েছে`));
      loadBatches();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : tx("Could not delete", "মোছা যায়নি"));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={tx("Import Legacy Irrigation Data", "পুরনো সেচ ডাটা ইমপোর্ট")} description={tx("Irrigation collection history from the old software (separate table)", "আগের সফটওয়্যারের সেচ কালেকশন হিস্ট্রি (আলাদা টেবিল)")} />

      <Tabs defaultValue="import" onValueChange={(v) => v === "batches" && loadBatches()}>
        <TabsList>
          <TabsTrigger value="import">{tx("Import", "ইমপোর্ট")}</TabsTrigger>
          
          <TabsTrigger value="batches">{tx("Batch Management", "ব্যাচ ব্যবস্থাপনা")}</TabsTrigger>
        </TabsList>

        {/* ── Import tab ── */}
        <TabsContent value="import" className="space-y-4">
          <Card className="p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Label>{tx("Select Excel/CSV file", "Excel/CSV ফাইল নির্বাচন করুন")}</Label>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.txt"
                  className="mt-2 block text-sm"
                  onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {tx("Required columns", "প্রয়োজনীয় কলাম")}: FARMER_NAME, SESSON_YEAR, RECEIPT_NO, PAID_AMOUNT
                </p>
              </div>
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" /> {tx("Download Template", "টেমপ্লেট ডাউনলোড")}
              </Button>
            </div>

            {headerError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{tx("File Problem", "ফাইল সমস্যা")}</AlertTitle>
                <AlertDescription>{headerError}</AlertDescription>
              </Alert>
            )}

            {headerWarnings.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{tx("Column Mapping Warning", "কলাম ম্যাপিং সতর্কতা")}</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4 space-y-0.5 text-xs">
                    {headerWarnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {parsed.length > 0 && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{tx("Total", "মোট")}: {parsed.length}</Badge>
                    <Badge variant="default">{tx("Valid", "সঠিক")}: {cleanRows.length}</Badge>
                    {invalidRows.length > 0 && <Badge variant="destructive">{tx("With issues", "সমস্যাযুক্ত")}: {invalidRows.length}</Badge>}
                    {dupRows.length > 0 && <Badge variant="outline">{tx("Duplicate receipts", "ডুপ্লিকেট রশিদ")}: {dupRows.length}</Badge>}
                  </div>
                  {(invalidRows.length > 0 || dupRows.length > 0) && (
                    <Button variant="outline" size="sm" onClick={downloadInvalid}>
                      <Download className="h-4 w-4 mr-2" /> {tx("Problem Rows Report", "সমস্যাযুক্ত রো রিপোর্ট")}
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>{tx("If duplicate receipts within the file", "ফাইলের মধ্যে ডুপ্লিকেট রশিদ হলে")}</Label>
                  <RadioGroup value={dupMode} onValueChange={(v) => setDupMode(v as "skip" | "block")} className="flex gap-6">
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="skip" id="dm-skip" />
                      <Label htmlFor="dm-skip" className="font-normal">{tx("Skip (keep the first)", "স্কিপ করুন (প্রথমটি রাখা হবে)")}</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="block" id="dm-block" />
                      <Label htmlFor="dm-block" className="font-normal">{tx("Block import", "ইমপোর্ট ব্লক করুন")}</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox id="dbdup" checked={skipDbDup} onCheckedChange={(v) => setSkipDbDup(!!v)} />
                  <Label htmlFor="dbdup" className="font-normal">{tx("Skip receipt numbers already in the database", "ডাটাবেজে আগে থেকে থাকা রশিদ নম্বর স্কিপ করুন")}</Label>
                </div>

                <div className="space-y-2 border-t pt-3">
                  <Label htmlFor="resume">{tx("Resume a stopped batch (optional — enter batch ID)", "থেমে যাওয়া ব্যাচ রিজিউম (ঐচ্ছিক — ব্যাচ আইডি দিন)")}</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      id="resume"
                      value={resumeId}
                      onChange={(e) => setResumeId(e.target.value)}
                      placeholder={tx("Batch ID (UUID)", "ব্যাচ আইডি (UUID)")}
                      className="max-w-xs font-mono text-xs"
                    />
                    <Button variant="outline" size="sm" onClick={checkResume} disabled={!resumeId.trim()}>
                      {tx("View Status", "স্টেটাস দেখুন")}
                    </Button>
                  </div>
                  {resumeInfo && <p className="text-xs text-muted-foreground">{resumeInfo}</p>}
                </div>
              </>
            )}
          </Card>

          {/* Season mapping */}
          {unmatchedSeasons.length > 0 && (
            <Card className="p-4 space-y-3">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{tx("Season Not Matched", "সিজন ম্যাচ হয়নি")}</AlertTitle>
                <AlertDescription>{tx("The seasons below are not in the system. Select the correct season for each, or keep the original text.", "নিচের সিজনগুলো সিস্টেমে নেই। প্রতিটির জন্য সঠিক সিজন নির্বাচন করুন অথবা মূল লেখা রাখুন।")}</AlertDescription>
              </Alert>
              {unmatchedSeasons.map((s) => (
                <div key={s} className="flex items-center gap-3">
                  <span className="min-w-32 text-sm font-medium">{s}</span>
                  <Select value={seasonMap[s] ?? ""} onValueChange={(v) => setSeasonMap((m) => ({ ...m, [s]: v }))}>
                    <SelectTrigger className="max-w-xs"><SelectValue placeholder={tx("Select season", "সিজন নির্বাচন করুন")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={s}>{tx("Keep original text", "মূল লেখা রাখুন")} ({s})</SelectItem>
                      {seasonOptions.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </Card>
          )}

          {/* Per-row validation errors */}
          {invalidRows.length > 0 && (
            <Card className="p-0 overflow-x-auto">
              <div className="p-3 text-sm font-medium text-destructive">{tx("Problem rows", "সমস্যাযুক্ত সারি")} ({invalidRows.length}) — {tx("fix and upload again", "ঠিক করে আবার আপলোড করুন")}</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tx("Row", "সারি")}</TableHead>
                    <TableHead>{tx("Name", "নাম")}</TableHead>
                    <TableHead>{tx("Receipt", "রশিদ")}</TableHead>
                    <TableHead>{tx("Issue", "সমস্যা")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invalidRows.slice(0, 50).map((p) => (
                    <TableRow key={p.idx}>
                      <TableCell>{p.idx}</TableCell>
                      <TableCell>{p.row.farmer_name ?? "—"}</TableCell>
                      <TableCell>{p.row.receipt_no ?? "—"}</TableCell>
                      <TableCell className="text-destructive text-xs">{p.errors.join("; ")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {invalidRows.length > 50 && <p className="text-xs text-muted-foreground p-3">{tx("Showing first 50.", "প্রথম ৫০টি দেখানো হয়েছে।")}</p>}
            </Card>
          )}

          {/* Import action + progress */}
          {parsed.length > 0 && (
            <Card className="p-4 space-y-3">
              {blockedByDup && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{tx('Import is blocked due to duplicate receipts. Choose "Skip" or fix the file.', 'ডুপ্লিকেট রশিদ থাকায় ইমপোর্ট ব্লক করা হয়েছে। "স্কিপ" নির্বাচন করুন বা ফাইল ঠিক করুন।')}</AlertDescription>
                </Alert>
              )}
              <div className="flex items-center gap-3">
                <Button onClick={save} disabled={!canImport || saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                  {tx(`Import ${importableRows.length} rows`, `${importableRows.length} সারি ইমপোর্ট করুন`)}
                </Button>
              </div>
              {saving && (
                <div className="space-y-1">
                  <Progress value={progress} />
                  <p className="text-xs text-muted-foreground">{progress}%</p>
                </div>
              )}
            </Card>
          )}

          {/* Batch report */}
          {report && (
            <Card className="p-4 space-y-2">
              <div className="font-medium">{tx("Import Report", "ইমপোর্ট রিপোর্ট")}</div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="default">{tx("Imported", "ইমপোর্ট হয়েছে")}: {report.inserted}</Badge>
                {report.skippedFile > 0 && <Badge variant="outline">{tx("File duplicates skipped", "ফাইল ডুপ্লিকেট স্কিপ")}: {report.skippedFile}</Badge>}
                {report.skippedDb.length > 0 && <Badge variant="outline">{tx("DB duplicates skipped", "ডাটাবেজ ডুপ্লিকেট স্কিপ")}: {report.skippedDb.length}</Badge>}
                <Badge variant="secondary">{tx("Batch", "ব্যাচ")}: {report.batchId.slice(0, 8)}…</Badge>
              </div>
              {(report.skippedDb.length > 0 || report.skippedFile > 0) && (
                <div className="space-y-2">
                  {report.skippedDb.length > 0 && (
                    <p className="text-xs text-muted-foreground">{tx("Skipped receipts", "স্কিপ হওয়া রশিদ")}: {report.skippedDb.slice(0, 30).join(", ")}{report.skippedDb.length > 30 ? " …" : ""}</p>
                  )}
                  <Button variant="outline" size="sm" onClick={downloadSkipped}>
                    {tx("Skipped Rows Report (Excel)", "স্কিপ হওয়া রো রিপোর্ট (Excel)")}
                  </Button>
                </div>
              )}
            </Card>
          )}
        </TabsContent>



        {/* ── Batches tab ── */}
        <TabsContent value="batches" className="space-y-4">
          <Card className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tx("Batch ID", "ব্যাচ আইডি")}</TableHead>
                  <TableHead>{tx("File", "ফাইল")}</TableHead>
                  <TableHead>{tx("Imported by", "ইমপোর্ট করেছেন")}</TableHead>
                  <TableHead>{tx("Rows", "সারি")}</TableHead>
                  <TableHead>{tx("Skipped", "স্কিপ")}</TableHead>
                  <TableHead>{tx("Status", "স্টেটাস")}</TableHead>
                  <TableHead>{tx("Date", "তারিখ")}</TableHead>
                  <TableHead className="text-right">{tx("Action", "অ্যাকশন")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(Array.isArray(batches) ? batches : []).map((b) => (
                  <TableRow key={b.import_batch_id}>
                    <TableCell className="font-mono text-xs">{b.import_batch_id.slice(0, 8)}…</TableCell>
                    <TableCell className="max-w-40 truncate">{b.file_name ?? "—"}</TableCell>
                    <TableCell>{b.user_name ?? "—"}</TableCell>
                    <TableCell>{b.count}{b.total_rows ? ` / ${b.total_rows}` : ""}</TableCell>
                    <TableCell>{b.skipped ?? "—"}</TableCell>
                    <TableCell>
                      {b.status === "completed"
                        ? <Badge variant="default">{tx("Completed", "সম্পন্ন")}</Badge>
                        : b.status
                          ? <Badge variant="outline">{tx("In progress", "চলমান")}</Badge>
                          : "—"}
                    </TableCell>
                    <TableCell>{b.created_at?.slice(0, 19).replace("T", " ")}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => removeBatch(b.import_batch_id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {batches.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">{tx("No batches", "কোনো ব্যাচ নেই")}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
