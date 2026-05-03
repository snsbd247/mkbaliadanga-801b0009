import { useMemo, useRef, useState } from "react";
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
import { Upload, Download, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

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
  | "savings"
  | "payments"
  | "irrigation"
  | "cashbook_receipts"
  | "cashbook_expenses"
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
    columns: ["account_number", "dag_no", "land_size", "owner_type", "field_type", "mouza"],
    sample: { account_number: "AC-0001", dag_no: "123/A", land_size: 0.33, owner_type: "owner", field_type: "medium_land", mouza: "" },
  },
  land_relations: {
    columns: ["owner_account_number", "sharecropper_account_number", "dag_no", "share_percentage", "valid_from", "valid_to", "note"],
    sample: { owner_account_number: "100000000001", sharecropper_account_number: "100000000002", dag_no: "123/A", share_percentage: 50, valid_from: "2026-01-01", valid_to: "", note: "" },
  },
  loans: {
    columns: ["account_number", "principal", "interest_rate", "total_payable", "issued_on", "note"],
    sample: { account_number: "AC-0001", principal: 10000, interest_rate: 12, total_payable: 11200, issued_on: "2026-01-15", note: "Crop loan" },
  },
  loan_payments: {
    columns: ["account_number", "amount", "paid_on", "note"],
    sample: { account_number: "AC-0001", amount: 1000, paid_on: "2026-02-15", note: "1st installment" },
  },
  savings: {
    columns: ["account_number", "type", "amount", "txn_date", "note"],
    sample: { account_number: "AC-0001", type: "deposit", amount: 500, txn_date: "2026-02-01", note: "Monthly deposit" },
  },
  payments: {
    columns: ["account_number", "kind", "amount", "method", "note"],
    sample: { account_number: "AC-0001", kind: "savings", amount: 500, method: "cash", note: "" },
  },
  ledger: {
    columns: ["entry_date", "account_code", "debit", "credit", "description", "reference_type"],
    sample: { entry_date: "2026-02-01", account_code: "1010", debit: 500, credit: 0, description: "Cash adjustment", reference_type: "manual" },
  },
  irrigation: {
    columns: ["account_number", "dag_no", "season_year", "season_type", "quantity", "base_charge", "canal_charge", "maintenance_charge", "other_charge", "previous_due_brought", "penalty_amount", "entry_date", "note"],
    sample: { account_number: "100000000001", dag_no: "123/A", season_year: 2026, season_type: "boro", quantity: 0.33, base_charge: 200, canal_charge: 50, maintenance_charge: 20, other_charge: 0, previous_due_brought: 0, penalty_amount: 0, entry_date: "2026-02-01", note: "" },
  },
  cashbook_receipts: {
    columns: ["receipt_date", "kind", "account_number", "amount", "method", "note"],
    sample: { receipt_date: "2026-02-01", kind: "donation", account_number: "", amount: 1000, method: "cash", note: "Anonymous donation" },
  },
  cashbook_expenses: {
    columns: ["expense_date", "head", "payee", "amount", "method", "note"],
    sample: { expense_date: "2026-02-01", head: "Office", payee: "Stationery shop", amount: 500, method: "cash", note: "Pens & paper" },
  },
};

function readBookFromFile(file: File): Promise<XLSX.WorkBook> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      try {
        const wb = XLSX.read(reader.result as ArrayBuffer, { type: "array" });
        resolve(wb);
      } catch (e) { reject(e); }
    };
    reader.readAsArrayBuffer(file);
  });
}

function normalizeKey(k: string) {
  return String(k).trim().toLowerCase().replace(/\s+/g, "_");
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

function downloadTemplate(mod: Module) {
  const tpl = TEMPLATES[mod];
  const ws = XLSX.utils.json_to_sheet([tpl.sample], { header: tpl.columns });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, mod);
  XLSX.writeFile(wb, `import_template_${mod}.xlsx`);
}

