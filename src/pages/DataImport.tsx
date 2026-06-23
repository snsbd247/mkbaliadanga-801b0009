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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Upload, Download, AlertTriangle, CheckCircle2, Loader2, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { downloadCsvTemplate } from "@/lib/importTemplates";
import { validateDagNumbers, formatDagNumbers } from "@/lib/dagNumbers";

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
  | "savings"
  | "payments"
  | "irrigation"
  | "shares"
  | "cashbook_receipts"
  | "cashbook_expenses"
  | "patwaris"
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
    columns: ["account_number", "dag_no", "land_size", "land_size_unit", "owner_type", "field_type", "mouza"],
    sample: { account_number: "10001", dag_no: "123, 124/A", land_size: 33, land_size_unit: "shotok", owner_type: "owner", field_type: "medium_land", mouza: "Mouza A" },
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
  const fileRef = useRef<HTMLInputElement>(null);
  const [upsertMode, setUpsertMode] = useState(false);
  const [ledgerVerify, setLedgerVerify] = useState<Array<{ idx: number; record_id: string; ledger_ids: string[]; ok: boolean }>>([]);
  const [recentImports, setRecentImports] = useState<any[]>([]);

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
    };
    const headerSet = parsed.length ? new Set(Object.keys(parsed[0])) : new Set<string>();
    const req = required[m] ?? TEMPLATES[m].columns;
    const missingCols = req.filter((c) => !headerSet.has(c));
    return parsed.map((raw, idx) => {
      const issues: string[] = [];
      if (missingCols.length) issues.push(`Missing columns: ${missingCols.join(", ")}`);
      for (const col of req) {
        const v = raw[col];
        if (v === null || v === undefined || String(v).trim() === "") {
          issues.push(`${col} is required`);
        }
      }
      if (["lands", "land_relations", "irrigation"].includes(m) && raw.dag_no) {
        const dv = validateDagNumbers(String(raw.dag_no));
        if (!dv.ok) issues.push(`dag_no: ${(dv as any).error}`);
      }
      if (issues.length) return { idx, raw, status: "error", message: issues.join(" • ") };
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
    const next = [...rows];

    try {
      // Pre-resolve farmer mapping where applicable
      const accountNumbers: string[] = [];
      next.forEach((r) => {
        if (mod === "ledger") return;
        if (mod === "land_relations") {
          accountNumbers.push(String(r.raw.owner_account_number ?? "").trim());
          const tenantAcc = r.raw.tenant_account_number ?? r.raw.sharecropper_account_number;
          if (tenantAcc) accountNumbers.push(String(tenantAcc).trim());
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
      if (mod === "loan_payments" || mod === "loan_installments") {
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
            next[i] = { ...r, resolved: { ...(r.resolved ?? {}), dag_canonical: canonicalDag } };
            table = "lands";
            payload = {
              farmer_id: f.id,
              office_id: f.office_id,
              dag_no: canonicalDag,
              land_size: Number(raw.land_size),
              owner_type: (raw.owner_type ?? "owner") as any,
              field_type: (raw.field_type ?? "medium_land") as any,
              mouza: raw.mouza ?? null,
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
          }

          if (dryRun) {
            next[i] = { ...next[i], status: "ok", message: `Will insert into ${table} (preview)` };
          } else {
            const { data: inserted, error } = await supabase.from(table as any).insert(payload).select("id").maybeSingle();
            if (error) throw error;
            next[i] = { ...next[i], status: "ok", resolved: { ...(next[i].resolved ?? {}), record_id: (inserted as any)?.id } };
          }
        } catch (e: any) {
          next[i] = { ...next[i], status: "error", message: e?.message ?? String(e) };
        }

        if (i % 10 === 0) setRows([...next]);
      }

      setRows([...next]);
      const ok = next.filter((x) => x.status === "ok").length;
      const er = next.filter((x) => x.status === "error").length;

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

        // Persist audit log
        try {
          const officeId = (next.find((r) => r.resolved?.office_id)?.resolved?.office_id) ?? null;
          await supabase.from("import_audit_logs" as any).insert({
            user_id: user?.id ?? null,
            office_id: officeId,
            module: mod,
            mode: upsertMode ? "upsert" : "insert",
            rows_processed: next.length,
            rows_inserted: ok,
            rows_updated: 0,
            rows_failed: er,
            summary: {
              record_ids: next.filter((r) => r.resolved?.record_id).map((r) => ({ row: r.idx + 2, id: r.resolved!.record_id })),
            },
          });
          loadRecentImports();
        } catch (auditErr) {
          console.warn("Audit log insert failed", auditErr);
        }

        if (er === 0) toast.success(`Imported ${ok} rows successfully`);
        else toast.warning(`Imported ${ok}, failed ${er}. Download error report.`);
      } else {
        toast.info(`Preview ready: ${ok} rows will be processed, ${er} have errors.`);
      }
    } catch (e: any) {
      toast.error(`Import failed: ${e.message}`);
    } finally {
      setWorking(false);
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
