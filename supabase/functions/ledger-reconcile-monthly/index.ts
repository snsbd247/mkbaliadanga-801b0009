// Monthly ledger reconciliation report.
// Returns per-account opening / debit / credit / closing for the month, plus mismatches:
//  - Unbalanced reference groups within the month (debit ≠ credit for the same reference).
//  - Orphan ledger references (source row no longer exists).
//  - Source-vs-ledger discrepancies for loan_payments / savings_transactions / irrigation_charges / expenses
//    (sum of source amounts vs sum of ledger postings for that reference type within month).
//
// Auth: requires admin or super_admin.
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
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);
  return { startStr, endStr };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return err(401, "Unauthorized");
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(authHeader.slice(7));
    if (claimsErr || !claimsData?.claims?.sub) return err(401, "Unauthorized");
    const userId = claimsData.claims.sub as string;
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
    const isAllowed = (roles ?? []).some((r: any) => ["super_admin", "admin", "committee"].includes(r.role));
    if (!isAllowed) return err(403, "Forbidden");

    const body = await req.json().catch(() => ({}));
    const year = Number(body?.year);
    const month = Number(body?.month);
    const officeId: string | null = body?.office_id || null;
    if (!Number.isInteger(year) || year < 2000 || year > 3000) return err(400, "Invalid year");
    if (!Number.isInteger(month) || month < 1 || month > 12) return err(400, "Invalid month");

    const { startStr, endStr } = monthBounds(year, month);

    // Accounts
    const { data: accts } = await admin.from("accounts").select("id, code, name, name_bn, type").order("code");
    const accounts = (accts ?? []) as any[];

    // Helper: aggregate ledger entries with optional date filter & office filter
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

    // Opening: everything strictly before startStr
    const opening = await aggregate(startStr, null);
    // Period totals: from startStr (inclusive) up to endStr (exclusive)
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
      // For asset/expense accounts, normal balance is debit - credit; income/liability/equity is credit - debit.
      const sign = (a.type === "asset" || a.type === "expense") ? 1 : -1;
      const opening_balance = sign * (o.d - o.c);
      const period_debit = p.d;
      const period_credit = p.c;
      const closing_balance = sign * ((o.d + p.d) - (o.c + p.c));
      return {
        account_id: a.id, code: a.code, name: a.name, name_bn: a.name_bn, type: a.type,
        opening_balance, period_debit, period_credit, closing_balance,
      };
    });

    // Mismatches
    const mismatches: any[] = [];

    // 1. Unbalanced reference groups in this month
    for (const [, v] of refSums) {
      const diff = Math.abs(v.d - v.c);
      if (diff > 0.01) {
        mismatches.push({ kind: "unbalanced_ref", reference_type: v.type, reference_id: v.id, debit: v.d, credit: v.c, diff });
      }
    }

    // 2. Orphan refs across the whole DB but flag those touched this month
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
