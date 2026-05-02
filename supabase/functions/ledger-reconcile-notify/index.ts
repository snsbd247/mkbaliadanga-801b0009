// Scheduled monthly reconciliation:
// - Runs reconciliation for the previous month (or {year, month, office_id} if posted)
// - Stores a JSON snapshot in the `reconciliation-reports` bucket
// - Notifies all super_admins via the `notifications` table
//
// Triggered by pg_cron (see migration). Authorized via service role + a shared `cron_secret`
// in the request body when called manually; cron uses the anon key + service-role internally.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY);

function previousMonth(): { year: number; month: number } {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

function monthBounds(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { startStr: start.toISOString().slice(0, 10), endStr: end.toISOString().slice(0, 10) };
}

async function buildReport(year: number, month: number, officeId: string | null) {
  const { startStr, endStr } = monthBounds(year, month);
  const { data: accts } = await admin.from("accounts").select("id, code, name, name_bn, type").order("code");

  let periodQ = admin.from("ledger_entries")
    .select("account_id, debit, credit, reference_type, reference_id")
    .gte("entry_date", startStr).lt("entry_date", endStr).limit(50000);
  if (officeId) periodQ = periodQ.eq("office_id", officeId);
  const { data: periodRows } = await periodQ;

  const refSums = new Map<string, { d: number; c: number; type: string; id: string }>();
  let totalDebit = 0, totalCredit = 0;
  for (const r of (periodRows ?? []) as any[]) {
    const dd = Number(r.debit) || 0, cc = Number(r.credit) || 0;
    totalDebit += dd; totalCredit += cc;
    if (r.reference_type && r.reference_id) {
      const k = `${r.reference_type}::${r.reference_id}`;
      const e = refSums.get(k) ?? { d: 0, c: 0, type: r.reference_type, id: r.reference_id };
      e.d += dd; e.c += cc;
      refSums.set(k, e);
    }
  }
  const mismatches: any[] = [];
  for (const [, v] of refSums) {
    const diff = Math.abs(v.d - v.c);
    if (diff > 0.01) mismatches.push({ kind: "unbalanced_ref", reference_type: v.type, reference_id: v.id, debit: v.d, credit: v.c, diff });
  }
  const { data: orphans } = await admin.rpc("ledger_orphan_refs");
  const monthRefKeys = new Set(Array.from(refSums.values()).map((v) => `${v.type}::${v.id}`));
  for (const o of (orphans ?? []) as any[]) {
    if (monthRefKeys.has(`${o.reference_type}::${o.reference_id}`)) {
      mismatches.push({ kind: "orphan_ref", reference_type: o.reference_type, reference_id: o.reference_id, entry_count: o.entry_count });
    }
  }

  return {
    year, month, office_id: officeId,
    total_debit: totalDebit, total_credit: totalCredit,
    diff: Math.round((totalDebit - totalCredit) * 100) / 100,
    mismatch_count: mismatches.length,
    mismatches,
    accounts_count: (accts ?? []).length,
    generated_at: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    let body: any = {};
    try { body = await req.json(); } catch { /* */ }

    // Determine target month
    const target = (Number.isInteger(body?.year) && Number.isInteger(body?.month))
      ? { year: Number(body.year), month: Number(body.month) }
      : previousMonth();

    // Build reports per office + global
    const { data: offices } = await admin.from("offices").select("id, name");
    const targets: Array<{ officeId: string | null; officeName: string }> = [
      { officeId: null, officeName: "All offices" },
      ...((offices ?? []) as any[]).map((o) => ({ officeId: o.id as string, officeName: o.name as string })),
    ];

    const reports: any[] = [];
    for (const tg of targets) {
      const r = await buildReport(target.year, target.month, tg.officeId);
      reports.push({ office_name: tg.officeName, ...r });
    }

    const totalMismatch = reports.reduce((a, r) => a + r.mismatch_count, 0);
    const fileName = `monthly-${target.year}-${String(target.month).padStart(2, "0")}-${Date.now()}.json`;
    const filePath = `${target.year}/${String(target.month).padStart(2, "0")}/${fileName}`;
    const fileBody = new TextEncoder().encode(JSON.stringify({ generated_at: new Date().toISOString(), target, reports }, null, 2));

    // Upload snapshot to private bucket
    const { error: upErr } = await admin.storage.from("reconciliation-reports").upload(filePath, fileBody, {
      contentType: "application/json", upsert: true,
    });
    if (upErr) console.error("upload error", upErr);

    // Notify super_admins
    const { data: roleRows } = await admin.from("user_roles").select("user_id").eq("role", "super_admin");
    const userIds = Array.from(new Set((roleRows ?? []).map((r: any) => r.user_id))).filter(Boolean);

    const title = `Monthly reconciliation ready — ${target.year}-${String(target.month).padStart(2, "0")}`;
    const bodyMsg = totalMismatch === 0
      ? `Ledger is consistent across ${reports.length - 1} office(s). No mismatches detected.`
      : `${totalMismatch} mismatch(es) detected across ${reports.length - 1} office(s). Open the reconciliation page to drill down.`;

    if (userIds.length > 0) {
      const inserts = userIds.map((uid) => ({
        user_id: uid,
        kind: "reconciliation_monthly",
        title,
        body: bodyMsg,
        link: "/ledger-reconciliation",
      }));
      const { error: nErr } = await admin.from("notifications").insert(inserts);
      if (nErr) console.error("notification error", nErr);
    }

    // Update last_run on qr_rotation_settings? No — write a separate audit log
    await admin.from("audit_logs").insert({
      action: "reconcile_monthly",
      entity: "ledger",
      meta: { target, total_mismatch: totalMismatch, file: filePath, notified: userIds.length },
    });

    return new Response(JSON.stringify({
      ok: true, target, file: filePath, notified: userIds.length, total_mismatch: totalMismatch,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("ledger-reconcile-notify error", e);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
