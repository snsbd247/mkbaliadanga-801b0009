// i18n-ignore-file — admin-only page (English UI)
import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Upload, Download, AlertTriangle, CheckCircle2, Loader2, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { downloadCsvTemplate } from "@/lib/importTemplates";
import { validateDagNumbers, formatDagNumbers } from "@/lib/dagNumbers";
import { SHATAK_PER_KATHA, SHATAK_PER_BIGHA } from "@/lib/landUnits";
import { previewBnReceiptPdf, downloadBnReceiptPdf, type BnReceiptData } from "@/lib/bnReceipts";
import { buildSampleReceipt, findMissingSampleFields, findMissingSampleFieldDetails, SAMPLE_RECEIPT_TYPE_LABELS, type SampleReceiptType, type MissingFieldDetail } from "@/lib/sampleReceipts";

/**
 * Universal Data Import — CSV / Excel (.xlsx)
 *
 * Modules supported (all keyed by farmer.account_number):
 *   lands, loans, loan_payments, savings, payments, ledger
 *
 * Existing DB triggers post ledger entries automatically for savings/loans/loan_payments.
 * RLS still applies on inserts — non-authorized users get a friendly error per row.
 *
 * Voter audit logs are NEVER importable from client (deny-policy). Use the
 * Voter toggle on the Farmer profile to generate audit rows server-side.
 */

type Module =
  | "lands"
  | "land_relations"
  | "loans"
  | "loan_payments"
  | "loan_installments"
  | "loan_guarantors"
  | "savings"
  | "payments"
  | "irrigation"
  | "shares"
  | "cashbook_receipts"
  | "cashbook_expenses"
  | "patwaris"
  | "mouzas"
  | "seasons"
  | "offices"
  | "bank_accounts"
  | "bank_transactions"
  | "assets"
  | "farmers"
  | "savings_plans"
  | "loan_plans"
  | "farmer_savings_plans"
  | "irrigation_categories"
  | "irrigation_rates"
  | "ledger";

type RowResult = {
  idx: number;
  raw: Record<string, any>;
  status: "pending" | "ok" | "error";
  message?: string;
  resolved?: Record<string, any>;
};

const TEMPLATES: Record<Module, { columns: string[]; sample: Record<string, any> }> = {
  lands: {
    columns: ["account_number", "dag_no", "land_size", "land_size_unit", "owner_type", "field_type", "mouza", "notes", "patwari_name"],
    sample: { account_number: "10001", dag_no: "123, 124/A", land_size: 33, land_size_unit: "shotok", owner_type: "owner", field_type: "medium_land", mouza: "Mouza A", notes: "আমন হয় না। নিজ সেচে আবাদ হয়।", patwari_name: "মোঃ আলম ইসলাম" },
  },
  land_relations: {
    columns: ["owner_account_number", "tenant_account_number", "dag_no", "share_percentage", "valid_from", "valid_to", "note"],
    sample: { owner_account_number: "10001", tenant_account_number: "10002", dag_no: "123, 124/A", share_percentage: 50, valid_from: "2026-01-01", valid_to: "", note: "" },
  },
  loans: {
    columns: ["account_number", "principal", "interest_rate", "total_payable", "issued_on", "note"],
    sample: { account_number: "10001", principal: 10000, interest_rate: 12, total_payable: 11200, issued_on: "2026-01-15", note: "Crop loan" },
  },
  loan_payments: {
    columns: ["account_number", "amount", "paid_on", "note"],
    sample: { account_number: "10001", amount: 1000, paid_on: "2026-02-15", note: "1st installment" },
  },
  loan_installments: {
    columns: ["account_number", "installment_no", "due_date", "amount", "status"],
    sample: { account_number: "10001", installment_no: 1, due_date: "2026-02-15", amount: 1000, status: "due" },
  },
  savings: {
    columns: ["account_number", "type", "amount", "txn_date", "note"],
    sample: { account_number: "10001", type: "deposit", amount: 500, txn_date: "2026-02-01", note: "Monthly deposit" },
  },
  payments: {
    columns: ["account_number", "kind", "amount", "method", "note"],
    sample: { account_number: "10001", kind: "savings", amount: 500, method: "cash", note: "" },
  },
  ledger: {
    columns: ["entry_date", "account_code", "debit", "credit", "description", "reference_type"],
    sample: { entry_date: "2026-02-01", account_code: "1010", debit: 500, credit: 0, description: "Cash adjustment", reference_type: "manual" },
  },
  irrigation: {
    columns: ["account_number", "dag_no", "season_year", "season_type", "quantity", "base_charge", "canal_charge", "maintenance_charge", "other_charge", "previous_due_brought", "penalty_amount", "entry_date", "note"],
    sample: { account_number: "10001", dag_no: "123/A", season_year: 2026, season_type: "boro", quantity: 0.33, base_charge: 200, canal_charge: 50, maintenance_charge: 20, other_charge: 0, previous_due_brought: 0, penalty_amount: 0, entry_date: "2026-02-01", note: "" },
  },
  cashbook_receipts: {
    columns: ["receipt_date", "kind", "account_number", "amount", "method", "note"],
    sample: { receipt_date: "2026-02-01", kind: "donation", account_number: "", amount: 1000, method: "cash", note: "Anonymous donation" },
  },
  cashbook_expenses: {
    columns: ["expense_date", "head", "payee", "amount", "method", "note"],
    sample: { expense_date: "2026-02-01", head: "Office", payee: "Stationery shop", amount: 500, method: "cash", note: "Pens & paper" },
  },
  shares: {
    columns: ["account_number", "balance"],
    sample: { account_number: "10001", balance: 500 },
  },
  patwaris: {
    columns: ["name", "name_bn", "mobile", "nid", "address", "mouza", "note"],
    sample: { name: "Md. Rahim", name_bn: "মোঃ রহিম", mobile: "01700000000", nid: "1234567890", address: "Village A", mouza: "Mouza A", note: "" },
  },
  mouzas: {
    columns: ["upazila", "name", "name_bn", "code"],
    sample: { upazila: "Shibganj", name: "Mouza A", name_bn: "মৌজা এ", code: "M-001" },
  },
  seasons: {
    columns: ["year", "type", "name", "fiscal_year", "start_date", "end_date", "due_date", "status"],
    sample: { year: 2026, type: "boro", name: "Boro 2026", fiscal_year: "2025-2026", start_date: "2026-01-01", end_date: "2026-06-30", due_date: "2026-07-15", status: "active" },
  },
  offices: {
    columns: ["name", "registration_no", "established_on", "contact", "address"],
    sample: { name: "Central Office", registration_no: "REG-001", established_on: "2010-01-01", contact: "01700000000", address: "Town Center" },
  },
  bank_accounts: {
    columns: ["bank_name", "branch", "account_no", "account_title", "account_type", "opening_balance", "stream"],
    sample: { bank_name: "Sonali Bank", branch: "Shibganj", account_no: "1234567890", account_title: "Samity Account", account_type: "savings", opening_balance: 0, stream: "irrigation" },
  },
  bank_transactions: {
    columns: ["account_no", "txn_date", "txn_type", "amount", "reference_no", "note"],
    sample: { account_no: "1234567890", txn_date: "2026-02-01", txn_type: "deposit", amount: 5000, reference_no: "TXN-001", note: "" },
  },
  assets: {
    columns: ["asset_code", "name_en", "name_bn", "serial_no", "asset_type", "tracking_mode", "unit", "purchase_price", "current_status"],
    sample: { asset_code: "AST-001", name_en: "Water Pump", name_bn: "পানির পাম্প", serial_no: "SN-123", asset_type: "fixed_asset", tracking_mode: "quantity", unit: "pcs", purchase_price: 25000, current_status: "purchased" },
  },
  loan_guarantors: {
    columns: ["loan_account_number", "name", "father_name", "village", "mobile", "nid", "role", "guarantor_account_number"],
    sample: { loan_account_number: "10001", name: "Md. Karim", father_name: "Md. Jashim", village: "Bagbari", mobile: "01700000000", nid: "1234567890", role: "guarantor", guarantor_account_number: "" },
  },
  farmers: {
    columns: ["account_number", "name_en", "name_bn", "father_name", "mother_name", "mobile", "nid", "village", "address", "status"],
    sample: { account_number: "10001", name_en: "Md. Rahim", name_bn: "মোঃ রহিম", father_name: "Md. Jashim", mother_name: "Mst. Rahima", mobile: "01700000000", nid: "1234567890", village: "Bagbari", address: "Village A", status: "active" },
  },
  savings_plans: {
    columns: ["name", "name_bn", "duration_months", "installment_type", "installment_amount", "interest_rate", "maturity_type"],
    sample: { name: "DPS 12m", name_bn: "ডিপিএস ১২ মাস", duration_months: 12, installment_type: "monthly", installment_amount: 500, interest_rate: 8, maturity_type: "simple" },
  },
  loan_plans: {
    columns: ["name", "name_bn", "duration_months", "installment_type", "interest_rate", "penalty_type", "penalty_value", "grace_period_days"],
    sample: { name: "Crop Loan 12m", name_bn: "শস্য ঋণ ১২ মাস", duration_months: 12, installment_type: "monthly", interest_rate: 12, penalty_type: "percentage", penalty_value: 2, grace_period_days: 7 },
  },
  farmer_savings_plans: {
    columns: ["account_number", "plan_name", "start_date", "expected_total", "expected_interest", "maturity_amount", "status"],
    sample: { account_number: "10001", plan_name: "DPS 12m", start_date: "2026-01-01", expected_total: 6000, expected_interest: 480, maturity_amount: 6480, status: "active" },
  },
  irrigation_categories: {
    columns: ["code", "name_bn", "name_en", "calculation_basis", "allow_manual_negotiation"],
    sample: { code: "CAT-A", name_bn: "ক্যাটাগরি এ", name_en: "Category A", calculation_basis: "per_shotok", allow_manual_negotiation: false },
  },
  irrigation_rates: {
    columns: ["season_year", "season_type", "basis", "base_rate", "canal_charge", "maintenance_charge", "other_charge", "note"],
    sample: { season_year: 2026, season_type: "boro", basis: "per_size", base_rate: 39.39, canal_charge: 0, maintenance_charge: 0, other_charge: 0, note: "" },
  },
};

