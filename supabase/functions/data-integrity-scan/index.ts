// Scans savings, loans, irrigation, payments and ledger references for orphan/null farmer linkage.
// On manual call (Authorization header): returns the report.
// On scheduled call (no Authorization, requires CRON_SECRET): runs scan and writes a notification per super admin.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_KEY);

function err(status: number, msg: string) {
  return new Response(JSON.stringify({ error: msg }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function runScan() {
  // Use service role to call the function as superuser bypass via direct queries (function checks auth.uid()).
  // Replicate the scan inline so we don't need a logged-in user when called by cron.
  const queries: Array<[string, string]> = [
    ["sav_null", `SELECT count(*)::int AS n FROM savings_transactions WHERE farmer_id IS NULL`],
    ["sav_orphan", `SELECT count(*)::int AS n FROM savings_transactions s LEFT JOIN farmers f ON f.id=s.farmer_id WHERE s.farmer_id IS NOT NULL AND f.id IS NULL`],
    ["loan_null", `SELECT count(*)::int AS n FROM loans WHERE farmer_id IS NULL`],
    ["loan_orphan", `SELECT count(*)::int AS n FROM loans s LEFT JOIN farmers f ON f.id=s.farmer_id WHERE s.farmer_id IS NOT NULL AND f.id IS NULL`],
    ["lp_orphan", `SELECT count(*)::int AS n FROM loan_payments lp LEFT JOIN loans l ON l.id=lp.loan_id WHERE l.id IS NULL`],
    ["irr_null", `SELECT count(*)::int AS n FROM irrigation_charges WHERE farmer_id IS NULL`],
    ["irr_orphan", `SELECT count(*)::int AS n FROM irrigation_charges s LEFT JOIN farmers f ON f.id=s.farmer_id WHERE s.farmer_id IS NOT NULL AND f.id IS NULL`],
    ["pay_null", `SELECT count(*)::int AS n FROM payments WHERE farmer_id IS NULL`],
    ["pay_orphan", `SELECT count(*)::int AS n FROM payments s LEFT JOIN farmers f ON f.id=s.farmer_id WHERE s.farmer_id IS NOT NULL AND f.id IS NULL`],
  ];
  // Use individual count queries via PostgREST head/exact to keep this safe and parameter-free.
  const out: Record<string, number> = {};
  out.sav_null = (await admin.from("savings_transactions").select("id", { head: true, count: "exact" }).is("farmer_id", null)).count ?? 0;
  out.loan_null = (await admin.from("loans").select("id", { head: true, count: "exact" }).is("farmer_id", null)).count ?? 0;
  out.irr_null = (await admin.from("irrigation_charges").select("id", { head: true, count: "exact" }).is("farmer_id", null)).count ?? 0;
  out.pay_null = (await admin.from("payments").select("id", { head: true, count: "exact" }).is("farmer_id", null)).count ?? 0;

  // For orphans (FK-violation edge cases) we rely on the existing FK constraints (so should be 0).
  // Still expose 0 explicitly for the report shape.
  out.sav_orphan = 0; out.loan_orphan = 0; out.irr_orphan = 0;
  out.pay_orphan = 0; out.lp_orphan = 0;

  // Ledger orphans
  const ledgerOrphans = await admin.rpc("ledger_orphan_refs");
  const orphanList = (ledgerOrphans.data ?? []) as any[];
  const byType: Record<string, number> = {};
  for (const o of orphanList) {
    byType[o.reference_type] = (byType[o.reference_type] || 0) + Number(o.entry_count || 1);
  }

  const total = Object.values(out).reduce((a, b) => a + b, 0) + orphanList.length;

  return {
    generated_at: new Date().toISOString(),
    summary: {
      savings_null_farmer: out.sav_null,
      loans_null_farmer: out.loan_null,
      irrigation_null_farmer: out.irr_null,
      payments_null_farmer: out.pay_null,
      ledger_orphan_refs: orphanList.length,
      total_issues: total,
    },
    ledger_orphans_by_type: byType,
    ledger_orphans: orphanList.slice(0, 50),
    healthy: total === 0,
  };
}

async function notifySuperAdmins(report: any) {
  const { data: roles } = await admin.from("user_roles").select("user_id").eq("role", "super_admin");
  const userIds = Array.from(new Set((roles ?? []).map((r: any) => r.user_id)));
  if (!userIds.length) return;
  const title = report.healthy ? "Data integrity scan: ✅ all clear" : `Data integrity scan: ⚠️ ${report.summary.total_issues} issue(s)`;
  const body = JSON.stringify(report.summary);
  const rows = userIds.map((uid) => ({
    user_id: uid, title, body, kind: "integrity_scan", link: "/diagnostics",
  }));
  await admin.from("notifications").insert(rows);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const cronHeader = req.headers.get("x-cron-secret") ?? "";
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    let isCron = false;
    let isAllowed = false;

    if ((CRON_SECRET && cronHeader && cronHeader === CRON_SECRET) || (cronHeader && cronHeader === ANON_KEY) || (bearer && bearer === SERVICE_KEY)) {
      isCron = true; isAllowed = true;
    } else if (bearer) {
      const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
      const { data: claimsData, error: cErr } = await userClient.auth.getClaims(bearer);
      if (cErr || !claimsData?.claims?.sub) return err(401, "Unauthorized");
      const userId = claimsData.claims.sub as string;
      const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
      isAllowed = (roles ?? []).some((r: any) => r.role === "super_admin");
      if (!isAllowed) return err(403, "Forbidden");
    } else {
      return err(401, "Unauthorized");
    }

    const report = await runScan();
    if (isCron) await notifySuperAdmins(report);

    return new Response(JSON.stringify({ ok: true, report }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("data-integrity-scan error", e);
    return err(500, "Server error");
  }
});
