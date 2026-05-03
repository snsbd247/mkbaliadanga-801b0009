// Monthly ledger reconciliation report.
// Modes:
//  - default (no `mode` or `mode: "report"`): per-account opening / debit / credit / closing for the month + mismatches list
//  - `mode: "detail"`: side-by-side ledger entries vs source row for a single (reference_type, reference_id)
//
// Auth: requires admin / super_admin / committee.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY);

function err(status: number, msg: string) {
  return new Response(JSON.stringify({ error: msg }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function monthBounds(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { startStr: start.toISOString().slice(0, 10), endStr: end.toISOString().slice(0, 10) };
}

// Map reference_type → source table + the column that represents the canonical amount.
const SOURCE_TABLES: Record<string, { table: string; amountField: string; dateField: string }> = {
  savings: { table: "savings_transactions", amountField: "amount", dateField: "txn_date" },
  loan: { table: "loans", amountField: "principal", dateField: "issued_on" },
  loan_payment: { table: "loan_payments", amountField: "amount", dateField: "paid_on" },
  irrigation: { table: "irrigation_charges", amountField: "paid_amount", dateField: "entry_date" },
  expense: { table: "expenses", amountField: "amount", dateField: "expense_date" },
  journal: { table: "journal_entries", amountField: "", dateField: "entry_date" },
};

async function fetchDetail(referenceType: string, referenceId: string) {
  // Ledger entries for this ref
  const { data: ledger } = await admin
    .from("ledger_entries")
    .select("id, entry_date, account_id, debit, credit, description, office_id, created_at")
    .eq("reference_type", referenceType).eq("reference_id", referenceId)
    .order("entry_date", { ascending: true });

  // Resolve account names
  const accountIds = Array.from(new Set((ledger ?? []).map((l: any) => l.account_id).filter(Boolean)));
  const { data: accts } = accountIds.length
    ? await admin.from("accounts").select("id, code, name, type").in("id", accountIds)
    : { data: [] as any[] };
  const acctMap = new Map((accts ?? []).map((a: any) => [a.id, a]));

  const ledgerEntries = (ledger ?? []).map((l: any) => ({
    id: l.id, entry_date: l.entry_date, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0,
    description: l.description, office_id: l.office_id,
    account_code: acctMap.get(l.account_id)?.code ?? null,
    account_name: acctMap.get(l.account_id)?.name ?? null,
    account_type: acctMap.get(l.account_id)?.type ?? null,
  }));
  const ledgerDebit = ledgerEntries.reduce((a, r) => a + r.debit, 0);
  const ledgerCredit = ledgerEntries.reduce((a, r) => a + r.credit, 0);

  // Source row
  let source: any = null;
  let sourceExists = false;
  let sourceAmount: number | null = null;
  const cfg = SOURCE_TABLES[referenceType];
  if (cfg) {
    const { data } = await admin.from(cfg.table as any).select("*").eq("id", referenceId).maybeSingle();
    if (data) {
      sourceExists = true;
      source = data;
      if (cfg.amountField) sourceAmount = Number((data as any)[cfg.amountField] ?? 0);
    }
  }

  return {
    reference_type: referenceType,
    reference_id: referenceId,
    source_exists: sourceExists,
    source,
    source_amount: sourceAmount,
    ledger_entries: ledgerEntries,
    ledger_debit: ledgerDebit,
    ledger_credit: ledgerCredit,
    diff: Math.round((ledgerDebit - ledgerCredit) * 100) / 100,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return err(401, "Unauthorized");
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: claimsData, error: claimsErr } = await userClient.auth.getUser();
    if (claimsErr || !claimsData?.user?.id) return err(401, "Unauthorized");
    const userId = claimsData.user.id as string;
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
    const isAllowed = (roles ?? []).some((r: any) => ["super_admin", "admin", "committee"].includes(r.role));
    if (!isAllowed) return err(403, "Forbidden");

    const body = await req.json().catch(() => ({}));
    const mode = body?.mode === "detail" ? "detail" : "report";

    if (mode === "detail") {
      const referenceType = String(body?.reference_type ?? "");
      const referenceId = String(body?.reference_id ?? "");
      if (!referenceType || !referenceId) return err(400, "reference_type and reference_id required");
      const detail = await fetchDetail(referenceType, referenceId);
      return new Response(JSON.stringify({ ok: true, detail }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const year = Number(body?.year);
    const month = Number(body?.month);
    const officeId: string | null = body?.office_id || null;
    if (!Number.isInteger(year) || year < 2000 || year > 3000) return err(400, "Invalid year");
    if (!Number.isInteger(month) || month < 1 || month > 12) return err(400, "Invalid month");

    const { startStr, endStr } = monthBounds(year, month);

    const { data: accts } = await admin.from("accounts").select("id, code, name, name_bn, type").order("code");
    const accounts = (accts ?? []) as any[];

    async function aggregate(beforeOrEqual: string | null, fromInclusive: string | null) {
      let q = admin.from("ledger_entries").select("account_id, debit, credit").limit(50000);
      if (officeId) q = q.eq("office_id", officeId);
      if (beforeOrEqual) q = q.lt("entry_date", beforeOrEqual);
      if (fromInclusive) q = q.gte("entry_date", fromInclusive);
      const { data } = await q;
      const map = new Map<string, { d: number; c: number }>();
      for (const r of data ?? []) {
        const key = (r as any).account_id;
        const m = map.get(key) ?? { d: 0, c: 0 };
        m.d += Number((r as any).debit) || 0;
        m.c += Number((r as any).credit) || 0;
        map.set(key, m);
      }
      return map;
    }

    const opening = await aggregate(startStr, null);
    let periodQ = admin.from("ledger_entries")
      .select("account_id, debit, credit, reference_type, reference_id")
      .gte("entry_date", startStr).lt("entry_date", endStr).limit(50000);
    if (officeId) periodQ = periodQ.eq("office_id", officeId);
    const { data: periodRows } = await periodQ;

    const period = new Map<string, { d: number; c: number }>();
    const refSums = new Map<string, { d: number; c: number; type: string; id: string }>();
    let totalDebit = 0, totalCredit = 0;
    for (const r of periodRows ?? []) {
      const key = (r as any).account_id;
      const m = period.get(key) ?? { d: 0, c: 0 };
      const dd = Number((r as any).debit) || 0;
      const cc = Number((r as any).credit) || 0;
      m.d += dd; m.c += cc;
      period.set(key, m);
      totalDebit += dd; totalCredit += cc;
      const rt = (r as any).reference_type;
      const rid = (r as any).reference_id;
      if (rt && rid) {
        const k = `${rt}::${rid}`;
        const e = refSums.get(k) ?? { d: 0, c: 0, type: rt, id: rid };
        e.d += dd; e.c += cc;
        refSums.set(k, e);
      }
    }

    const accountsOut = accounts.map((a) => {
      const o = opening.get(a.id) ?? { d: 0, c: 0 };
      const p = period.get(a.id) ?? { d: 0, c: 0 };
      const sign = (a.type === "asset" || a.type === "expense") ? 1 : -1;
      const opening_balance = sign * (o.d - o.c);
      const closing_balance = sign * ((o.d + p.d) - (o.c + p.c));
      return {
        account_id: a.id, code: a.code, name: a.name, name_bn: a.name_bn, type: a.type,
        opening_balance, period_debit: p.d, period_credit: p.c, closing_balance,
      };
    });

    const mismatches: any[] = [];
    for (const [, v] of refSums) {
      const diff = Math.abs(v.d - v.c);
      if (diff > 0.01) {
        mismatches.push({ kind: "unbalanced_ref", reference_type: v.type, reference_id: v.id, debit: v.d, credit: v.c, diff });
      }
    }
    const { data: orphans } = await admin.rpc("ledger_orphan_refs");
    const monthRefKeys = new Set(Array.from(refSums.values()).map((v) => `${v.type}::${v.id}`));
    for (const o of (orphans ?? []) as any[]) {
      if (monthRefKeys.has(`${o.reference_type}::${o.reference_id}`)) {
        mismatches.push({ kind: "orphan_ref", reference_type: o.reference_type, reference_id: o.reference_id, entry_count: o.entry_count });
      }
    }

    const summary = {
      year, month, office_id: officeId,
      total_debit: totalDebit, total_credit: totalCredit,
      diff: Math.round((totalDebit - totalCredit) * 100) / 100,
      mismatch_count: mismatches.length,
      generated_at: new Date().toISOString(),
    };

    return new Response(JSON.stringify({ ok: true, summary, accounts: accountsOut, mismatches }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ledger-reconcile-monthly error", e);
    return err(500, "Server error");
  }
});
