// Scheduled (or admin-triggered) rotation of QR membership tokens.
// - Issues a new token for any farmer whose active token is older than `interval_days`.
// - Marks the old token to expire after `grace_hours` (allows in-flight cards to keep working briefly).
// - Sweeps already-expired tokens to `revoked = true`.
// - Logs every action in audit_logs.
//
// Auth modes:
//   1. Cron / service-to-service: header `x-cron-secret` matching SUPABASE_ANON_KEY (set by pg_net call).
//   2. Admin manual run: Bearer JWT belonging to a super_admin or admin role.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY);

function genToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return "mkc_" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function err(status: number, msg: string) {
  return new Response(JSON.stringify({ error: msg }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    let actorId: string | null = null;
    const cronSecret = req.headers.get("x-cron-secret");
    if (cronSecret && cronSecret === ANON_KEY) {
      // service-to-service via pg_net
    } else {
      const authHeader = req.headers.get("Authorization") ?? "";
      if (!authHeader.startsWith("Bearer ")) return err(401, "Unauthorized");
      const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
      const { data: claimsData, error: claimsErr } = await userClient.auth.getUser());
      if (claimsErr || !claimsData?.user?.id) return err(401, "Unauthorized");
      actorId = claimsData.user.id as string;
      const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", actorId);
      const allowed = (roles ?? []).some((r: any) => ["super_admin", "admin"].includes(r.role));
      if (!allowed) return err(403, "Forbidden");
    }

    // Load settings
    const { data: settings } = await admin
      .from("qr_rotation_settings").select("*").eq("id", 1).maybeSingle();
    const intervalDays = Number(settings?.interval_days ?? 90);
    const graceHours = Number(settings?.grace_hours ?? 24);
    const enabled = !!settings?.enabled;
    const force = !!(await req.json().catch(() => ({})))?.force; // admin "Run now" can force even when disabled

    if (!enabled && !force && cronSecret) {
      // Cron call but rotation is disabled — silently skip.
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "rotation disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const cutoff = new Date(now.getTime() - intervalDays * 86400_000).toISOString();

    // 1. Pick farmers whose newest active token is older than cutoff and has no expires_at yet.
    const { data: stale } = await admin
      .from("qr_tokens")
      .select("id, farmer_id, created_at")
      .eq("revoked", false)
      .is("expires_at", null)
      .lt("created_at", cutoff)
      .limit(500);

    const rotated: { farmer_id: string; old: string; new: string }[] = [];
    const expiresAt = new Date(now.getTime() + graceHours * 3600_000).toISOString();

    // Load SMS settings once for rotate/revoke notifications
    const { data: smsSet } = await admin
      .from("sms_settings").select("enabled, language, send_on_qr_rotate, send_on_qr_revoke, tpl_qr_rotate, tpl_qr_rotate_en, tpl_qr_revoke, tpl_qr_revoke_en")
      .eq("id", 1).maybeSingle();
    const smsEnabled = !!smsSet?.enabled;
    const lang = (smsSet?.language ?? "bn") as string;
    function tpl(en: string | null | undefined, bn: string | null | undefined) {
      const t = (lang === "en" ? en : bn) ?? bn ?? en ?? "";
      return t.replace("{grace}", String(graceHours));
    }

    async function notify(farmerId: string, type: "rotate" | "revoke") {
      if (!smsEnabled) return;
      if (type === "rotate" && !smsSet?.send_on_qr_rotate) return;
      if (type === "revoke" && !smsSet?.send_on_qr_revoke) return;
      const { data: f } = await admin
        .from("farmers").select("mobile, office_id").eq("id", farmerId).maybeSingle();
      if (!f?.mobile) return;
      const message = type === "rotate"
        ? tpl(smsSet?.tpl_qr_rotate_en, smsSet?.tpl_qr_rotate)
        : tpl(smsSet?.tpl_qr_revoke_en, smsSet?.tpl_qr_revoke);
      const { data: log } = await admin.from("sms_logs").insert({
        mobile: f.mobile, message, status: "queued",
        event_type: type === "rotate" ? "qr_rotate" : "qr_revoke",
        farmer_id: farmerId, reference_type: "qr_tokens", reference_id: farmerId,
        office_id: f.office_id, created_by: actorId,
      }).select("id").single();
      if (log?.id) {
        try {
          await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
            body: JSON.stringify({ log_id: log.id }),
          });
        } catch { /* best-effort */ }
      }
    }

    // Dedupe by farmer (newest active row per farmer)
    const seen = new Set<string>();
    for (const row of stale ?? []) {
      if (seen.has(row.farmer_id)) continue;
      seen.add(row.farmer_id);

      // Issue new
      const newToken = genToken();
      const { data: ins, error: insErr } = await admin
        .from("qr_tokens")
        .insert({ farmer_id: row.farmer_id, token: newToken, created_by: actorId, rotated_from: row.id })
        .select("id, token").single();
      if (insErr || !ins) continue;

      // Schedule old to expire after grace window
      await admin.from("qr_tokens").update({ expires_at: expiresAt }).eq("id", row.id);

      await admin.from("audit_logs").insert({
        user_id: actorId, action: "rotate", entity: "qr_tokens",
        entity_id: row.farmer_id,
        new_values: { old_token_id: row.id, new_token_id: ins.id, expires_at: expiresAt, source: cronSecret ? "cron" : "admin" },
      });

      rotated.push({ farmer_id: row.farmer_id, old: row.id, new: ins.id });
      await notify(row.farmer_id, "rotate");
    }

    // 2. Sweep tokens whose expires_at has passed → mark revoked.
    const { data: expired } = await admin
      .from("qr_tokens")
      .select("id, farmer_id")
      .eq("revoked", false)
      .lt("expires_at", now.toISOString())
      .limit(1000);
    let revokedCount = 0;
    for (const row of expired ?? []) {
      const { error: updErr } = await admin
        .from("qr_tokens").update({ revoked: true }).eq("id", row.id);
      if (updErr) continue;
      revokedCount++;
      await admin.from("audit_logs").insert({
        user_id: actorId, action: "revoke", entity: "qr_tokens",
        entity_id: row.farmer_id,
        new_values: { token_id: row.id, reason: "grace_window_expired" },
      });
      await notify(row.farmer_id, "revoke");
    }

    const summary = { rotated: rotated.length, revoked: revokedCount, ran_at: now.toISOString() };

    await admin.from("qr_rotation_settings").update({
      last_run_at: now.toISOString(),
      last_run_summary: summary,
    }).eq("id", 1);

    return new Response(JSON.stringify({ ok: true, ...summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("qr-rotate-scheduled error", e);
    return err(500, "Server error");
  }
});
