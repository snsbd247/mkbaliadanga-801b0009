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
import { Upload, Loader2, AlertTriangle, Search, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import { decodeSpreadsheetBuffer } from "@/lib/csvDecode";
import {
  LegacyIrrigationApi, LegacyIrrigationRow, LegacyIrrigationRecord, LegacyBatch,
} from "@/lib/api/legacyIrrigation";
import { SeasonsApi } from "@/lib/api/catalog";
import { ApiError } from "@/lib/api/client";

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
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dupMode, setDupMode] = useState<"skip" | "block">("skip");
  const [skipDbDup, setSkipDbDup] = useState(true);
  const [report, setReport] = useState<{ inserted: number; skippedFile: number; skippedDb: string[]; batchId: string } | null>(null);

  // season mapping
  const [seasonNames, setSeasonNames] = useState<Set<string>>(new Set());
  const [seasonOptions, setSeasonOptions] = useState<string[]>([]);
  const [seasonMap, setSeasonMap] = useState<Record<string, string>>({});

  // search tab
  const [code, setCode] = useState("");
  const [records, setRecords] = useState<LegacyIrrigationRecord[]>([]);
  const [searching, setSearching] = useState(false);
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
    setParsed([]);
    setReport(null);
    setSeasonMap({});
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
        if (!json.length) { setHeaderError("ফাইলে কোনো সারি নেই।"); return; }
        const headers = Object.keys(json[0]).map((h) => h.trim().toUpperCase());
        const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
        if (missing.length) { setHeaderError(`প্রয়োজনীয় কলাম নেই: ${missing.join(", ")}`); return; }

        const seen = new Map<string, number>();
        const rows: ParsedRow[] = json.map((r, i) => {
          const up: Record<string, unknown> = {};
          for (const k of Object.keys(r)) up[k.trim().toUpperCase()] = r[k];
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
        toast.success(`${rows.length} সারি পড়া হয়েছে`);
      } catch (e) {
        setHeaderError(e instanceof Error ? e.message : "ফাইল পড়া যায়নি।");
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

  async function save() {
    if (!canImport) return;
    setSaving(true);
    setProgress(0);
    setReport(null);
    const batchId = crypto.randomUUID();
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
        const res = await LegacyIrrigationApi.import(chunk, {
          batch_id: batchId,
          skip_duplicate_receipts: skipDbDup,
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
      toast.success(`${inserted} সারি ইমপোর্ট হয়েছে`);
      setParsed([]);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "ইমপোর্ট ব্যর্থ হয়েছে");
    } finally {
      setSaving(false);
    }
  }

  async function doSearch() {
    if (!code.trim()) return;
    setSearching(true);
    try {
      const rows = await LegacyIrrigationApi.list({ farmer_code: code.trim() });
      setRecords(rows);
      if (!rows.length) toast.info("এই কোডে কোনো রেকর্ড পাওয়া যায়নি");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "সার্চ ব্যর্থ হয়েছে");
    } finally {
      setSearching(false);
    }
  }
  async function loadBatches() {
    try { setBatches(await LegacyIrrigationApi.batches()); } catch { /* ignore */ }
  }
  async function removeBatch(id: string) {
    if (!confirm("এই পুরো ব্যাচ মুছে ফেলবেন?")) return;
    try {
      const res = await LegacyIrrigationApi.deleteBatch(id);
      toast.success(`${res.deleted} সারি মোছা হয়েছে`);
      loadBatches();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "মোছা যায়নি");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="পুরনো সেচ ডাটা ইমপোর্ট" description="আগের সফটওয়্যারের সেচ কালেকশন হিস্ট্রি (আলাদা টেবিল)" />

      <Tabs defaultValue="import" onValueChange={(v) => v === "batches" && loadBatches()}>
        <TabsList>
          <TabsTrigger value="import">ইমপোর্ট</TabsTrigger>
          <TabsTrigger value="search">কৃষক খুঁজুন</TabsTrigger>
          <TabsTrigger value="batches">ব্যাচ ব্যবস্থাপনা</TabsTrigger>
        </TabsList>

        {/* ── Import tab ── */}
        <TabsContent value="import" className="space-y-4">
          <Card className="p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Label>Excel/CSV ফাইল নির্বাচন করুন</Label>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.txt"
                  className="mt-2 block text-sm"
                  onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  প্রয়োজনীয় কলাম: FARMER_NAME, SESSON_YEAR, RECEIPT_NO, PAID_AMOUNT
                </p>
              </div>
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" /> টেমপ্লেট ডাউনলোড
              </Button>
            </div>

            {headerError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>ফাইল সমস্যা</AlertTitle>
                <AlertDescription>{headerError}</AlertDescription>
              </Alert>
            )}

            {parsed.length > 0 && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">মোট: {parsed.length}</Badge>
                  <Badge variant="default">সঠিক: {cleanRows.length}</Badge>
                  {invalidRows.length > 0 && <Badge variant="destructive">সমস্যাযুক্ত: {invalidRows.length}</Badge>}
                  {dupRows.length > 0 && <Badge variant="outline">ডুপ্লিকেট রশিদ: {dupRows.length}</Badge>}
                </div>

                <div className="space-y-2">
                  <Label>ফাইলের মধ্যে ডুপ্লিকেট রশিদ হলে</Label>
                  <RadioGroup value={dupMode} onValueChange={(v) => setDupMode(v as "skip" | "block")} className="flex gap-6">
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="skip" id="dm-skip" />
                      <Label htmlFor="dm-skip" className="font-normal">স্কিপ করুন (প্রথমটি রাখা হবে)</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="block" id="dm-block" />
                      <Label htmlFor="dm-block" className="font-normal">ইমপোর্ট ব্লক করুন</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox id="dbdup" checked={skipDbDup} onCheckedChange={(v) => setSkipDbDup(!!v)} />
                  <Label htmlFor="dbdup" className="font-normal">ডাটাবেজে আগে থেকে থাকা রশিদ নম্বর স্কিপ করুন</Label>
                </div>
              </>
            )}
          </Card>

          {/* Season mapping */}
          {unmatchedSeasons.length > 0 && (
            <Card className="p-4 space-y-3">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>সিজন ম্যাচ হয়নি</AlertTitle>
                <AlertDescription>নিচের সিজনগুলো সিস্টেমে নেই। প্রতিটির জন্য সঠিক সিজন নির্বাচন করুন অথবা মূল লেখা রাখুন।</AlertDescription>
              </Alert>
              {unmatchedSeasons.map((s) => (
                <div key={s} className="flex items-center gap-3">
                  <span className="min-w-32 text-sm font-medium">{s}</span>
                  <Select value={seasonMap[s] ?? ""} onValueChange={(v) => setSeasonMap((m) => ({ ...m, [s]: v }))}>
                    <SelectTrigger className="max-w-xs"><SelectValue placeholder="সিজন নির্বাচন করুন" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={s}>মূল লেখা রাখুন ({s})</SelectItem>
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
              <div className="p-3 text-sm font-medium text-destructive">সমস্যাযুক্ত সারি ({invalidRows.length}) — ঠিক করে আবার আপলোড করুন</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>সারি</TableHead>
                    <TableHead>নাম</TableHead>
                    <TableHead>রশিদ</TableHead>
                    <TableHead>সমস্যা</TableHead>
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
              {invalidRows.length > 50 && <p className="text-xs text-muted-foreground p-3">প্রথম ৫০টি দেখানো হয়েছে।</p>}
            </Card>
          )}

          {/* Import action + progress */}
          {parsed.length > 0 && (
            <Card className="p-4 space-y-3">
              {blockedByDup && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>ডুপ্লিকেট রশিদ থাকায় ইমপোর্ট ব্লক করা হয়েছে। "স্কিপ" নির্বাচন করুন বা ফাইল ঠিক করুন।</AlertDescription>
                </Alert>
              )}
              <div className="flex items-center gap-3">
                <Button onClick={save} disabled={!canImport || saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                  {importableRows.length} সারি ইমপোর্ট করুন
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
              <div className="font-medium">ইমপোর্ট রিপোর্ট</div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="default">ইমপোর্ট হয়েছে: {report.inserted}</Badge>
                {report.skippedFile > 0 && <Badge variant="outline">ফাইল ডুপ্লিকেট স্কিপ: {report.skippedFile}</Badge>}
                {report.skippedDb.length > 0 && <Badge variant="outline">ডাটাবেজ ডুপ্লিকেট স্কিপ: {report.skippedDb.length}</Badge>}
                <Badge variant="secondary">ব্যাচ: {report.batchId.slice(0, 8)}…</Badge>
              </div>
              {report.skippedDb.length > 0 && (
                <p className="text-xs text-muted-foreground">স্কিপ হওয়া রশিদ: {report.skippedDb.slice(0, 30).join(", ")}{report.skippedDb.length > 30 ? " …" : ""}</p>
              )}
            </Card>
          )}
        </TabsContent>

        {/* ── Search tab ── */}
        <TabsContent value="search" className="space-y-4">
          <Card className="p-4">
            <div className="flex items-end gap-2">
              <div className="flex-1 max-w-xs">
                <Label>ফার্মার কোড</Label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && doSearch()}
                  placeholder="যেমন 2473"
                  className="mt-2"
                />
              </div>
              <Button onClick={doSearch} disabled={searching}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                খুঁজুন
              </Button>
            </div>
          </Card>

          {records.length > 0 && (
            <Card className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>সিজন</TableHead>
                    <TableHead>মৌজা</TableHead>
                    <TableHead>দাগ</TableHead>
                    <TableHead>জমি</TableHead>
                    <TableHead>রেট</TableHead>
                    <TableHead>মালিক/বর্গা</TableHead>
                    <TableHead>রশিদ</TableHead>
                    <TableHead>পরিশোধ</TableHead>
                    <TableHead>তারিখ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.season_year ?? "—"}</TableCell>
                      <TableCell>{r.mouza_name ?? "—"}</TableCell>
                      <TableCell>{r.dag_no ?? "—"}</TableCell>
                      <TableCell>{r.land_shatak ?? "—"}</TableCell>
                      <TableCell>{r.rate ?? "—"}</TableCell>
                      <TableCell>{r.owner_type_name ?? "—"}</TableCell>
                      <TableCell>{r.receipt_no ?? "—"}</TableCell>
                      <TableCell>{r.paid_amount ?? "—"}</TableCell>
                      <TableCell>{r.collection_date ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* ── Batches tab ── */}
        <TabsContent value="batches" className="space-y-4">
          <Card className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ব্যাচ আইডি</TableHead>
                  <TableHead>সারি সংখ্যা</TableHead>
                  <TableHead>তারিখ</TableHead>
                  <TableHead className="text-right">অ্যাকশন</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((b) => (
                  <TableRow key={b.import_batch_id}>
                    <TableCell className="font-mono text-xs">{b.import_batch_id.slice(0, 8)}…</TableCell>
                    <TableCell>{b.count}</TableCell>
                    <TableCell>{b.created_at?.slice(0, 19).replace("T", " ")}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => removeBatch(b.import_batch_id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {batches.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">কোনো ব্যাচ নেই</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
