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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Upload, Download, AlertTriangle, Loader2, CheckCircle2, FileWarning, ArrowRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { decodeSpreadsheetBuffer } from "@/lib/csvDecode";
import { normalizeFarmerCode } from "@/lib/farmerCode";
import { useLang } from "@/i18n/LanguageProvider";
import { analyzeDagNo, parseDagNumbers } from "@/lib/dagParser";

/**
 * Bulk Lands Import wizard — owner-cultivated + barga (sharecropper) lands.
 * Steps: 1) Instructions & template  2) Upload & column mapping
 *        3) Preview & validation     4) Save & summary
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

// Bump when template columns/rules change so users can detect stale headers.
export const LANDS_TEMPLATE_VERSION = "2026.07.01";
// Bump on every LandsImport code change so testers can confirm the deployed build.
export const LANDS_IMPORT_BUILD = "2026.07.01.2";

const COLUMNS = [
  "owner_farmer_id", "land_ref", "mouza", "dag_no", "land_type",
  "land_size", "owner_type", "sharecropper_id", "borga_area", "share_percentage", "note",
] as const;
type ColKey = (typeof COLUMNS)[number];

const REQUIRED_COLS: ColKey[] = ["owner_farmer_id", "land_size"];

const COL_LABELS: Record<ColKey, string> = {
  owner_farmer_id: "মালিকের Farmer ID *",
  land_ref: "land_ref (একই জমির রেফ)",
  mouza: "মৌজা",
  dag_no: "দাগ নং",
  land_type: "জমির ধরন (উচু/নিচু/মাঝারি/পুকুর ইত্যাদি)",
  land_size: "জমির পরিমাণ (শতক) *",
  owner_type: "own / borga",
  sharecropper_id: "বর্গাদার Farmer ID",
  borga_area: "বর্গা area (শতক)",
  share_percentage: "share %",
  note: "মন্তব্য",
};

/** Bilingual per-column help for the template preview. */
const COL_HELP: Record<ColKey, { required: boolean; bn: string; en: string; sample: string }> = {
  owner_farmer_id: { required: true, bn: "মালিকের Farmer ID (যেমন 00001)", en: "Owner's Farmer ID (e.g. 00001)", sample: "00001" },
  land_ref: { required: false, bn: "একই জমিতে একাধিক বর্গাদার দিতে একই ref দিন", en: "Same ref groups multiple sharecroppers on one plot", sample: "L2" },
  mouza: { required: false, bn: "মৌজার নাম", en: "Mouza name", sample: "Mouza A" },
  dag_no: { required: false, bn: "দাগ নং — একাধিক হলে কমা দিয়ে", en: "Dag no — comma-separate multiple", sample: "12,15" },
  land_type: { required: false, bn: "জমির ধরন — উচু/নিচু/মাঝারি বা পুকুর/সবজি/বাগান (land_types এর code বা নাম)", en: "Land type — high/low/medium or pond/vegetable/garden (land_types code or name)", sample: "উচু" },
  land_size: { required: true, bn: "জমির পরিমাণ (শতক), . এর পর ৪ ডিজিট", en: "Land size (shotok), 4 decimals", sample: "33.0000" },
  owner_type: { required: false, bn: "own / borga (ডিফল্ট own)", en: "own / borga (default own)", sample: "own" },
  sharecropper_id: { required: false, bn: "borga হলে বর্গাদারের Farmer ID", en: "Sharecropper's Farmer ID if borga", sample: "00003" },
  borga_area: { required: false, bn: "বর্গাদারকে দেয়া শতক", en: "Shotok given to sharecropper", sample: "20.0000" },
  share_percentage: { required: false, bn: "borga_area না দিলে শতাংশ (০-১০০)", en: "Share % if borga_area empty (0-100)", sample: "30" },
  note: { required: false, bn: "মন্তব্য", en: "Note", sample: "" },
};



const FIELD_TYPE_MAP: Record<string, string> = {
  "উচু": "high_land", "উঁচু": "high_land", "high": "high_land", "high_land": "high_land",
  "নিচু": "low_land", "low": "low_land", "low_land": "low_land",
  "মাঝারি": "medium_land", "medium": "medium_land", "medium_land": "medium_land",
  "অন্যান্য": "other", "other": "other",
};

/** Derive the DB field_type enum from a single land_type value (উচু/নিচু/মাঝারি → high/low/medium).
 * Tolerant of suffixes/prefixes like "উঁচু জমি", "নিচু জমি", "high land". */
export function deriveFieldType(landType: unknown): string {
  const raw = String(landType ?? "").trim();
  const key = raw.toLowerCase();
  // Exact match first (fast path).
  const exact = FIELD_TYPE_MAP[key] ?? FIELD_TYPE_MAP[raw];
  if (exact) return exact;
  // Substring match so values like "উঁচু জমি" / "নিচু জমি" / "high land" resolve.
  if (/উঁচু|উচু|high/i.test(raw)) return "high_land";
  if (/নিচু|নীচু|low/i.test(raw)) return "low_land";
  if (/মাঝারি|মধ্যম|medium/i.test(raw)) return "medium_land";
  return "medium_land";
}


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