import { decodeSpreadsheetBuffer } from "@/lib/csvDecode";

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

// Header aliases — lets users rearrange or rename columns slightly without
// breaking the import. Keys are normalized aliases → canonical column name.
const HEADER_ALIASES: Record<string, string> = {
  account_no: "account_number",
  acc_no: "account_number",
  voter_no: "account_number",
  voter_number: "account_number",
  member_no: "account_number",
  dag: "dag_no",
  dag_number: "dag_no",
  plot_no: "dag_no",
  plot: "dag_no",
  size: "land_size",
  area: "land_size",
  share: "share_percentage",
  share_pct: "share_percentage",
  owner_acc: "owner_account_number",
  owner_account: "owner_account_number",
  tenant_acc: "tenant_account_number",
  tenant_account: "tenant_account_number",
  sharecropper_account_number: "tenant_account_number",
  date: "entry_date",
  season: "season_type",
  year: "season_year",
};

function normalizeKey(k: string) {
  const base = String(k).trim().toLowerCase().replace(/\s+/g, "_").replace(/[()./]/g, "");
  return HEADER_ALIASES[base] ?? base;
}

function parseSheet(wb: XLSX.WorkBook): Record<string, any>[] {
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
  return json.map((r) => {
    const out: Record<string, any> = {};
    for (const k of Object.keys(r)) {
      const v = r[k];
      out[normalizeKey(k)] = v === "" ? null : (typeof v === "string" ? v.trim() : v);
    }
    return out;
  });
}

const TPL_INSTRUCTIONS: Partial<Record<Module, string[][]>> = {
  lands: [
    ["Column", "Required", "Format / Notes"],
    ["account_number", "Yes", "Farmer Voter / Savings A/C No (5 digits)."],
    ["dag_no", "Yes", "One or more dag numbers, comma separated. Canonical: \"123, 124/A, 125-B\". Allowed chars per token: digits, letters, '/', '-' (max 32). No duplicates."],
    ["land_size", "Yes", "Land area number. > 0. Stored as শতক (shotok)."],
    ["land_size_unit", "No", "shotok | katha | bigha | acre (default: shotok). katha/bigha/acre values are auto-converted to শতক. 1 বিঘা = 33 শতক = 20 কাঠা, 1 একর ≈ 100 শতক."],
    ["owner_type", "No", "owner | borgadar (default: owner)"],
    ["field_type", "No", "high_land | medium_land | low_land (default: medium_land)"],
    ["mouza", "No", "Free text mouza name."],
    ["notes", "No", "হোল্ডিং এর বিবরন — receipt holding text (e.g. \"আমন হয় না। নিজ সেচে আবাদ হয়।\")."],
    ["patwari_name", "No", "Patwari name (en/bn) or mobile. Must match an existing patwari (import patwaris first)."],
    [],
    ["Examples", "", ""],
    ["10001", "", "dag_no = 123  → single dag"],
    ["10001", "", "dag_no = 123, 124/A, 125-B  → multi-dag (canonical)"],
  ],
  land_relations: [
    ["Column", "Required", "Format / Notes"],
    ["owner_account_number", "Yes", "Owner farmer A/C No (5 digits)."],
    ["tenant_account_number", "Yes", "Tenant / sharecropper farmer A/C No."],
    ["dag_no", "Yes", "Must EXACTLY match the owner's land dag_no in canonical comma-separated form (e.g. \"123, 124/A\")."],
    ["share_percentage", "Yes", "0 < value ≤ 100. Combined overlap must not exceed 100%."],
    ["valid_from", "Yes", "YYYY-MM-DD"],
    ["valid_to", "No", "YYYY-MM-DD or empty for open-ended."],
    ["note", "No", "Free text."],
  ],
  irrigation: [
    ["Column", "Required", "Format / Notes"],
    ["account_number", "Yes", "Farmer A/C No (5 digits)."],
    ["dag_no", "Yes", "Must match an existing land for this farmer. Canonical comma-separated form supported (e.g. \"123, 124/A\")."],
    ["season_year", "Yes", "e.g. 2026"],
    ["season_type", "Yes", "boro | aman | aus"],
    ["quantity", "Yes", "Decimal — irrigated land size."],
    ["base_charge", "Yes", "Numeric"],
    ["canal_charge / maintenance_charge / other_charge", "No", "Numeric, default 0"],
    ["previous_due_brought", "No", "Numeric, default 0"],
    ["penalty_amount", "No", "Numeric, default 0"],
    ["entry_date", "Yes", "YYYY-MM-DD"],
    ["note", "No", "Free text"],
  ],
};

// Field-level format validation rules per module. Runs before import so bad
// data is caught up-front (numbers, dates, enums) in addition to required checks.
const isISODate = (v: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(v).trim());
const isNum = (v: any) => v !== null && v !== "" && !isNaN(Number(v));
type FieldRule = { type?: "number" | "positive" | "date" | "enum"; values?: string[] };
const FORMAT_RULES: Partial<Record<Module, Record<string, FieldRule>>> = {
  lands: {
    land_size: { type: "positive" },
    owner_type: { type: "enum", values: ["owner", "borgadar"] },
    field_type: { type: "enum", values: ["high_land", "medium_land", "low_land"] },
    land_size_unit: { type: "enum", values: ["shotok", "shatak", "decimal", "katha", "kattah", "bigha", "acre", "ekor"] },
  },
  land_relations: {
    share_percentage: { type: "positive" },
    valid_from: { type: "date" },
  },
  loans: { principal: { type: "positive" }, interest_rate: { type: "number" }, issued_on: { type: "date" } },
  loan_payments: { amount: { type: "positive" }, paid_on: { type: "date" } },
  loan_installments: { installment_no: { type: "positive" }, amount: { type: "positive" }, due_date: { type: "date" }, status: { type: "enum", values: ["due", "paid", "missed", "partial"] } },
  savings: { amount: { type: "positive" }, type: { type: "enum", values: ["deposit", "withdrawal"] }, txn_date: { type: "date" } },
  payments: { amount: { type: "positive" }, kind: { type: "enum", values: ["savings", "loan", "irrigation"] } },
  irrigation: { season_year: { type: "positive" }, season_type: { type: "enum", values: ["boro", "aman", "aus"] }, base_charge: { type: "number" }, entry_date: { type: "date" } },
  cashbook_receipts: { amount: { type: "positive" }, receipt_date: { type: "date" } },
  cashbook_expenses: { amount: { type: "positive" }, expense_date: { type: "date" } },
  ledger: { entry_date: { type: "date" }, debit: { type: "number" }, credit: { type: "number" } },
  shares: { balance: { type: "number" } },
  savings_plans: { duration_months: { type: "positive" } },
  loan_plans: { duration_months: { type: "positive" } },
  irrigation_rates: { season_year: { type: "positive" }, base_rate: { type: "number" } },
};

function checkFormat(col: string, value: any, rule: FieldRule): string | null {
  const v = value;
  if (v === null || v === undefined || String(v).trim() === "") return null; // required handled separately
  switch (rule.type) {
    case "number":
      if (!isNum(v)) return `${col} must be a number`;
      break;
    case "positive":
      if (!isNum(v) || Number(v) <= 0) return `${col} must be a number > 0`;
      break;
    case "date":
      if (!isISODate(v)) return `${col} must be a date (YYYY-MM-DD)`;
      break;
    case "enum":
      if (rule.values && !rule.values.includes(String(v).trim().toLowerCase()))
        return `${col} must be one of: ${rule.values.join("/")}`;
      break;
  }
  return null;
}

function downloadTemplate(mod: Module) {
  const tpl = TEMPLATES[mod];
  const ws = XLSX.utils.json_to_sheet([tpl.sample], { header: tpl.columns });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, mod);
  const guide = TPL_INSTRUCTIONS[mod];
  if (guide) {
    const gws = XLSX.utils.aoa_to_sheet(guide);
    XLSX.utils.book_append_sheet(wb, gws, "Instructions");
  }
  XLSX.writeFile(wb, `import_template_${mod}.xlsx`);
}