function downloadErrorReport(rows: RowResult[]) {
  const errs = rows.filter((r) => r.status === "error");
  if (!errs.length) return;
  const ws = XLSX.utils.json_to_sheet(
    errs.map((r) => ({
      row: r.idx + 2,
      error: r.message,
      ...(r.resolved
        ? Object.fromEntries(Object.entries(r.resolved).map(([k, v]) => [`resolved_${k}`, v]))
        : {}),
      ...r.raw,
    })),
  );
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
      setRows(parsed.map((raw, idx) => ({ idx, raw, status: "pending" })));
      toast.success(`Loaded ${parsed.length} rows`);
    } catch (e: any) {
      toast.error(`Failed to read file: ${e.message}`);
    }
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

  async function importAll() {
    if (!rows.length) return;
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
          if (r.raw.sharecropper_account_number) accountNumbers.push(String(r.raw.sharecropper_account_number).trim());
        } else {
          accountNumbers.push(String(r.raw.account_number ?? "").trim());
        }
      });
      const farmerMap = mod !== "ledger" ? await resolveFarmers(accountNumbers) : new Map();

      const accountMap = mod === "ledger"
        ? await resolveAccountsByCode(next.map((r) => String(r.raw.account_code ?? "").trim()))
        : new Map<string, string>();

      // Pre-fetch latest active loan per farmer for loan_payments mode
      let loanByFarmer = new Map<string, string>();
      if (mod === "loan_payments") {
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
            table = "lands";
            payload = {
              farmer_id: f.id,
              office_id: f.office_id,
              dag_no: raw.dag_no ?? null,
              land_size: Number(raw.land_size),
              owner_type: (raw.owner_type ?? "owner") as any,
              field_type: (raw.field_type ?? "medium_land") as any,
              mouza: raw.mouza ?? null,
            };
          } else if (mod === "land_relations") {
            const owner = farmerMap.get(String(raw.owner_account_number));
            if (!owner) throw new Error(`Owner farmer not found for owner_account_number=${raw.owner_account_number ?? ""}`);
            const sharecropper = raw.sharecropper_account_number
              ? farmerMap.get(String(raw.sharecropper_account_number))
              : null;
            if (raw.sharecropper_account_number && !sharecropper) {
              throw new Error(`Sharecropper farmer not found for sharecropper_account_number=${raw.sharecropper_account_number}`);
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
          }

          const { error } = await supabase.from(table as any).insert(payload);
          if (error) throw error;
          next[i] = { ...next[i], status: "ok" };
        } catch (e: any) {
          next[i] = { ...next[i], status: "error", message: e?.message ?? String(e) };
        }

        if (i % 10 === 0) setRows([...next]);
      }

      setRows([...next]);
      const ok = next.filter((x) => x.status === "ok").length;
      const er = next.filter((x) => x.status === "error").length;
      if (er === 0) toast.success(`Imported ${ok} rows successfully`);
      else toast.warning(`Imported ${ok}, failed ${er}. Download error report.`);
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
                <SelectItem value="land_relations">Land Relations (owner/sharecropper)</SelectItem>
                <SelectItem value="loans">Loans</SelectItem>
                <SelectItem value="loan_payments">Loan Payments</SelectItem>
                <SelectItem value="savings">Savings Transactions</SelectItem>
                <SelectItem value="payments">Payments (generic)</SelectItem>
                <SelectItem value="irrigation">Irrigation Charges</SelectItem>
                <SelectItem value="cashbook_receipts">Cashbook — Receipts</SelectItem>
                <SelectItem value="cashbook_expenses">Cashbook — Expenses</SelectItem>
                {isSuper && <SelectItem value="ledger">Ledger Entries (super-admin)</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 flex flex-wrap items-end gap-2">
            <Button variant="outline" onClick={() => downloadTemplate(mod)}>
              <Download className="h-4 w-4 mr-1" /> Template (.xlsx)
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
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

        <div className="text-xs text-muted-foreground">
          <strong>Required columns:</strong> {tpl.columns.join(", ")}
        </div>

        {rows.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Total: {stats.total}</Badge>
            <Badge variant="default" className="bg-green-600 hover:bg-green-600">OK: {stats.ok}</Badge>
            <Badge variant="destructive">Errors: {stats.err}</Badge>
            <Badge variant="secondary">Pending: {stats.pending}</Badge>
            <div className="ml-auto flex gap-2">
              {stats.err > 0 && (
                <Button variant="outline" onClick={() => downloadErrorReport(rows)}>
                  <Download className="h-4 w-4 mr-1" /> Error Report
                </Button>
              )}
              <Button onClick={importAll} disabled={working || stats.pending === 0}>
                {working ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                Import {stats.pending} rows
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
                  {tpl.columns.map((c) => <TableCell key={c}>{String(r.raw[c] ?? "")}</TableCell>)}
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
    </>
  );
}
