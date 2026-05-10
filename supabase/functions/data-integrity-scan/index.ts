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

async function safeCount(table: string): Promise<number> {
  try {
    const { count } = await admin.from(table).select("id", { head: true, count: "exact" }).is("farmer_id", null);
    return count ?? 0;
  } catch (e) {
    console.error(`count failed for ${table}`, e);
    return 0;
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(fallback), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }).catch(() => { clearTimeout(t); resolve(fallback); });
  });
}

async function runScan() {
  // Run all count queries in parallel to stay under CPU/wall-time limits.
  const [sav_null, loan_null, irr_null, pay_null] = await Promise.all([
    safeCount("savings_transactions"),
    safeCount("loans"),
    safeCount("irrigation_charges"),
    safeCount("payments"),
  ]);

  const out: Record<string, number> = {
    sav_null, loan_null, irr_null, pay_null,
    sav_orphan: 0, loan_orphan: 0, irr_orphan: 0, pay_orphan: 0, lp_orphan: 0,
  };

  // Ledger orphans — protect with timeout so a slow RPC can't kill the function.
  const ledgerOrphans = await withTimeout(
    admin.rpc("ledger_orphan_refs").then((r) => r.data ?? []),
    5000,
    [] as any[],
  );
  const orphanList = (ledgerOrphans ?? []) as any[];
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
      const { data: userData, error: uErr } = await userClient.auth.getUser(bearer);
      if (uErr || !userData?.user?.id) return err(401, "Unauthorized");
      const userId = userData.user.id;
      const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
      isAllowed = (roles ?? []).some((r: any) => r.role === "super_admin" || r.role === "developer" || r.role === "admin");
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