/** Parse the first sheet into header list + raw record rows (keys = original headers). */
function parseSheet(wb: XLSX.WorkBook): { headers: string[]; records: Record<string, any>[] } {
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" }) as any[][];
  if (rows.length === 0) return { headers: [], records: [] };
  const headers = (rows[0] as any[]).map((h) => String(h ?? "").trim()).filter(Boolean);
  const records = rows.slice(1)
    .filter((r) => (r as any[]).some((c) => String(c ?? "").trim() !== ""))
    .map((r) => {
      const rec: Record<string, any> = {};
      headers.forEach((h, i) => { rec[h] = (r as any[])[i] ?? ""; });
      return rec;
    });
  return { headers, records };
}

/** Accepted header aliases (BN + EN) per canonical column, normalized. */
const COL_ALIASES: Record<ColKey, string[]> = {
  owner_farmer_id: ["owner_farmer_id", "মালিকের_farmer_id", "মালিক_id", "owner_id", "মালিক"],
  land_ref: ["land_ref", "জমির_রেফ", "রেফ", "ref"],
  mouza: ["mouza", "মৌজা"],
  dag_no: ["dag_no", "দাগ_নং", "দাগ", "dag"],
  land_type: ["land_type", "জমির_ধরন", "ধরন", "field_type", "উচু/নিচু/মাঝারি", "উচু_নিচু_মাঝারি", "field"],
  land_size: ["land_size", "জমির_পরিমাণ", "পরিমাণ", "শতক", "size"],
  owner_type: ["owner_type", "own_borga", "own/borga", "মালিকানা"],
  sharecropper_id: ["sharecropper_id", "বর্গাদার_farmer_id", "বর্গাদার_id", "borgadar_id", "বর্গাদার"],
  borga_area: ["borga_area", "বর্গা_area", "বর্গা_শতক", "borga_shotok"],
  share_percentage: ["share_percentage", "share_%", "share_percent", "শতাংশ", "share"],
  note: ["note", "মন্তব্য", "নোট", "comment"],
};

/** Resolve one uploaded header to a canonical column, or null if unknown. */
function resolveHeader(header: string): ColKey | null {
  const norm = normalizeKey(header);
  for (const col of COLUMNS) {
    if (col === norm) return col;
    if (COL_ALIASES[col].some((a) => normalizeKey(a) === norm)) return col;
  }
  return null;
}

/** Auto-guess mapping from file headers to expected columns (BN+EN aware). */
function autoMap(headers: string[]): Record<ColKey, string> {
  const map = {} as Record<ColKey, string>;
  for (const col of COLUMNS) map[col] = "";
  for (const h of headers) {
    const col = resolveHeader(h);
    if (col && !map[col]) map[col] = h;
  }
  return map;
}

/** Strict schema check: unknown headers + missing required columns. */
function checkSchema(headers: string[]): { unknown: string[]; missingRequired: ColKey[] } {
  const unknown = headers.filter((h) => resolveHeader(h) === null);
  const present = new Set(headers.map(resolveHeader).filter(Boolean) as ColKey[]);
  const missingRequired = REQUIRED_COLS.filter((c) => !present.has(c));
  return { unknown, missingRequired };
}

const num = (v: unknown): number => {
  const x = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(x) ? x : 0;
};
const round4 = (v: number) => Math.round(v * 10000) / 10000;
const isBorgaType = (v: unknown) =>
  ["borga", "borgadar", "বর্গা", "বর্গাদার", "share", "sharecrop"].includes(String(v ?? "").trim().toLowerCase());

// Season names must never be used as land_type — seasons belong to invoice import.
export const looksLikeSeason = (v: unknown): boolean => {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return false;
  // Bengali season keywords + English equivalents (aman/iri/boro/aus/robi)
  return /(আমন|ইরি|বোরো|আউশ|রবি|aman|iri|boro|aus|robi)/i.test(s);
};

/** Bilingual labels for error categories shown in the summary panel. */
export const ERROR_CATEGORY_LABELS: Record<string, { en: string; bn: string }> = {
  season_as_land_type: { en: "Season name used in land_type (seasons belong to invoice import)", bn: "land_type-এ সিজনের নাম (সিজন ইনভয়েস ইমপোর্টে)" },
  owner: { en: "Owner Farmer ID missing/invalid/not found", bn: "মালিকের Farmer ID নেই/ভুল/পাওয়া যায়নি" },
  sharecropper: { en: "Sharecropper Farmer ID issue", bn: "বর্গাদার Farmer ID সমস্যা" },
  land_size: { en: "Land size missing or invalid", bn: "জমির পরিমাণ নেই বা ভুল" },
  borga: { en: "Borga area / share % / land_ref issue", bn: "বর্গা area / share % / land_ref সমস্যা" },
  field_type: { en: "field_type derivation issue", bn: "field_type ডেরিভেশন সমস্যা" },
  other: { en: "Other validation issue", bn: "অন্যান্য যাচাই সমস্যা" },
};