function downloadErrorReport(rows: RowResult[], format: "xlsx" | "csv" = "xlsx") {
  const errs = rows.filter((r) => r.status === "error");
  if (!errs.length) return;
  const flat = errs.map((r) => ({
    row: r.idx + 2,
    error: r.message,
    ...(r.resolved
      ? Object.fromEntries(Object.entries(r.resolved).map(([k, v]) => [`resolved_${k}`, v]))
      : {}),
    ...r.raw,
  }));
  if (format === "csv") {
    const cols = Array.from(new Set(flat.flatMap((o) => Object.keys(o))));
    const esc = (v: any) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [cols.join(","), ...flat.map((o) => cols.map((c) => esc((o as any)[c])).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "import_errors.csv"; a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const ws = XLSX.utils.json_to_sheet(flat);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "errors");
  XLSX.writeFile(wb, `import_errors.xlsx`);
}

export default function DataImport() {
  const { user, isAdmin, isSuper } = useAuth();
  const [mod, setMod] = useState<Module>("lands");
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<RowResult[]>([]);
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; ok: number; failed: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [upsertMode, setUpsertMode] = useState(false);
  const [atomicMode, setAtomicMode] = useState(true);
  const [sampleType, setSampleType] = useState<SampleReceiptType>("irrigation");
  const [sampleMissing, setSampleMissing] = useState<MissingFieldDetail[]>([]);
  const [ledgerVerify, setLedgerVerify] = useState<Array<{ idx: number; record_id: string; ledger_ids: string[]; ok: boolean }>>([]);
  const [recentImports, setRecentImports] = useState<any[]>([]);
  const [summary, setSummary] = useState<{
    processed: number; inserted: number; updated: number; skipped: number;
    failed: number; duplicates: number; rolledBack: boolean;
  } | null>(null);

  async function loadRecentImports() {
    const { data } = await supabase
      .from("import_audit_logs" as any)
      .select("*").order("created_at", { ascending: false }).limit(20);
    setRecentImports((data as any) ?? []);
  }
  useEffect(() => { loadRecentImports(); }, []);

  const stats = useMemo(() => ({
    total: rows.length,
    ok: rows.filter((r) => r.status === "ok").length,
    err: rows.filter((r) => r.status === "error").length,
    pending: rows.filter((r) => r.status === "pending").length,
  }), [rows]);

  async function onFile(f: File) {
    setFile(f);
    try {
      const wb = await readBookFromFile(f);
      const parsed = parseSheet(wb);
      const verified = verifyRows(parsed, mod);
      setRows(verified);
      const errs = verified.filter((r) => r.status === "error").length;
      if (errs > 0) toast.warning(`Loaded ${parsed.length} rows — ${errs} have validation errors`);
      else toast.success(`Loaded ${parsed.length} rows. Columns + dag_no format look good.`);
    } catch (e: any) {
      toast.error(`Failed to read file: ${e.message}`);
    }
  }

  function verifyRows(parsed: Record<string, any>[], m: Module): RowResult[] {
    const required: Partial<Record<Module, string[]>> = {
      lands: ["account_number", "dag_no", "land_size"],
      land_relations: ["owner_account_number", "tenant_account_number", "dag_no", "share_percentage", "valid_from"],
      irrigation: ["account_number", "dag_no", "season_year", "season_type", "base_charge", "entry_date"],
      loans: ["account_number", "principal"],
      loan_payments: ["account_number", "amount"],
      loan_installments: ["account_number", "installment_no", "due_date", "amount"],
      savings: ["account_number", "type", "amount"],
      payments: ["account_number", "kind", "amount"],
      cashbook_receipts: ["receipt_date", "kind", "amount"],
      cashbook_expenses: ["expense_date", "head", "amount"],
      ledger: ["entry_date", "account_code"],
      shares: ["account_number", "balance"],
      patwaris: ["name"],
      farmers: ["account_number", "name_en"],
      savings_plans: ["name", "duration_months"],
      loan_plans: ["name", "duration_months"],
      farmer_savings_plans: ["account_number", "plan_name"],
      irrigation_categories: ["code"],
      irrigation_rates: ["season_year", "season_type", "base_rate"],
    };
    const headerSet = parsed.length ? new Set(Object.keys(parsed[0])) : new Set<string>();
    const req = required[m] ?? TEMPLATES[m].columns;
    const missingCols = req.filter((c) => !headerSet.has(c));
    // Detect duplicate rows within the uploaded file (same key columns repeated).
    const dupKeyCols = req.length ? req : TEMPLATES[m].columns;
    const seen = new Map<string, number>();
    const rowKey = (raw: Record<string, any>) =>
      dupKeyCols.map((c) => String(raw[c] ?? "").trim().toLowerCase()).join("|");
    return parsed.map((raw, idx) => {
      const issues: string[] = [];
      if (missingCols.length) issues.push(`Missing columns: ${missingCols.join(", ")}`);
      for (const col of req) {
        const v = raw[col];
        if (v === null || v === undefined || String(v).trim() === "") {
          issues.push(`${col} is required`);
        }
      }
      const fmtRules = FORMAT_RULES[m];
      if (fmtRules) {
        for (const [col, rule] of Object.entries(fmtRules)) {
          const err = checkFormat(col, raw[col], rule);
          if (err) issues.push(err);
        }
      }
      if (["lands", "land_relations", "irrigation"].includes(m) && raw.dag_no) {
        const dv = validateDagNumbers(String(raw.dag_no));
        if (!dv.ok) issues.push(`dag_no: ${(dv as any).error}`);
      }
      const key = rowKey(raw);
      if (seen.has(key)) {
        issues.push(`Duplicate of row ${seen.get(key)! + 2} in this file`);
      } else {
        seen.set(key, idx);
      }
      if (issues.length) return { idx, raw, status: "error", message: issues.join(" • ") };
      // Non-blocking warning: lands without holding/patwari info → receipt rows will be empty.
      if (m === "lands") {
        const missingInfo: string[] = [];
        if (String(raw.notes ?? raw.holding_description ?? "").trim() === "") missingInfo.push("notes (হোল্ডিং বিবরণ)");
        if (String(raw.patwari_name ?? raw.patwari ?? raw.patwari_mobile ?? "").trim() === "") missingInfo.push("patwari_name");
        if (missingInfo.length) return { idx, raw, status: "pending", message: `⚠ রশিদে দেখা যাবে না: ${missingInfo.join(", ")}` };
      }
      return { idx, raw, status: "pending" };
    });
  }

  // Look up farmer_id + office_id by account_number — single round trip.
  async function resolveFarmers(accountNumbers: string[]) {
    const unique = Array.from(new Set(accountNumbers.filter(Boolean)));
    if (!unique.length) return new Map<string, { id: string; office_id: string | null }>();
    const { data, error } = await supabase
      .from("farmers")
      .select("id, office_id, account_number")
      .in("account_number", unique);
    if (error) throw error;
    const m = new Map<string, { id: string; office_id: string | null }>();
    (data ?? []).forEach((f: any) => m.set(String(f.account_number), { id: f.id, office_id: f.office_id }));
    return m;
  }

  async function resolveAccountsByCode(codes: string[]) {
    const unique = Array.from(new Set(codes.filter(Boolean)));
    if (!unique.length) return new Map<string, string>();
    const { data, error } = await supabase.from("accounts").select("id, code").in("code", unique);
    if (error) throw error;
    const m = new Map<string, string>();
    (data ?? []).forEach((a: any) => m.set(String(a.code), a.id));
    return m;
  }

  async function importAll(dryRun = false) {
    if (!rows.length) return;
    if (dryRun) setLedgerVerify([]);
    if (mod === "ledger" && !isSuper) {
      toast.error("Only Super Admin can import ledger entries.");
      return;
    }
    setWorking(true);
    if (!dryRun) setSummary(null);
    const next = [...rows];
    // Track real inserts so we can roll everything back if any row fails (atomic mode).
    const insertedRecords: Array<{ table: string; id: string }> = [];

    try {
      // Pre-resolve farmer mapping where applicable
      const accountNumbers: string[] = [];
      next.forEach((r) => {
        if (mod === "ledger") return;
        if (mod === "land_relations") {
          accountNumbers.push(String(r.raw.owner_account_number ?? "").trim());
          const tenantAcc = r.raw.tenant_account_number ?? r.raw.sharecropper_account_number;
          if (tenantAcc) accountNumbers.push(String(tenantAcc).trim());
        } else if (mod === "loan_guarantors") {
          accountNumbers.push(String(r.raw.loan_account_number ?? "").trim());
          if (r.raw.guarantor_account_number) accountNumbers.push(String(r.raw.guarantor_account_number).trim());
        } else {
          accountNumbers.push(String(r.raw.account_number ?? "").trim());
        }
      });
      const farmerMap = mod !== "ledger" ? await resolveFarmers(accountNumbers) : new Map();

      const accountMap = mod === "ledger"
        ? await resolveAccountsByCode(next.map((r) => String(r.raw.account_code ?? "").trim()))
        : new Map<string, string>();

      // Pre-fetch latest active loan per farmer for loan_payments / loan_installments mode
      let loanByFarmer = new Map<string, string>();
      if (mod === "loan_payments" || mod === "loan_installments" || mod === "loan_guarantors") {
        const farmerIds = Array.from(new Set(Array.from(farmerMap.values()).map((v) => v.id)));
        if (farmerIds.length) {
          const { data: loans } = await supabase
            .from("loans")
            .select("id, farmer_id, status, issued_on")
            .in("farmer_id", farmerIds)
            .in("status", ["approved", "active"] as any)
            .order("issued_on", { ascending: false });
          (loans ?? []).forEach((l: any) => {
            if (!loanByFarmer.has(l.farmer_id)) loanByFarmer.set(l.farmer_id, l.id);
          });
        }
      }

      // Pre-fetch lookup maps for catalog modules
      const upazilaMap = new Map<string, string>();
      if (mod === "mouzas") {
        const { data: ups } = await supabase.from("upazilas").select("id,name,name_bn");
        (ups ?? []).forEach((u: any) => {
          if (u.name) upazilaMap.set(String(u.name).trim().toLowerCase(), u.id);
          if (u.name_bn) upazilaMap.set(String(u.name_bn).trim().toLowerCase(), u.id);
        });
      }
      const bankAcctMap = new Map<string, string>();
      if (mod === "bank_transactions") {
        const { data: ba } = await supabase.from("bank_accounts").select("id,account_no,office_id");
        (ba ?? []).forEach((b: any) => {
          if (b.account_no) bankAcctMap.set(String(b.account_no).trim(), b.id);
        });
      }

      // Plan lookup by name for farmer_savings_plans
      const savingsPlanMap = new Map<string, { id: string; office_id: string | null }>();
      if (mod === "farmer_savings_plans") {
        const { data: sp } = await supabase.from("savings_plans").select("id,name,office_id");
        (sp ?? []).forEach((p: any) => savingsPlanMap.set(String(p.name).trim().toLowerCase(), { id: p.id, office_id: p.office_id }));
      }
      // Season lookup by year+type for irrigation_rates
      const seasonMap = new Map<string, string>();
      if (mod === "irrigation_rates") {
        const { data: ss } = await supabase.from("seasons").select("id,year,type");
        (ss ?? []).forEach((s: any) => seasonMap.set(`${s.year}|${String(s.type).trim().toLowerCase()}`, s.id));
      }

      // Patwari lookup by name / name_bn / mobile for lands mode
      const patwariMap = new Map<string, string>();
      if (mod === "lands") {
        const { data: pw } = await supabase.from("patwaris").select("id,name,name_bn,mobile");
        (pw ?? []).forEach((p: any) => {
          if (p.name) patwariMap.set(String(p.name).trim().toLowerCase(), p.id);
          if (p.name_bn) patwariMap.set(String(p.name_bn).trim().toLowerCase(), p.id);
          if (p.mobile) patwariMap.set(String(p.mobile).trim(), p.id);
        });
      }




      setProgress({ current: 0, total: next.length, ok: 0, failed: 0 });
      for (let i = 0; i < next.length; i++) {
        const r = next[i];
        const raw = r.raw;
        try {
          let payload: any = null;
          let table = "";

          if (mod === "lands") {
            const f = farmerMap.get(String(raw.account_number));
            if (!f) throw new Error("Farmer not found for account_number");
            if (!raw.land_size || Number(raw.land_size) <= 0) throw new Error("land_size required");
            const dagRaw = String(raw.dag_no ?? "").trim();
            if (!dagRaw) throw new Error("dag_no required");
            const dv = validateDagNumbers(dagRaw);
            if (!dv.ok) throw new Error(`dag_no: ${(dv as any).error}`);
            const canonicalDag = dv.values.join(", ");
            // Convert land_size to canonical শতক (shotok) based on land_size_unit
            const unit = String(raw.land_size_unit ?? "shotok").trim().toLowerCase();
            const UNIT_TO_SHOTOK: Record<string, number> = {
              shotok: 1, shatak: 1, decimal: 1, "": 1,
              katha: SHATAK_PER_KATHA, kattah: SHATAK_PER_KATHA,
              bigha: SHATAK_PER_BIGHA,
              acre: 100, ekor: 100,
            };
            if (!(unit in UNIT_TO_SHOTOK)) {
              throw new Error(`land_size_unit must be one of: shotok, katha, bigha, acre (got "${unit}")`);
            }
            const sizeShotok = Number(raw.land_size) * UNIT_TO_SHOTOK[unit];
            next[i] = { ...r, resolved: { ...(r.resolved ?? {}), dag_canonical: canonicalDag, land_size_shotok: sizeShotok } };
            table = "lands";
            payload = {
              farmer_id: f.id,
              office_id: f.office_id,
              dag_no: canonicalDag,
              land_size: sizeShotok,
              owner_type: (raw.owner_type ?? "owner") as any,
              field_type: (raw.field_type ?? "medium_land") as any,
              mouza: raw.mouza ?? null,
              notes: (raw.notes ?? raw.holding_description ?? "").toString().trim() || null,
              patwari_id: (() => {
                const key = (raw.patwari_name ?? raw.patwari ?? raw.patwari_mobile ?? "").toString().trim();
                if (!key) return null;
                return patwariMap.get(key.toLowerCase()) ?? patwariMap.get(key) ?? null;
              })(),
            };
          } else if (mod === "land_relations") {
            const owner = farmerMap.get(String(raw.owner_account_number));
            if (!owner) throw new Error(`Owner farmer not found for owner_account_number=${raw.owner_account_number ?? ""}`);
            const tenantAcc = raw.tenant_account_number ?? raw.sharecropper_account_number;
            const sharecropper = tenantAcc ? farmerMap.get(String(tenantAcc)) : null;
            if (tenantAcc && !sharecropper) {
              throw new Error(`Tenant farmer not found for tenant_account_number=${tenantAcc}`);
            }
            if (sharecropper && sharecropper.id === owner.id) {
              throw new Error("Owner and Tenant must be different farmers");
            }
            const dag = raw.dag_no ? String(raw.dag_no).trim() : null;
            if (!dag) throw new Error("dag_no required to identify the land");
            const { data: landRow, error: landErr } = await supabase
              .from("lands")
              .select("id, office_id")
              .eq("farmer_id", owner.id)
              .eq("dag_no", dag)
              .maybeSingle();
            if (landErr) throw landErr;
            if (!landRow) throw new Error(`No land found for owner ${owner.id} with dag_no=${dag}`);
            const share = Number(raw.share_percentage ?? 50);
            if (!(share > 0 && share <= 100)) throw new Error("share_percentage must be > 0 and ≤ 100");
            const validFrom = raw.valid_from ?? new Date().toISOString().slice(0, 10);
            const validTo = raw.valid_to || null;

            // Validate: total share for this land in overlapping period must not exceed 100
            const { data: existing } = await supabase
              .from("land_relations")
              .select("id, share_percentage, owner_farmer_id, sharecropper_farmer_id, valid_from, valid_to")
              .eq("land_id", landRow.id);
            const overlap = (existing ?? []).filter((e: any) => {
              const eFrom = e.valid_from;
              const eTo = e.valid_to ?? "9999-12-31";
              const nTo = validTo ?? "9999-12-31";
              return !(eTo < validFrom || eFrom > nTo);
            });
            const isSame = (e: any) =>
              e.owner_farmer_id === owner.id &&
              (e.sharecropper_farmer_id ?? null) === (sharecropper ? sharecropper.id : null) &&
              e.valid_from === validFrom &&
              (e.valid_to ?? null) === validTo;
            const totalOther = overlap.filter((e: any) => !isSame(e))
              .reduce((s: number, e: any) => s + Number(e.share_percentage || 0), 0);
            if (totalOther + share > 100) {
              throw new Error(`Share total ${totalOther + share}% exceeds 100% for land_id=${landRow.id} in overlapping period`);
            }

            // Capture resolved info on the row for error reports / UI
            next[i] = {
              ...r,
              resolved: {
                owner_farmer_id: owner.id,
                sharecropper_farmer_id: sharecropper ? sharecropper.id : null,
                land_id: landRow.id,
                dag_no: dag,
              },
            };

            const lrPayload = {
              land_id: landRow.id,
              office_id: landRow.office_id ?? owner.office_id,
              owner_farmer_id: owner.id,
              sharecropper_farmer_id: sharecropper ? sharecropper.id : null,
              share_percentage: share,
              valid_from: validFrom,
              valid_to: validTo,
              note: raw.note ?? null,
              created_by: user?.id,
            };

            if (upsertMode) {
              if (dryRun) {
                next[i] = { ...next[i], status: "ok", message: "Will upsert (preview)" };
                if (i % 10 === 0) setRows([...next]);
                continue;
              }
              const { error: upErr } = await supabase
                .from("land_relations")
                .upsert(lrPayload, {
                  onConflict: "land_id,owner_farmer_id,sharecropper_farmer_id,valid_from,valid_to",
                  ignoreDuplicates: false,
                });
              if (upErr) throw upErr;
              next[i] = { ...next[i], status: "ok" };
              if (i % 10 === 0) setRows([...next]);
              continue;
            }
            table = "land_relations";
            payload = lrPayload;
          } else if (mod === "loans") {
            const f = farmerMap.get(String(raw.account_number));
            if (!f) throw new Error("Farmer not found for account_number");
            if (!raw.principal || Number(raw.principal) <= 0) throw new Error("principal required");
            table = "loans";
            payload = {
              farmer_id: f.id,
              office_id: f.office_id,
              principal: Number(raw.principal),
              interest_rate: Number(raw.interest_rate ?? 0),
              total_payable: Number(raw.total_payable ?? raw.principal),
              issued_on: raw.issued_on ?? new Date().toISOString().slice(0, 10),
              status: "approved" as any,
              note: raw.note ?? null,
              created_by: user?.id,
              approved_by: user?.id,
            };
          } else if (mod === "loan_payments") {
            const f = farmerMap.get(String(raw.account_number));
            if (!f) throw new Error("Farmer not found for account_number");
            const loanId = loanByFarmer.get(f.id);
            if (!loanId) throw new Error("No active loan found for farmer");
            if (!raw.amount || Number(raw.amount) <= 0) throw new Error("amount required");
            table = "loan_payments";
            payload = {
              loan_id: loanId,
              office_id: f.office_id,
              amount: Number(raw.amount),
              paid_on: raw.paid_on ?? new Date().toISOString().slice(0, 10),
              note: raw.note ?? null,
              status: "approved" as any,
              collected_by: user?.id,
              approved_by: user?.id,
              approved_at: new Date().toISOString(),
            };
          } else if (mod === "loan_installments") {
            const f = farmerMap.get(String(raw.account_number));
            if (!f) throw new Error("Farmer not found for account_number");
            const loanId = loanByFarmer.get(f.id);
            if (!loanId) throw new Error("Installment data missing. Auto-generate or fix the import. / ইন্সটলমেন্ট ডাটা অনুপস্থিত। অটো-জেনারেট অথবা ইমপোর্ট সংশোধন করুন।");
            const instNo = Number(raw.installment_no);
            if (!Number.isFinite(instNo) || instNo < 1) throw new Error("invalid installment_no");
            if (!raw.due_date) throw new Error("due_date required");
            if (!raw.amount || Number(raw.amount) <= 0) throw new Error("amount required");
            const allowedStatus = ["due", "paid", "missed", "partial"];
            const st = String(raw.status ?? "due").toLowerCase();
            if (!allowedStatus.includes(st)) throw new Error("status must be due/paid/missed/partial");
            table = "loan_installments";
            payload = {
              loan_id: loanId,
              office_id: f.office_id,
              installment_no: instNo,
              due_date: raw.due_date,
              amount: Number(raw.amount),
              status: st as any,
              paid_amount: st === "paid" ? Number(raw.amount) : 0,
            };
          } else if (mod === "savings") {
            const f = farmerMap.get(String(raw.account_number));
            if (!f) throw new Error("Farmer not found for account_number");
            const type = String(raw.type ?? "").toLowerCase();
            if (!["deposit", "withdrawal"].includes(type)) throw new Error("type must be deposit or withdrawal");
            if (!raw.amount || Number(raw.amount) <= 0) throw new Error("amount required");
            table = "savings_transactions";
            payload = {
              farmer_id: f.id,
              office_id: f.office_id,
              type: type as any,
              amount: Number(raw.amount),
              txn_date: raw.txn_date ?? new Date().toISOString().slice(0, 10),
              status: "approved" as any,
              note: raw.note ?? null,
              created_by: user?.id,
              approved_by: user?.id,
            };
          } else if (mod === "payments") {
            const f = farmerMap.get(String(raw.account_number));
            if (!f) throw new Error("Farmer not found for account_number");
            const kind = String(raw.kind ?? "").toLowerCase();
            if (!["savings", "loan", "irrigation"].includes(kind)) throw new Error("kind must be savings/loan/irrigation");
            if (!raw.amount || Number(raw.amount) <= 0) throw new Error("amount required");
            table = "payments";
            payload = {
              farmer_id: f.id,
              office_id: f.office_id,
              kind: kind as any,
              amount: Number(raw.amount),
              method: raw.method ?? "cash",
              note: raw.note ?? null,
              status: "approved" as any,
              collected_by: user?.id,
              approved_by: user?.id,
              approved_at: new Date().toISOString(),
            };
          } else if (mod === "ledger") {
            const accountId = accountMap.get(String(raw.account_code));
            if (!accountId) throw new Error("Unknown account_code");
            const debit = Number(raw.debit ?? 0);
            const credit = Number(raw.credit ?? 0);
            if (debit < 0 || credit < 0) throw new Error("debit/credit must be ≥ 0");
            if (debit === 0 && credit === 0) throw new Error("debit or credit required");
            table = "ledger_entries";
            payload = {
              account_id: accountId,
              entry_date: raw.entry_date ?? new Date().toISOString().slice(0, 10),
              debit, credit,
              description: raw.description ?? null,
              reference_type: raw.reference_type ?? "manual_import",
              created_by: user?.id,
            };
          } else if (mod === "irrigation") {
            const f = farmerMap.get(String(raw.account_number));
            if (!f) throw new Error(`Farmer not found for account_number=${raw.account_number ?? ""}`);
            const dag = raw.dag_no ? String(raw.dag_no).trim() : null;
            if (!dag) throw new Error("dag_no required");
            const { data: landRow } = await supabase
              .from("lands").select("id, office_id")
              .eq("farmer_id", f.id).eq("dag_no", dag).maybeSingle();
            if (!landRow) throw new Error(`No land found for farmer with dag_no=${dag}`);
            const year = Number(raw.season_year);
            const stype = String(raw.season_type ?? "").toLowerCase();
            if (!year || !stype) throw new Error("season_year and season_type required");
            const { data: season } = await supabase
              .from("seasons").select("id").eq("year", year).eq("type", stype as any).maybeSingle();
            if (!season) throw new Error(`Season not found year=${year} type=${stype}`);
            const qty = Number(raw.quantity ?? 0);
            const base = Number(raw.base_charge ?? 0);
            const canal = Number(raw.canal_charge ?? 0);
            const maint = Number(raw.maintenance_charge ?? 0);
            const other = Number(raw.other_charge ?? 0);
            const prevDue = Number(raw.previous_due_brought ?? 0);
            const penalty = Number(raw.penalty_amount ?? 0);
            const total = +(base + canal + maint + other + prevDue + penalty).toFixed(2);
            if (total <= 0) throw new Error("total charge must be > 0");
            table = "irrigation_charges";
            payload = {
              farmer_id: f.id,
              land_id: landRow.id,
              season_id: season.id,
              office_id: landRow.office_id ?? f.office_id,
              basis: "per_size" as any,
              quantity: qty,
              base_charge: base,
              canal_charge: canal,
              maintenance_charge: maint,
              other_charge: other,
              previous_due_brought: prevDue,
              penalty_amount: penalty,
              total,
              due_amount: total,
              entry_date: raw.entry_date ?? new Date().toISOString().slice(0, 10),
              note: raw.note ?? null,
              created_by: user?.id,
            };
          } else if (mod === "cashbook_receipts") {
            const kind = String(raw.kind ?? "").toLowerCase();
            const allowedKinds = ["irrigation","bigha_rent","pond","crop_sale","scrap","loan_taken","donation","savings_deposit","share","other"];
            if (!allowedKinds.includes(kind)) throw new Error(`kind must be one of ${allowedKinds.join("/")}`);
            const amt = Number(raw.amount ?? 0);
            if (amt <= 0) throw new Error("amount required");
            const acc = raw.account_number ? String(raw.account_number).trim() : null;
            let f: any = null;
            if (acc) {
              const { data: fdata } = await supabase
                .from("farmers").select("id, office_id").eq("account_number", acc).maybeSingle();
              if (!fdata) throw new Error(`Farmer not found for account_number=${acc}`);
              f = fdata;
            }
            table = "receipts";
            payload = {
              kind: kind as any,
              farmer_id: f?.id ?? null,
              office_id: f?.office_id ?? null,
              amount: amt,
              method: raw.method ?? "cash",
              note: raw.note ?? null,
              receipt_date: raw.receipt_date ?? new Date().toISOString().slice(0, 10),
              collected_by: user?.id,
            };
          } else if (mod === "cashbook_expenses") {
            const head = String(raw.head ?? "").trim();
            if (!head) throw new Error("head required");
            const amt = Number(raw.amount ?? 0);
            if (amt <= 0) throw new Error("amount required");
            table = "expenses";
            payload = {
              head,
              payee: raw.payee ?? null,
              amount: amt,
              method: raw.method ?? "cash",
              note: raw.note ?? null,
              expense_date: raw.expense_date ?? new Date().toISOString().slice(0, 10),
              created_by: user?.id,
            };
          } else if (mod === "shares") {
            const f = farmerMap.get(String(raw.account_number));
            if (!f) throw new Error("Farmer not found for account_number");
            const bal = Number(raw.balance ?? 0);
            if (!(bal >= 0)) throw new Error("balance must be ≥ 0");
            if (dryRun) {
              next[i] = { ...next[i], status: "ok", message: `Will upsert share balance=${bal} (preview)` };
              if (i % 10 === 0) setRows([...next]);
              continue;
            }
            const { error: upErr } = await supabase
              .from("shares")
              .upsert({ farmer_id: f.id, office_id: f.office_id, balance: bal }, { onConflict: "farmer_id" });
            if (upErr) throw upErr;
            next[i] = { ...next[i], status: "ok" };
            if (i % 10 === 0) setRows([...next]);
            continue;
          } else if (mod === "patwaris") {
            const name = String(raw.name ?? "").trim();
            if (!name) throw new Error("name required");
            let mouzaId: string | null = null;
            if (raw.mouza) {
              const { data: mz } = await supabase
                .from("mouzas").select("id").eq("name", String(raw.mouza).trim()).maybeSingle();
              if (mz) mouzaId = mz.id;
            }
            table = "patwaris";
            payload = {
              name,
              name_bn: raw.name_bn ?? null,
              mobile: raw.mobile ?? null,
              nid: raw.nid ?? null,
              address: raw.address ?? null,
              mouza_id: mouzaId,
              note: raw.note ?? null,
              is_active: true,
              created_by: user?.id,
            };
          } else if (mod === "mouzas") {
            const name = String(raw.name ?? "").trim();
            if (!name) throw new Error("name required");
            const upName = String(raw.upazila ?? "").trim().toLowerCase();
            const upazilaId = upName ? upazilaMap.get(upName) : null;
            if (!upazilaId) throw new Error("upazila not found");
            table = "mouzas";
            payload = {
              upazila_id: upazilaId,
              name,
              name_bn: raw.name_bn ?? null,
              code: raw.code ?? null,
              is_active: true,
            };
          } else if (mod === "seasons") {
            const year = Number(raw.year ?? 0);
            const type = String(raw.type ?? "").trim();
            if (!year) throw new Error("year required");
            if (!type) throw new Error("type required");
            table = "seasons";
            payload = {
              year,
              type,
              name: raw.name ?? null,
              fiscal_year: raw.fiscal_year ?? null,
              start_date: raw.start_date || null,
              end_date: raw.end_date || null,
              due_date: raw.due_date || null,
              status: String(raw.status ?? "active").trim() || "active",
            };
          } else if (mod === "offices") {
            const name = String(raw.name ?? "").trim();
            if (!name) throw new Error("name required");
            table = "offices";
            payload = {
              name,
              registration_no: raw.registration_no ?? null,
              established_on: raw.established_on || null,
              contact: raw.contact ?? null,
              address: raw.address ?? null,
            };
          } else if (mod === "bank_accounts") {
            const bankName = String(raw.bank_name ?? "").trim();
            const accountNo = String(raw.account_no ?? "").trim();
            if (!bankName) throw new Error("bank_name required");
            if (!accountNo) throw new Error("account_no required");
            table = "bank_accounts";
            payload = {
              bank_name: bankName,
              branch: raw.branch ?? null,
              account_no: accountNo,
              account_title: raw.account_title ?? null,
              account_type: String(raw.account_type ?? "savings").trim() || "savings",
              opening_balance: Number(raw.opening_balance ?? 0) || 0,
              stream: String(raw.stream ?? "other").trim() || "other",
              is_active: true,
            };
          } else if (mod === "bank_transactions") {
            const accountNo = String(raw.account_no ?? "").trim();
            const bankAccountId = bankAcctMap.get(accountNo);
            if (!bankAccountId) throw new Error("bank account not found for account_no");
            const txnType = String(raw.txn_type ?? "").trim();
            if (!txnType) throw new Error("txn_type required");
            const amt = Number(raw.amount ?? 0);
            if (!(amt > 0)) throw new Error("amount must be > 0");
            table = "bank_transactions";
            payload = {
              bank_account_id: bankAccountId,
              txn_date: raw.txn_date || new Date().toISOString().slice(0, 10),
              txn_type: txnType,
              amount: amt,
              reference_no: raw.reference_no ?? null,
              note: raw.note ?? null,
              created_by: user?.id,
            };
          } else if (mod === "assets") {
            const code = String(raw.asset_code ?? "").trim();
            const nameEn = String(raw.name_en ?? "").trim();
            if (!code) throw new Error("asset_code required");
            if (!nameEn) throw new Error("name_en required");
            table = "assets";
            payload = {
              asset_code: code,
              name_en: nameEn,
              name_bn: raw.name_bn ?? null,
              serial_no: raw.serial_no ?? null,
              asset_type: String(raw.asset_type ?? "fixed_asset").trim() || "fixed_asset",
              tracking_mode: String(raw.tracking_mode ?? "quantity").trim() || "quantity",
              unit: raw.unit ?? null,
              purchase_price: Number(raw.purchase_price ?? 0) || 0,
              current_status: String(raw.current_status ?? "purchased").trim() || "purchased",
              created_by: user?.id,
            };
          } else if (mod === "loan_guarantors") {
            const borrower = farmerMap.get(String(raw.loan_account_number));
            if (!borrower) throw new Error("Borrower farmer not found for loan_account_number");
            const loanId = loanByFarmer.get(borrower.id);
            if (!loanId) throw new Error("No active/approved loan found for borrower");
            const name = String(raw.name ?? "").trim();
            if (!name) throw new Error("name required");
            const guarantorFarmer = raw.guarantor_account_number
              ? farmerMap.get(String(raw.guarantor_account_number))
              : null;
            table = "loan_guarantors";
            payload = {
              loan_id: loanId,
              farmer_id: guarantorFarmer?.id ?? null,
              name,
              father_name: raw.father_name ?? null,
              village: raw.village ?? null,
              mobile: raw.mobile ?? null,
              nid: raw.nid ?? null,
              office_id: borrower.office_id ?? null,
              role: String(raw.role ?? "guarantor").trim() || "guarantor",
            };
          } else if (mod === "farmers") {
            const acc = String(raw.account_number ?? "").trim();
            const nameEn = String(raw.name_en ?? "").trim();
            if (!acc) throw new Error("account_number required");
            if (!nameEn) throw new Error("name_en required");
            if (farmerMap.get(acc)) throw new Error(`Farmer already exists for account_number=${acc}`);
            table = "farmers";
            payload = {
              farmer_code: acc,
              account_number: acc,
              name_en: nameEn,
              name_bn: raw.name_bn ?? null,
              father_name: raw.father_name ?? null,
              mother_name: raw.mother_name ?? null,
              mobile: raw.mobile ?? null,
              nid: raw.nid ?? null,
              village: raw.village ?? null,
              address: raw.address ?? null,
              status: String(raw.status ?? "active").trim() || "active",
              created_by: user?.id,
            };
          } else if (mod === "savings_plans") {
            const name = String(raw.name ?? "").trim();
            if (!name) throw new Error("name required");
            const dur = Number(raw.duration_months ?? 0);
            if (!(dur > 0)) throw new Error("duration_months must be > 0");
            table = "savings_plans";
            payload = {
              name,
              name_bn: raw.name_bn ?? null,
              duration_months: dur,
              installment_type: String(raw.installment_type ?? "monthly").trim() || "monthly",
              installment_amount: Number(raw.installment_amount ?? 0) || 0,
              interest_rate: Number(raw.interest_rate ?? 0) || 0,
              maturity_type: String(raw.maturity_type ?? "simple").trim() || "simple",
              is_active: true,
              created_by: user?.id,
            };
          } else if (mod === "loan_plans") {
            const name = String(raw.name ?? "").trim();
            if (!name) throw new Error("name required");
            const dur = Number(raw.duration_months ?? 0);
            if (!(dur > 0)) throw new Error("duration_months must be > 0");
            table = "loan_plans";
            payload = {
              name,
              name_bn: raw.name_bn ?? null,
              duration_months: dur,
              installment_type: String(raw.installment_type ?? "monthly").trim() || "monthly",
              interest_rate: Number(raw.interest_rate ?? 0) || 0,
              penalty_type: String(raw.penalty_type ?? "percentage").trim() || "percentage",
              penalty_value: Number(raw.penalty_value ?? 0) || 0,
              grace_period_days: Number(raw.grace_period_days ?? 0) || 0,
              is_active: true,
              created_by: user?.id,
            };
          } else if (mod === "farmer_savings_plans") {
            const f = farmerMap.get(String(raw.account_number));
            if (!f) throw new Error("Farmer not found for account_number");
            const plan = savingsPlanMap.get(String(raw.plan_name ?? "").trim().toLowerCase());
            if (!plan) throw new Error(`Savings plan not found for plan_name=${raw.plan_name ?? ""}`);
            table = "farmer_savings_plans";
            payload = {
              farmer_id: f.id,
              plan_id: plan.id,
              office_id: f.office_id ?? plan.office_id ?? null,
              start_date: raw.start_date || new Date().toISOString().slice(0, 10),
              expected_total: Number(raw.expected_total ?? 0) || 0,
              expected_interest: Number(raw.expected_interest ?? 0) || 0,
              maturity_amount: Number(raw.maturity_amount ?? 0) || 0,
              status: String(raw.status ?? "active").trim() || "active",
              created_by: user?.id,
            };
          } else if (mod === "irrigation_categories") {
            const code = String(raw.code ?? "").trim();
            if (!code) throw new Error("code required");
            table = "irrigation_categories";
            payload = {
              code,
              name_bn: raw.name_bn ?? null,
              name_en: raw.name_en ?? null,
              calculation_basis: String(raw.calculation_basis ?? "per_shotok").trim() || "per_shotok",
              allow_manual_negotiation: String(raw.allow_manual_negotiation ?? "").trim().toLowerCase() === "true",
              is_active: true,
              created_by: user?.id,
            };
          } else if (mod === "irrigation_rates") {
            const year = Number(raw.season_year ?? 0);
            const stype = String(raw.season_type ?? "").trim().toLowerCase();
            if (!year) throw new Error("season_year required");
            if (!stype) throw new Error("season_type required");
            const seasonId = seasonMap.get(`${year}|${stype}`);
            if (!seasonId) throw new Error(`Season not found for ${year} ${stype}`);
            table = "irrigation_rates";
            payload = {
              season_id: seasonId,
              basis: String(raw.basis ?? "per_size").trim() || "per_size",
              base_rate: Number(raw.base_rate ?? 0) || 0,
              canal_charge: Number(raw.canal_charge ?? 0) || 0,
              maintenance_charge: Number(raw.maintenance_charge ?? 0) || 0,
              other_charge: Number(raw.other_charge ?? 0) || 0,
              note: raw.note ?? null,
              is_active: true,
              created_by: user?.id,
            };
          }

          if (dryRun) {
            next[i] = { ...next[i], status: "ok", message: `Will insert into ${table} (preview)` };
          } else {
            const { data: inserted, error } = await supabase.from(table as any).insert(payload).select("id").maybeSingle();
            if (error) throw error;
            const newId = (inserted as any)?.id;
            if (newId) insertedRecords.push({ table, id: newId });
            next[i] = { ...next[i], status: "ok", resolved: { ...(next[i].resolved ?? {}), record_id: newId } };
          }
        } catch (e: any) {
          next[i] = { ...next[i], status: "error", message: e?.message ?? String(e) };
        }

        setProgress({
          current: i + 1,
          total: next.length,
          ok: next.slice(0, i + 1).filter((x) => x.status === "ok").length,
          failed: next.slice(0, i + 1).filter((x) => x.status === "error").length,
        });
        if (i % 10 === 0) setRows([...next]);
      }

      setRows([...next]);
      const ok = next.filter((x) => x.status === "ok").length;
      let er = next.filter((x) => x.status === "error").length;
      const duplicates = next.filter((x) => x.status === "error" && /Duplicate of row/.test(x.message ?? "")).length;

      // Atomic mode: if any row failed during a real run, roll back everything inserted.
      let rolledBack = false;
      if (!dryRun && atomicMode && er > 0 && insertedRecords.length > 0) {
        const byTable = new Map<string, string[]>();
        insertedRecords.forEach(({ table, id }) => {
          const arr = byTable.get(table) ?? [];
          arr.push(id);
          byTable.set(table, arr);
        });
        for (const [table, ids] of byTable) {
          await supabase.from(table as any).delete().in("id", ids);
        }
        rolledBack = true;
        for (let i = 0; i < next.length; i++) {
          if (next[i].status === "ok" && next[i].resolved?.record_id) {
            next[i] = { ...next[i], status: "error", message: "Rolled back (atomic import — another row failed)" };
          }
        }
        setRows([...next]);
        er = next.filter((x) => x.status === "error").length;
      }

      // Ledger verification + audit log (only on real run)
      if (!dryRun) {
        const ledgerKinds = ["payments", "irrigation", "cashbook_receipts", "cashbook_expenses"];
        if (ledgerKinds.includes(mod)) {
          const ids = next
            .filter((x) => x.status === "ok" && x.resolved?.record_id)
            .map((x) => ({ idx: x.idx, id: x.resolved!.record_id as string }));
          if (ids.length) {
            const { data: led } = await supabase
              .from("ledger_entries")
              .select("id,reference_id,debit,credit")
              .in("reference_id", ids.map((x) => x.id));
            const grouped = new Map<string, string[]>();
            (led ?? []).forEach((e: any) => {
              const arr = grouped.get(e.reference_id) ?? [];
              arr.push(e.id);
              grouped.set(e.reference_id, arr);
            });
            setLedgerVerify(ids.map((x) => ({
              idx: x.idx, record_id: x.id,
              ledger_ids: grouped.get(x.id) ?? [],
              ok: (grouped.get(x.id) ?? []).length > 0,
            })));
          }
        }

        const inserted = rolledBack ? 0 : insertedRecords.length;
        const updated = rolledBack ? 0 : Math.max(0, ok - insertedRecords.length);

        // Persist audit log
        try {
          const officeId = (next.find((r) => r.resolved?.office_id)?.resolved?.office_id) ?? null;
          await supabase.from("import_audit_logs" as any).insert({
            user_id: user?.id ?? null,
            office_id: officeId,
            module: mod,
            mode: rolledBack ? "rolled_back" : upsertMode ? "upsert" : "insert",
            rows_processed: next.length,
            rows_inserted: inserted,
            rows_updated: updated,
            rows_failed: er,
            summary: {
              duplicates,
              rolled_back: rolledBack,
              record_ids: next.filter((r) => r.resolved?.record_id).map((r) => ({ row: r.idx + 2, id: r.resolved!.record_id })),
            },
          });
          loadRecentImports();
        } catch (auditErr) {
          console.warn("Audit log insert failed", auditErr);
        }

        setSummary({
          processed: next.length, inserted, updated, skipped: duplicates,
          failed: er, duplicates, rolledBack,
        });

        if (rolledBack) toast.error(`Rolled back — ${er} row(s) failed. No data was saved. Fix errors and retry.`);
        else if (er === 0) toast.success(`Imported ${inserted}, updated ${updated} rows successfully`);
        else toast.warning(`Imported ${inserted}, updated ${updated}, failed ${er}. Download error report.`);
      } else {
        toast.info(`Preview ready: ${ok} rows will be processed, ${er} have errors.`);
      }
    } catch (e: any) {
      toast.error(`Import failed: ${e.message}`);
    } finally {
      setWorking(false);
      setTimeout(() => setProgress(null), 1500);
    }
  }

  if (!isAdmin) {
    return (
      <>
        <PageHeader title="Data Import" />
        <Alert variant="destructive" className="mt-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Access denied</AlertTitle>
          <AlertDescription>You need admin permissions to import data.</AlertDescription>
        </Alert>
      </>
    );
  }

  const tpl = TEMPLATES[mod];

  async function previewSampleReceipt(action: "preview" | "download" = "preview") {
    const sample = buildSampleReceipt(sampleType);
    const missing = findMissingSampleFields(sampleType, sample);
    if (missing.length > 0) {
      toast.warning(`⚠ কিছু ফিল্ড রশিদে দেখা যাবে না: ${missing.join(", ")}`, { duration: 6000 });
    }
    try {
      if (action === "download") {
        await downloadBnReceiptPdf(sample, "both");
        toast.success("A5 রশিদ PDF ডাউনলোড হয়েছে");
        return;
      }
      const uri = await previewBnReceiptPdf(sample, "both");
      const w = window.open();
      if (w) w.document.write(`<iframe src="${uri}" style="border:0;width:100%;height:100%;" allowfullscreen></iframe>`);
      else toast.error("Popup blocked / পপআপ ব্লকড");
    } catch (e: any) {
      toast.error(e?.message ?? "Preview failed");
    }
  }

  return (
    <>
      <PageHeader title="Data Import" />

      <Card className="p-4 space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Label>Module</Label>
            <Select value={mod} onValueChange={(v) => { setMod(v as Module); setRows([]); setFile(null); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="lands">Lands</SelectItem>
                <SelectItem value="land_relations">Land Relations (owner/tenant)</SelectItem>
                <SelectItem value="loans">Loans</SelectItem>
                <SelectItem value="loan_payments">Loan Payments</SelectItem>
                <SelectItem value="loan_installments">Loan Installments</SelectItem>
                <SelectItem value="savings">Savings Transactions</SelectItem>
                <SelectItem value="payments">Payments (generic)</SelectItem>
                <SelectItem value="irrigation">Irrigation Charges</SelectItem>
                <SelectItem value="cashbook_receipts">Cashbook — Receipts</SelectItem>
                <SelectItem value="cashbook_expenses">Cashbook — Expenses</SelectItem>
                <SelectItem value="shares">Share Balance (upsert)</SelectItem>
                <SelectItem value="patwaris">Patwaris</SelectItem>
                <SelectItem value="loan_guarantors">Loan Guarantors / Nominees</SelectItem>
                <SelectItem value="mouzas">Mouzas</SelectItem>
                <SelectItem value="seasons">Seasons</SelectItem>
                <SelectItem value="offices">Offices / Branches</SelectItem>
                <SelectItem value="bank_accounts">Bank Accounts</SelectItem>
                <SelectItem value="bank_transactions">Bank Transactions</SelectItem>
                <SelectItem value="assets">Assets</SelectItem>
                <SelectItem value="farmers">Farmers (members)</SelectItem>
                <SelectItem value="savings_plans">Savings Plans</SelectItem>
                <SelectItem value="loan_plans">Loan Plans</SelectItem>
                <SelectItem value="farmer_savings_plans">Farmer Savings Plans (enrollment)</SelectItem>
                <SelectItem value="irrigation_categories">Irrigation Categories</SelectItem>
                <SelectItem value="irrigation_rates">Irrigation Rates (per season)</SelectItem>
                {isSuper && <SelectItem value="ledger">Ledger Entries (super-admin)</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 flex flex-wrap items-end gap-2">
            <Button variant="outline" onClick={() => downloadTemplate(mod)}>
              <Download className="h-4 w-4 mr-1" /> Template (.xlsx)
            </Button>
            <Button variant="outline" onClick={() => downloadCsvTemplate(mod as any)}>
              <FileSpreadsheet className="h-4 w-4 mr-1" /> CSV Template
            </Button>
            <Select value={sampleType} onValueChange={(v) => setSampleType(v as SampleReceiptType)}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(SAMPLE_RECEIPT_TYPE_LABELS) as SampleReceiptType[]).map((t) => (
                  <SelectItem key={t} value={t}>{SAMPLE_RECEIPT_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => previewSampleReceipt("preview")}>
              <FileSpreadsheet className="h-4 w-4 mr-1" /> নমুনা রশিদ প্রিভিউ
            </Button>
            <Button variant="outline" onClick={() => previewSampleReceipt("download")}>
              <Download className="h-4 w-4 mr-1" /> PDF ডাউনলোড
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls,.txt,.tsv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
            <Button onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1" /> Choose File
            </Button>
            {file && <span className="text-sm text-muted-foreground">{file.name}</span>}
            {mod === "land_relations" && (
              <label className="flex items-center gap-2 text-sm ml-2">
                <input type="checkbox" checked={upsertMode} onChange={(e) => setUpsertMode(e.target.checked)} />
                Upsert mode (update existing relation)
              </label>
            )}
            <label className="flex items-center gap-2 text-sm ml-2">
              <input type="checkbox" checked={atomicMode} onChange={(e) => setAtomicMode(e.target.checked)} />
              Atomic (roll back all if any row fails)
            </label>
          </div>
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <div><strong>Required columns:</strong> {tpl.columns.join(", ")}</div>
          <div className="text-[11px]">
            💡 <strong>account_number</strong> = farmer-এর Voter / Savings A/C No (৫ ডিজিট নম্বর)। Farmer তৈরি করার সময় auto-generate হয়। Bulk Farmer Import-এ <code>voter_number</code> কলাম দিয়ে এটি আপনি সরাসরি দিতে পারেন।
          {(mod === "lands" || mod === "irrigation" || mod === "land_relations") && (
            <div className="text-[11px]">
              🏷️ <strong>dag_no</strong> এ একটি জমির একাধিক দাগ নম্বর কমা দিয়ে দিতে পারেন (যেমন <code>123, 124/A, 125-B</code>)। প্রতিটি টোকেনে শুধু সংখ্যা/অক্ষর/<code>/</code>/<code>-</code> ব্যবহার করা যাবে। ইমপোর্টের সময় canonical format-এ অটো রূপান্তর হবে এবং invalid হলে সেই row error দেখাবে।
            </div>
          )}
        </div>
        </div>

        {rows.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Total: {stats.total}</Badge>
            <Badge variant="default" className="bg-green-600 hover:bg-green-600">OK: {stats.ok}</Badge>
            <Badge variant="destructive">Errors: {stats.err}</Badge>
            <Badge variant="secondary">Pending: {stats.pending}</Badge>
            <div className="ml-auto flex gap-2">
              {stats.err > 0 && (
                <>
                  <Button variant="outline" onClick={() => downloadErrorReport(rows, "xlsx")}>
                    <Download className="h-4 w-4 mr-1" /> Error Report (.xlsx)
                  </Button>
                  <Button variant="outline" onClick={() => downloadErrorReport(rows, "csv")}>
                    <FileSpreadsheet className="h-4 w-4 mr-1" /> Error Report (.csv)
                  </Button>
                </>
              )}
              <Button variant="outline" onClick={() => importAll(true)} disabled={working || stats.pending === 0}>
                {working ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                Preview ({stats.pending})
              </Button>
              <Button onClick={() => importAll(false)} disabled={working || stats.pending === 0}>
                {working ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                Confirm Import
              </Button>
            </div>
          </div>
        )}
      </Card>

      {progress && (
        <Card className="mt-4 p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Importing “{mod}” …</span>
            <span className="text-muted-foreground">
              {progress.current} / {progress.total} • OK {progress.ok} • Failed {progress.failed}
            </span>
          </div>
          <Progress value={progress.total ? (progress.current / progress.total) * 100 : 0} />
        </Card>
      )}

      {summary && (
        <Card className="mt-4 p-4">
          <div className="font-medium mb-2">
            Import summary {summary.rolledBack && <Badge variant="destructive" className="ml-2">Rolled back</Badge>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Processed: {summary.processed}</Badge>
            <Badge className="bg-green-600 hover:bg-green-600">Imported: {summary.inserted}</Badge>
            <Badge className="bg-blue-600 hover:bg-blue-600">Updated: {summary.updated}</Badge>
            <Badge variant="secondary">Duplicates skipped: {summary.duplicates}</Badge>
            <Badge variant="destructive">Failed: {summary.failed}</Badge>
          </div>
          {summary.rolledBack && (
            <p className="text-xs text-destructive mt-2">
              Atomic import: one or more rows failed, so all inserted records were removed. No partial data was saved.
            </p>
          )}
        </Card>
      )}



      {rows.length > 0 && (
        <Card className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead className="w-24">Status</TableHead>
                {tpl.columns.map((c) => <TableHead key={c}>{c}</TableHead>)}
                <TableHead>Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, 200).map((r) => (
                <TableRow key={r.idx} className={r.status === "error" ? "bg-destructive/5" : r.status === "ok" ? "bg-green-500/5" : ""}>
                  <TableCell>{r.idx + 1}</TableCell>
                  <TableCell>
                    {r.status === "ok" && <Badge className="bg-green-600">OK</Badge>}
                    {r.status === "error" && <Badge variant="destructive">Error</Badge>}
                    {r.status === "pending" && <Badge variant="secondary">Pending</Badge>}
                  </TableCell>
                  {tpl.columns.map((c) => {
                    if (c === "dag_no" && (mod === "lands" || mod === "irrigation" || mod === "land_relations")) {
                      const canonical = r.resolved?.dag_canonical ?? formatDagNumbers(String(r.raw[c] ?? ""));
                      const original = String(r.raw[c] ?? "");
                      return (
                        <TableCell key={c} className="text-xs">
                          <div className="font-mono">{original || "—"}</div>
                          {canonical && canonical !== original && (
                            <div className="text-[10px] text-muted-foreground">→ {canonical}</div>
                          )}
                        </TableCell>
                      );
                    }
                    return <TableCell key={c}>{String(r.raw[c] ?? "")}</TableCell>;
                  })}
                  <TableCell className="text-xs text-destructive">{r.message ?? ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {rows.length > 200 && (
            <div className="p-2 text-xs text-muted-foreground text-center">
              Showing first 200 of {rows.length} rows.
            </div>
          )}
        </Card>
      )}

      {ledgerVerify.length > 0 && (
        <Card className="mt-4">
          <div className="p-3 border-b font-medium">Ledger posting verification</div>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Row</TableHead><TableHead>Record ID</TableHead>
              <TableHead>Ledger Entry IDs</TableHead><TableHead>Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {ledgerVerify.map((v) => (
                <TableRow key={v.record_id}>
                  <TableCell>{v.idx + 2}</TableCell>
                  <TableCell className="font-mono text-xs">{v.record_id}</TableCell>
                  <TableCell className="font-mono text-xs">{v.ledger_ids.join(", ") || "—"}</TableCell>
                  <TableCell>{v.ok ? <Badge className="bg-green-600">Posted</Badge> : <Badge variant="destructive">Missing</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {recentImports.length > 0 && (
        <Card className="mt-4">
          <div className="p-3 border-b font-medium">Recent imports</div>
          <Table>
            <TableHeader><TableRow>
              <TableHead>When</TableHead><TableHead>Module</TableHead><TableHead>Mode</TableHead>
              <TableHead>Processed</TableHead><TableHead>Inserted</TableHead><TableHead>Failed</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {recentImports.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{new Date(r.created_at).toLocaleString()}</TableCell>
                  <TableCell>{r.module}</TableCell>
                  <TableCell>{r.mode}</TableCell>
                  <TableCell>{r.rows_processed}</TableCell>
                  <TableCell>{r.rows_inserted}</TableCell>
                  <TableCell>{r.rows_failed > 0 ? <Badge variant="destructive">{r.rows_failed}</Badge> : r.rows_failed}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
