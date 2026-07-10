// Edge Function: scheduled-backup
// Invoked by pg_cron. Runs a full data-only SQL export (via db-export using the
// cron secret), uploads it to the private `db-backups` storage bucket, prunes
// backups beyond the configured retention, and records status on the schedule.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const CRON_SECRET = Deno.env.get("CRON_SECRET");

  // Inbound is unauthenticated (called by pg_cron with the anon key). This is
  // safe because the function only ever CREATES a retention-pruned backup, and
  // only when a schedule is enabled AND the configured interval has elapsed
  // (see the enabled + not_due gating below). The internal db-export call is
  // still authorized server-side via CRON_SECRET from this function's own env.
  if (!CRON_SECRET) {
    return new Response(JSON.stringify({ error: "CRON_SECRET not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  try {
    const { data: sched } = await admin.from("backup_schedules").select("*").limit(1).maybeSingle();
    if (!sched?.enabled) {
      return new Response(JSON.stringify({ skipped: true, reason: "disabled" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Frequency gating (cron fires daily; weekly/monthly skip until due).
    const intervalMs: Record<string, number> = { daily: 20, weekly: 6.5 * 24, monthly: 27 * 24 };
    const hoursNeeded = intervalMs[String(sched.frequency)] ?? 20;
    if (sched.last_run_at) {
      const sinceH = (Date.now() - new Date(sched.last_run_at).getTime()) / 36e5;
      if (sinceH < hoursNeeded) {
        return new Response(JSON.stringify({ skipped: true, reason: "not_due" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Generate the export using db-export with the cron secret.
    const expRes = await fetch(`${SUPABASE_URL}/functions/v1/db-export?mode=data`, {
      headers: { "x-cron-secret": CRON_SECRET },
    });
    if (!expRes.ok) {
      const body = await expRes.text();
      throw new Error(`export failed [${expRes.status}]: ${body.slice(0, 200)}`);
    }
    const sql = await expRes.text();

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const path = `auto/backup-${stamp}.sql`;
    const { error: upErr } = await admin.storage.from("db-backups").upload(path, new Blob([sql], { type: "application/sql" }), { upsert: false });
    if (upErr) throw upErr;

    // Prune to retention_count most recent auto backups.
    const retention = Math.max(1, Number(sched.retention_count) || 7);
    const { data: files } = await admin.storage.from("db-backups").list("auto", { limit: 1000, sortBy: { column: "name", order: "desc" } });
    const extra = (files ?? []).slice(retention);
    if (extra.length) {
      await admin.storage.from("db-backups").remove(extra.map((f: any) => `auto/${f.name}`));
    }

    await admin.from("backup_schedules").update({
      last_run_at: new Date().toISOString(),
      last_status: `ok (${(sql.length / 1024).toFixed(0)} KB)`,
    }).eq("id", sched.id);

    return new Response(JSON.stringify({ success: true, path, size_bytes: sql.length, pruned: extra.length }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    try {
      const { data: s } = await admin.from("backup_schedules").select("id").limit(1).maybeSingle();
      if (s?.id) await admin.from("backup_schedules").update({ last_run_at: new Date().toISOString(), last_status: `error: ${msg.slice(0, 200)}` }).eq("id", s.id);
    } catch { /* ignore */ }
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