/** Group row error messages into human-readable categories for the summary panel. */
export function categorizeErrors(rows: { errorMsg: string | null }[]): { key: string; count: number }[] {
  const buckets: Record<string, number> = {};
  for (const r of rows) {
    if (!r.errorMsg) continue;
    for (const part of r.errorMsg.split(";").map((p) => p.trim()).filter(Boolean)) {
      let key = "other";
      if (/land_type:.*সিজন|season/i.test(part)) key = "season_as_land_type";
      else if (/owner_farmer_id/i.test(part)) key = "owner";
      else if (/sharecropper_id/i.test(part)) key = "sharecropper";
      else if (/land_size/i.test(part)) key = "land_size";
      else if (/borga_area|share_percentage|land_ref/i.test(part)) key = "borga";
      else if (/field_type/i.test(part)) key = "field_type";
      buckets[key] = (buckets[key] ?? 0) + 1;
    }
  }
  return Object.entries(buckets).map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
}



export default function LandsImport() {
  const { officeId, user } = useAuth();
  const { tx } = useLang();
  const STEPS = [
    tx("Instructions", "নির্দেশনা"),
    tx("Upload & Mapping", "আপলোড ও ম্যাপিং"),
    tx("Preview & Validate", "প্রিভিউ ও যাচাই"),
    tx("Save & Summary", "সংরক্ষণ ও সারসংক্ষেপ"),
  ];
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [records, setRecords] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<Record<ColKey, string>>({} as Record<ColKey, string>);
  const [rows, setRows] = useState<RowState[]>([]);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [summary, setSummary] = useState<{ processed: number; inserted: number; failed: number } | null>(null);

  useEffect(() => {
    document.title = "জমি ইমপোর্ট — Lands Import";
  }, []);

  /** Record a download event in the import audit log (best-effort). */
  async function logDownload(kind: string, format: "xlsx" | "csv") {
    try {
      await db.from("import_audit_logs").insert({
        user_id: user?.id ?? null,
        office_id: officeId ?? null,
        module: "lands",
        mode: "download",
        summary: { kind, format, at: new Date().toISOString() },
      });
    } catch {
      /* non-blocking */
    }
  }

  function downloadTemplate(format: "xlsx" | "csv") {
    const cols = [...COLUMNS];
    const sample = [
      ["00001", "L1", "Mouza A", "12,15", "উচু", "33.0000", "own", "", "", "", "মালিক নিজে চাষ"],
      ["00002", "L2", "Mouza A", "30", "নিচু", "50.0000", "borga", "00003", "20.0000", "", "বর্গাদার ২০ শতক"],
      ["00002", "L2", "Mouza A", "30", "পুকুর", "50.0000", "borga", "00004", "", "30", "একই জমিতে ২য় বর্গাদার (একই land_ref)"],

    ];
    if (format === "csv") {
      const csv = [cols, ...sample]
        .map((r) => r.map((v) => /[",\n]/.test(String(v ?? "")) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? "")).join(","))
        .join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "lands-import-template.csv"; a.click();
      URL.revokeObjectURL(url);
      toast.success("টেমপ্লেট ডাউনলোড হয়েছে: lands-import-template.csv");
      logDownload("template", "csv");
      return;
    }
    const ws = XLSX.utils.aoa_to_sheet([cols, ...sample]);
    const notes = XLSX.utils.aoa_to_sheet([
      ["template_version", LANDS_TEMPLATE_VERSION, ""],
      ["Column", "Required", "Notes"],
      ["owner_farmer_id", "Yes", "মালিকের Farmer ID (যেমন 00001)"],
      ["land_ref", "No", "একই জমিতে একাধিক বর্গাদার দিতে একই ref ব্যবহার করুন (যেমন L2)। খালি হলে প্রতি সারি আলাদা জমি।"],
      ["mouza", "No", "মৌজার নাম — থাকলে mouza_id রিসলভ হবে"],
      ["dag_no", "No", "দাগ নং — একাধিক হলে কমা দিয়ে: 12,15,30"],
      ["land_type", "No", "জমির ধরন — উচু/নিচু/মাঝারি বা পুকুর/সবজি/বাগান (land_types এর code বা নাম)। সিজন নয় — সিজন আসবে ইনভয়েস ইমপোর্টে।"],
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
    toast.success("টেমপ্লেট ডাউনলোড হয়েছে: lands-import-template.xlsx");
    logDownload("template", "xlsx");
  }

  /** Ready-to-fill sample with dummy farmer+land data (no season — season belongs to invoice import). */
  function downloadSample(format: "xlsx" | "csv") {
    const cols = [...COLUMNS];
    const rows = [
      ["00001", "L1", "Boaliadanga", "12,15", "উচু", "33.0000", "own", "", "", "", "মালিক নিজে চাষ"],
      ["00002", "L2", "Boaliadanga", "18", "নিচু", "50.0000", "borga", "00003", "20.0000", "", "বর্গাদার ২০ শতক"],
      ["00002", "L2", "Boaliadanga", "18", "নিচু", "50.0000", "borga", "00004", "", "30", "একই জমিতে ২য় বর্গাদার (share %)"],
      ["00005", "L3", "Baliadanga", "22,23", "মাঝারি", "66.5000", "own", "", "", "", "মালিক নিজে চাষ"],
      ["00006", "L4", "Baliadanga", "40", "উচু", "45.0000", "borga", "00007", "45.0000", "", "সম্পূর্ণ জমি বর্গা"],
      ["00008", "L5", "Baliadanga", "51", "সবজি", "12.7500", "own", "", "", "", "সবজি জমি"],
    ];
    const filename = "lands-import-sample";
    if (format === "csv") {
      const csv = [cols, ...rows]
        .map((r) => r.map((v) => /[",\n]/.test(String(v ?? "")) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? "")).join(","))
        .join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${filename}.csv`; a.click();
      URL.revokeObjectURL(url);
      toast.success("স্যাম্পল ডাউনলোড হয়েছে: lands-import-sample.csv");
      logDownload("sample", "csv");
      return;
    }
    const ws = XLSX.utils.aoa_to_sheet([cols, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Lands");
    XLSX.writeFile(wb, `${filename}.xlsx`);
    toast.success("স্যাম্পল ডাউনলোড হয়েছে: lands-import-sample.xlsx");
    logDownload("sample", "xlsx");
  }

  async function handleFile(f: File | null) {
    if (!f) return;
    try {
      const wb = await readBookFromFile(f);
      const { headers: hdrs, records: recs } = parseSheet(wb);
      if (recs.length === 0) { toast.error("ফাইলে কোনো ডেটা নেই।"); return; }

      // Strict schema validation: reject unknown / mismatched column names.
      const { unknown, missingRequired } = checkSchema(hdrs);
      if (unknown.length) {
        toast.error(
          `অজানা কলাম শিরোনাম (টেমপ্লেটের সাথে মিলছে না): ${unknown.join(", ")} — টেমপ্লেট ডাউনলোড করে সঠিক হেডার ব্যবহার করুন।`,
          { duration: 8000 },
        );
        return;
      }
      if (missingRequired.length) {
        toast.error(
          "আবশ্যক কলাম অনুপস্থিত: " + missingRequired.map((c) => COL_LABELS[c]).join(", "),
          { duration: 8000 },
        );
        return;
      }

      setFileName(f.name);
      setHeaders(hdrs);
      setRecords(recs);
      const guessed = autoMap(hdrs);
      setMapping(guessed);
      setRows([]);
      setSummary(null);
      setSavedCount(0);
      toast.success(`ফাইল নির্বাচিত: ${f.name} (${recs.length} সারি)`);
    } catch (e: any) {
      toast.error(e?.message ?? "ফাইল পড়া যায়নি");
    }
  }

  /** Build normalized RowMaps from records using the current mapping. */
  function mappedRows(): RowMap[] {
    return records.map((rec) => {
      const out: RowMap = {};
      for (const col of COLUMNS) {
        const src = mapping[col];
        const v = src ? rec[src] : "";
        out[col] = v === "" || v == null ? null : (typeof v === "string" ? v.trim() : v);
      }
      return out;
    });
  }

  async function validateRows() {
    // Ensure required columns are mapped.
    const missing = REQUIRED_COLS.filter((c) => !mapping[c]);
    if (missing.length) {
      toast.error("আবশ্যক কলাম ম্যাপ করুন: " + missing.map((c) => COL_LABELS[c]).join(", "));
      return;
    }
    setValidating(true);
    try {
      const parsed = mappedRows();

      // Load valid farmer codes for existence checks.
      const farmerCodes = new Set<string>();
      try {
        const { data: fm } = await db.from("farmers").select("farmer_code");
        (fm ?? []).forEach((f: any) => { if (f.farmer_code) farmerCodes.add(String(f.farmer_code).trim()); });
      } catch (e: any) {
        toast.error("ফার্মার তালিকা লোড করা যায়নি: " + (e?.message ?? ""));
        setValidating(false);
        return;
      }

      // Per-land_ref area accounting for borga overlap.
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
        if (!ownerRaw) errors.push("owner_farmer_id: আবশ্যক");
        else {
          const r = normalizeFarmerCode(ownerRaw);
          if (r.ok === false) errors.push(`owner_farmer_id: ID ফরম্যাট সঠিক নয় (${ownerRaw})`);
          else {
            raw.owner_farmer_id = r.value;
            if (!farmerCodes.has(String(r.value).trim()))
              errors.push(`owner_farmer_id: এই মালিক ডাটাবেজে নেই (${r.value})`);
          }
        }

        const sizeRaw = raw.land_size;
        if (sizeRaw == null || String(sizeRaw).trim() === "") errors.push("land_size: আবশ্যক");
        else if (!Number.isFinite(typeof sizeRaw === "number" ? sizeRaw : parseFloat(String(sizeRaw))))
          errors.push(`land_size: সংখ্যা নয় (${sizeRaw})`);
        else if (num(sizeRaw) <= 0) errors.push("land_size: ০ এর বেশি হতে হবে");

        const ot = String(raw.owner_type ?? "").trim().toLowerCase();
        if (ot && !isBorgaType(ot) && !["own", "owner", "নিজে", "মালিক"].includes(ot))
          warns.push(`owner_type চেনা যায়নি (own/borga): ${raw.owner_type}`);

        const borga = isBorgaType(raw.owner_type);
        if (borga) {
          const scRaw = String(raw.sharecropper_id ?? "").trim();
          if (!scRaw) errors.push("sharecropper_id: borga হলে আবশ্যক");
          else {
            const r = normalizeFarmerCode(scRaw);
            if (r.ok === false) errors.push(`sharecropper_id: ফরম্যাট সঠিক নয় (${scRaw})`);
            else {
              raw.sharecropper_id = r.value;
              if (!farmerCodes.has(String(r.value).trim()))
                errors.push(`sharecropper_id: বর্গাদার ডাটাবেজে নেই (${r.value})`);
              if (raw.sharecropper_id === raw.owner_farmer_id)
                errors.push("sharecropper_id: মালিক ও বর্গাদার একই হতে পারে না");
            }
          }
          const ba = num(raw.borga_area);
          const pct = num(raw.share_percentage);
          if (ba <= 0 && pct <= 0) errors.push("borga_area/share_percentage: যেকোনো একটি দিন");
          if (ba > num(raw.land_size)) errors.push("borga_area: জমির পরিমাণের চেয়ে বেশি");
          if (pct < 0 || pct > 100) errors.push("share_percentage: ০-১০০ এর মধ্যে হতে হবে");
        }

        const ref = String(raw.land_ref ?? "").trim();
        if (ref && (borgaAreaByRef[ref] ?? 0) > (sizeByRef[ref] ?? 0) + 0.0001) {
          errors.push(`land_ref ${ref}: বর্গা area জমির পরিমাণ অতিক্রম করেছে`);
        }
        // land_type is optional and free-form (resolved to land_types); no warning needed.

        // land_type must be a real land classification (পুকুর/সবজি/বাগান) — never a season.
        if (looksLikeSeason(raw.land_type))
          errors.push(`land_type: সিজনের নাম দেওয়া যাবে না (${raw.land_type}) — সিজন ইনভয়েস ইমপোর্টে দিন`);


        // dag_no may hold multiple dag numbers. Comma/semicolon separated
        // values (or a JSON array) are supported. A slash (e.g. "1/330") is a
        // valid single dag and kept as-is; only a pipe (|) is warned (never blocked).
        const dagAnalysis = analyzeDagNo(raw.dag_no);
        if (dagAnalysis.warnMsg) {
          warns.push(dagAnalysis.warnMsg);
        }

        return {
          idx,
          raw,
          status: errors.length ? "invalid" : "valid",
          errorMsg: errors.length ? errors.join("; ") : null,
          warnMsg: warns.length ? warns.join("; ") : null,
        } as RowState;
      });
      setRows(initial);
      setSavedCount(0);
      setSummary(null);
      setStep(2);
    } finally {
      setValidating(false);
    }
  }

  const validRows = useMemo(() => rows.filter((r) => r.status === "valid" || r.status === "saved"), [rows]);
  const invalidRows = useMemo(() => rows.filter((r) => r.status === "invalid"), [rows]);
  const importable = useMemo(() => rows.filter((r) => r.status === "valid"), [rows]);
  const errorCategories = useMemo(() => categorizeErrors(invalidRows), [invalidRows]);

  function downloadErrorCsv() {
    const bad = rows.filter((r) => r.status === "invalid" || r.status === "error");
    if (bad.length === 0) { toast.info("কোনো ত্রুটিপূর্ণ সারি নেই।"); return; }
    const cols = [...COLUMNS];
    const headerRow = ["row_no", ...cols, "error"];
    const lines = [headerRow, ...bad.map((r) => [
      String(r.idx + 1),
      ...cols.map((c) => String(r.raw[c] ?? "")),
      r.errorMsg ?? "",
    ])];
    const csv = lines
      .map((r) => r.map((v) => /[",\n]/.test(String(v ?? "")) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? "")).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "lands-import-errors.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  async function importValid() {
    if (importable.length === 0) { toast.error("ইমপোর্ট করার মতো বৈধ সারি নেই।"); return; }
    setSaving(true);
    let inserted = 0, failed = 0;
    const updated = [...rows];

    const farmerMap = new Map<string, string>();
    const landTypeMap = new Map<string, string>();
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

    const landIdByRef = new Map<string, string>();

    for (const r of importable) {
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
          let dagNumbers: string[];
          if (/^\s*\[.*\]\s*$/.test(dagRaw)) {
            try { dagNumbers = (JSON.parse(dagRaw) as unknown[]).map((s) => String(s).trim()).filter(Boolean); }
            catch { dagNumbers = []; }
          } else {
            dagNumbers = dagRaw ? dagRaw.split(/[,;]/).map((s) => s.trim()).filter(Boolean) : [];
          }
          const mouzaName = String(r.raw.mouza ?? "").trim();
          const mouzaId = mouzaName ? mouzaMap.get(mouzaName.toLowerCase()) ?? null : null;
          const ltRaw = String(r.raw.land_type ?? "").trim();
          const ltKey = ltRaw.toLowerCase();
          const landTypeId = ltKey ? landTypeMap.get(ltKey) ?? null : null;
          // Derive the field_type enum from the single land_type value (উচু/নিচু/মাঝারি → high/low/medium).
          const fieldType = deriveFieldType(ltRaw);
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
            valid_from: new Date().toISOString().slice(0, 10),
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
    setSummary({ processed: importable.length, inserted, failed });
    setStep(3);

    try {
      await db.from("import_audit_logs").insert({
        user_id: user?.id ?? null,
        office_id: officeId ?? null,
        module: "lands",
        mode: "insert",
        rows_processed: importable.length,
        rows_inserted: inserted,
        rows_updated: 0,
        rows_failed: failed,
        summary: { source: "LandsImport" },
      });
    } catch { /* audit best-effort */ }

    if (failed === 0) {
      toast.success(`সর্বমোট ${importable.length} সারি • সফল ${inserted} • ব্যর্থ 0`);
    } else {
      toast.warning(
        `সর্বমোট ${importable.length} সারি • সফল ${inserted} • ব্যর্থ ${failed}`,
        { duration: 10000, action: { label: "ব্যর্থ সারি CSV", onClick: () => downloadErrorCsv() } },
      );
    }
  }

  function resetAll() {
    setStep(0); setFileName(""); setHeaders([]); setRecords([]);
    setMapping({} as Record<ColKey, string>); setRows([]); setSummary(null); setSavedCount(0);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <>
      <PageHeader
        title={tx("Land Import", "জমি ইমপোর্ট")}
        description={tx("Upload owner-cultivated and sharecropper lands together", "নিজের চাষ ও বর্গা জমি একসাথে আপলোড করুন")}
        actions={
          <>
            <Badge variant="outline" className="self-center">
              {tx("Template", "টেমপ্লেট")} v{LANDS_TEMPLATE_VERSION}
            </Badge>
            <Button size="sm" variant="outline" onClick={() => downloadTemplate("xlsx")}>
              <Download className="h-4 w-4 mr-2" /> {tx("Template (XLSX)", "টেমপ্লেট (XLSX)")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => downloadTemplate("csv")}>
              <Download className="h-4 w-4 mr-2" /> {tx("Template (CSV)", "টেমপ্লেট (CSV)")}
            </Button>
          </>
        }
      />

      {/* Stepper */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <Badge variant={i === step ? "default" : i < step ? "secondary" : "outline"}>
                {i + 1}. {label}
              </Badge>
              {i < STEPS.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
            </div>
          ))}
        </div>
      </Card>

      {/* Step 1: Instructions & template */}
      {step === 0 && (
        <Card className="mt-4 p-4 space-y-4">
          <div>
            <h3 className="font-semibold mb-2">{tx("Instructions", "নিয়মাবলী")}</h3>
            <ul className="list-disc pl-5 text-sm space-y-1">
              <li>{tx("Import farmers first — lands attach to existing farmers.", "প্রথমে ফার্মার ইমপোর্ট করুন — জমি বিদ্যমান ফার্মারের সাথে যুক্ত হয়।")}</li>
              <li>{tx("Each row = one land.", "প্রতি সারি = একটি জমি।")} <b>owner_farmer_id</b> {tx("and", "ও")} <b>land_size</b> {tx("are required.", "আবশ্যক।")}</li>
              <li>{tx("For multiple sharecroppers on the same land, use the same", "একই জমিতে একাধিক বর্গাদার দিতে সব সারিতে একই")} <b>land_ref</b> {tx("in all rows — the first row creates the land, the rest only add sharecropper relations.", "দিন — প্রথম সারি জমি তৈরি করে, বাকিগুলো শুধু বর্গা সম্পর্ক যোগ করে।")}</li>
              <li>{tx("For multiple lands of one farmer use separate rows (different or empty land_ref).", "এক ফার্মারের একাধিক জমি হলে আলাদা সারি ব্যবহার করুন (আলাদা বা খালি land_ref)।")}</li>
              <li>{tx("For multiple dag numbers, separate with commas:", "দাগ একাধিক হলে কমা দিয়ে লিখুন:")} <code>12,15,30</code></li>
              <li>{tx("Land size in decimals (shatak), up to 4 digits after point:", "জমির পরিমাণ শতকে, দশমিকের পর ৪ ডিজিট পর্যন্ত:")} <code>33.0000</code></li>
            </ul>
          </div>
          <div className="text-sm">
            <b>{tx("owner_type supported values:", "owner_type সমর্থিত মান:")}</b> own / owner / {tx("নিজে (owner)", "নিজে (মালিক)")}, borga / borgadar / {tx("বর্গা (sharecropper)", "বর্গা (বর্গাদার)")}।<br />
            <b>{tx("land_type supported values:", "land_type সমর্থিত মান:")}</b> {tx("উচু, নিচু, মাঝারি, পুকুর, সবজি, বাগান …", "উচু, নিচু, মাঝারি, পুকুর, সবজি, বাগান …")}।
          </div>
          <div>
            <h3 className="font-semibold mb-2">{tx("Template preview", "টেমপ্লেট প্রিভিউ")}</h3>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tx("Column", "কলাম")}</TableHead>
                    <TableHead>{tx("Required", "আবশ্যক")}</TableHead>
                    <TableHead>{tx("Bangla", "বাংলা")}</TableHead>
                    <TableHead>English</TableHead>
                    <TableHead>{tx("Sample", "নমুনা")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {COLUMNS.map((col) => (
                    <TableRow key={col}>
                      <TableCell className="font-mono text-xs">{col}</TableCell>
                      <TableCell>
                        {COL_HELP[col].required
                          ? <Badge variant="destructive">{tx("Required", "আবশ্যক")}</Badge>
                          : <Badge variant="outline">{tx("Optional", "ঐচ্ছিক")}</Badge>}
                      </TableCell>
                      <TableCell className="text-xs">{COL_HELP[col].bn}</TableCell>
                      <TableCell className="text-xs">{COL_HELP[col].en}</TableCell>
                      <TableCell className="font-mono text-xs">{COL_HELP[col].sample}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => downloadTemplate("xlsx")} variant="outline">
              <Download className="h-4 w-4 mr-2" /> {tx("Template (XLSX)", "টেমপ্লেট (XLSX)")}
            </Button>
            <Button onClick={() => downloadTemplate("csv")} variant="outline">
              <Download className="h-4 w-4 mr-2" /> {tx("Template (CSV)", "টেমপ্লেট (CSV)")}
            </Button>
            <Button onClick={() => downloadSample("xlsx")} variant="secondary">
              <Download className="h-4 w-4 mr-2" /> {tx("With sample data (XLSX)", "নমুনা ডেটাসহ (XLSX)")}
            </Button>
            <Button onClick={() => downloadSample("csv")} variant="secondary">
              <Download className="h-4 w-4 mr-2" /> {tx("With sample data (CSV)", "নমুনা ডেটাসহ (CSV)")}
            </Button>
            <Button onClick={() => setStep(1)} className="ml-auto">
              {tx("Next", "পরবর্তী")} <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </Card>
      )}

      {/* Step 2: Upload & column mapping */}
      {step === 1 && (
        <Card className="mt-4 p-4 space-y-4">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls,.txt,.tsv"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => fileRef.current?.click()} variant="default">
              <Upload className="h-4 w-4 mr-2" /> {tx("Select file", "ফাইল নির্বাচন করুন")}
            </Button>
            {fileName && <Badge variant="secondary">{fileName} — {records.length} {tx("rows", "সারি")}</Badge>}
          </div>

          {headers.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">{tx("Column mapping", "কলাম ম্যাপিং")}</h3>
              <p className="text-sm text-muted-foreground mb-3">
                {tx("Map your file columns to system fields. Matches are set automatically.", "আপনার ফাইলের কলাম সিস্টেমের ফিল্ডের সাথে মিলিয়ে দিন। মিলে গেলে স্বয়ংক্রিয়ভাবে সেট হয়ে যায়।")}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {COLUMNS.map((col) => (
                  <div key={col} className="flex items-center gap-2">
                    <label className="text-sm w-44 shrink-0">
                      {tx(COL_HELP[col].en, COL_HELP[col].bn)}
                    </label>
                    <Select
                      value={mapping[col] || "__none__"}
                      onValueChange={(v) => setMapping((m) => ({ ...m, [col]: v === "__none__" ? "" : v }))}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder={tx("— select column —", "— কলাম নির্বাচন —")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">{tx("— none —", "— নেই —")}</SelectItem>
                        {headers.map((h) => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between gap-2">
            <Button variant="outline" onClick={() => setStep(0)}>
              <ArrowLeft className="h-4 w-4 mr-2" /> {tx("Previous", "পূর্ববর্তী")}
            </Button>
            <Button onClick={validateRows} disabled={records.length === 0 || validating}>
              {validating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {tx("Validate", "যাচাই করুন")} <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </Card>
      )}

      {/* Step 3: Preview & validation */}
      {step === 2 && (
        <>
          <Card className="mt-4 p-4 space-y-3">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="secondary">{tx("Total", "মোট")}: {rows.length}</Badge>
              <Badge variant="default">{tx("Ready", "প্রস্তুত")}: {importable.length}</Badge>
              <Badge variant="destructive">{tx("Errors", "ত্রুটি")}: {invalidRows.length}</Badge>
            </div>
            {invalidRows.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{tx("Some rows have errors", "কিছু সারিতে ত্রুটি আছে")}</AlertTitle>
                <AlertDescription>
                  {tx("Rows with errors will not be imported. See the reason in the table below or download the error report to fix them.", "ত্রুটিপূর্ণ সারি ইমপোর্ট হবে না। নিচের টেবিলে কারণ দেখুন অথবা ত্রুটি রিপোর্ট ডাউনলোড করে ঠিক করুন।")}
                </AlertDescription>
              </Alert>
            )}
            {invalidRows.length > 0 && errorCategories.length > 0 && (
              <div className="rounded-md border p-3 text-sm space-y-1">
                <div className="font-medium">{tx("Why rows were blocked", "কেন সারিগুলো আটকে গেছে")}</div>
                <ul className="list-disc pl-5">
                  {errorCategories.map(({ key, count }) => (
                    <li key={key}>
                      <b>{count}</b> — {tx(ERROR_CATEGORY_LABELS[key]?.en ?? key, ERROR_CATEGORY_LABELS[key]?.bn ?? key)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap justify-between gap-2">
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> {tx("Previous", "পূর্ববর্তী")}
                </Button>
                {invalidRows.length > 0 && (
                  <Button variant="outline" onClick={downloadErrorCsv}>
                    <FileWarning className="h-4 w-4 mr-2" /> {tx("Error report (CSV)", "ত্রুটি রিপোর্ট (CSV)")}
                  </Button>
                )}
              </div>
              <Button onClick={importValid} disabled={saving || importable.length === 0}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {tx(`Import ${importable.length} lands`, `${importable.length} টি জমি ইমপোর্ট করুন`)}
              </Button>
            </div>
          </Card>

          <Card className="mt-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>{tx("Status", "অবস্থা")}</TableHead>
                  <TableHead>{tx("Owner ID", "মালিক ID")}</TableHead>
                  <TableHead>land_ref</TableHead>
                  <TableHead>{tx("Mouza", "মৌজা")}</TableHead>
                  <TableHead>{tx("Dag", "দাগ")}</TableHead>
                  <TableHead>{tx("Type", "ধরন")}</TableHead>
                  <TableHead>{tx("Size", "পরিমাণ")}</TableHead>
                  <TableHead>own/borga</TableHead>
                  <TableHead>{tx("Sharecropper", "বর্গাদার")}</TableHead>
                  <TableHead>{tx("Issue", "সমস্যা")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.idx} className={r.status === "invalid" || r.status === "error" ? "bg-destructive/10" : ""}>
                    <TableCell>{r.idx + 1}</TableCell>
                    <TableCell>
                      {r.status === "saved" && <Badge>{tx("Saved", "সংরক্ষিত")}</Badge>}
                      {r.status === "saving" && <Badge variant="secondary"><Loader2 className="h-3 w-3 animate-spin mr-1" />…</Badge>}
                      {r.status === "valid" && <Badge variant="secondary">{tx("Ready", "প্রস্তুত")}</Badge>}
                      {r.status === "invalid" && <Badge variant="destructive">{tx("Error", "ত্রুটি")}</Badge>}
                      {r.status === "error" && <Badge variant="destructive">{tx("Failed", "ব্যর্থ")}</Badge>}
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
        </>
      )}

      {/* Step 4: Summary */}
      {step === 3 && summary && (
        <Card className="mt-4 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
            <h3 className="text-lg font-semibold">{tx("Import summary", "ইমপোর্ট সারসংক্ষেপ")}</h3>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border p-4 text-center">
              <div className="text-2xl font-bold">{summary.processed}</div>
              <div className="text-sm text-muted-foreground">{tx("Processed", "প্রসেস হয়েছে")}</div>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{summary.inserted}</div>
              <div className="text-sm text-muted-foreground">{tx("Successful", "সফল")}</div>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <div className="text-2xl font-bold text-destructive">{summary.failed}</div>
              <div className="text-sm text-muted-foreground">{tx("Failed", "ব্যর্থ")}</div>
            </div>
          </div>
          {(summary.failed > 0 || invalidRows.length > 0) && (
            <Button variant="outline" onClick={downloadErrorCsv}>
              <FileWarning className="h-4 w-4 mr-2" /> {tx("Failed rows report (CSV)", "ব্যর্থ সারি রিপোর্ট (CSV)")}
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ArrowLeft className="h-4 w-4 mr-2" /> {tx("Back to table", "টেবিলে ফিরে যান")}
            </Button>
            <Button onClick={resetAll}>{tx("New import", "নতুন ইমপোর্ট")}</Button>
          </div>
        </Card>
      )}
    </>
  );
}
