// GreenWeb Bulk SMS sender. Accepts:
//   { log_id: uuid }                              -> send queued log entry
//   { mobile, message, event_type?, farmer_id? } -> ad-hoc single send
//   { mobiles: string[], message }               -> bulk send (announcement)
//   { retry: true, ids?: uuid[] }                -> retry failed/queued
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GW_TOKEN_ENV = Deno.env.get("GREENWEB_SMS_TOKEN") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

type ProviderRow = { provider: string; api_token: string; priority: number; status: string; expires_at: string | null };

async function getProvidersInOrder(): Promise<ProviderRow[]> {
  const nowIso = new Date().toISOString();
  const { data } = await admin
    .from("sms_provider_secrets")
    .select("provider,api_token,priority,status,expires_at")
    .eq("status", "active")
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order("priority", { ascending: true });
  const rows = ((data as ProviderRow[]) ?? []).filter((r) => (r.api_token ?? "").toString().trim().length > 0);
  // Always include env token as last-resort greenweb fallback
  if (GW_TOKEN_ENV && !rows.some((r) => r.provider === "greenweb")) {
    rows.push({ provider: "greenweb", api_token: GW_TOKEN_ENV, priority: 999, status: "active", expires_at: null });
  }
  return rows;
}

async function getProviderToken(provider: string): Promise<string> {
  const all = await getProvidersInOrder();
  return all.find((p) => p.provider === provider)?.api_token ?? (provider === "greenweb" ? GW_TOKEN_ENV : "");
}

function normalizeBdMobile(m: string): string {
  let n = (m || "").replace(/\D/g, "");
  if (n.startsWith("880")) return n;
  if (n.startsWith("0")) return "88" + n;
  if (n.length === 10 && n.startsWith("1")) return "880" + n;
  return n;
}

async function sendViaGreenWeb(token: string, mobile: string, message: string, senderId?: string | null): Promise<{ ok: boolean; resp: string }> {
  if (!token) return { ok: false, resp: "Missing GreenWeb API token." };
  const params = new URLSearchParams({ token, to: normalizeBdMobile(mobile), message });
  if (senderId && senderId.trim()) params.set("sender", senderId.trim());
  try {
    const res = await fetch("https://api.greenweb.com.bd/api.php?" + params.toString());
    const text = await res.text();
    const ok = res.ok && /ok/i.test(text) && !/err|invalid|fail/i.test(text);
    return { ok, resp: text.slice(0, 500) };
  } catch (e) {
    return { ok: false, resp: String(e).slice(0, 500) };
  }
}

async function sendViaProvider(provider: string, token: string, mobile: string, message: string, senderId?: string | null) {
  // Currently only greenweb is fully wired. Other providers fall back to greenweb HTTP if token alone is supplied.
  if (provider === "greenweb") return sendViaGreenWeb(token, mobile, message, senderId);
  // Generic stub: treat as greenweb-compatible HTTP API
  return sendViaGreenWeb(token, mobile, message, senderId);
}

async function resolveSenderId(officeId: string | null): Promise<string | null> {
  if (officeId) {
    const { data: o } = await admin.from("sms_office_settings").select("enabled,sender_id").eq("office_id", officeId).maybeSingle();
    if (o && o.enabled === false) return "__DISABLED__";
    if (o?.sender_id && o.sender_id.trim()) return o.sender_id;
  }
  const { data: g } = await admin.from("sms_settings").select("sender_id").eq("id", 1).maybeSingle();
  return g?.sender_id ?? null;
}

async function resolveTemplatePreferredProvider(templateKey: string | null): Promise<string | null> {
  if (!templateKey) return null;
  const { data } = await admin.from("sms_templates").select("preferred_provider").eq("key", templateKey).maybeSingle();
  const p = (data as { preferred_provider?: string | null } | null)?.preferred_provider;
  return p && p.trim() ? p.trim() : null;
}

// Back-compat shim used by test_connection block
async function getGreenWebToken(): Promise<string> {
  return (await getProviderToken("greenweb")) || GW_TOKEN_ENV;
}

async function processLog(id: string) {
  const { data: log, error } = await admin.from("sms_logs").select("*").eq("id", id).maybeSingle();
  if (error || !log) return { ok: false, error: error?.message ?? "log not found" };
  if (log.status === "sent" || log.status === "delivered") return { ok: true, skipped: true };

  const sender = await resolveSenderId(log.office_id ?? null);
  if (sender === "__DISABLED__") {
    await admin.from("sms_logs").update({ status: "failed", provider_response: "Office SMS disabled" }).eq("id", id);
    return { ok: false, response: "Office SMS disabled" };
  }

  // Build provider try order: template override first, then priority list
  const providers = await getProvidersInOrder();
  const override = await resolveTemplatePreferredProvider(log.template_key ?? null);
  const ordered = override
    ? [...providers.filter((p) => p.provider === override), ...providers.filter((p) => p.provider !== override)]
    : providers;

  if (!ordered.length) {
    await admin.from("sms_logs").update({ status: "failed", provider_response: "No SMS provider configured" }).eq("id", id);
    return { ok: false, response: "No SMS provider configured" };
  }

  let last: { provider: string; ok: boolean; resp: string } | null = null;
  for (const p of ordered) {
    const r = await sendViaProvider(p.provider, p.api_token, log.mobile, log.message, sender);
    last = { provider: p.provider, ...r };
    if (r.ok) break;
  }

  await admin.from("sms_logs").update({
    status: last?.ok ? "sent" : "failed",
    provider_response: last?.resp ?? "",
    provider_used: last?.provider ?? null,
    sent_at: last?.ok ? new Date().toISOString() : null,
    retry_count: (log.retry_count ?? 0) + (log.status === "queued" ? 0 : 1),
  }).eq("id", id);
  return { ok: !!last?.ok, response: last?.resp ?? "", provider: last?.provider };
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));

    // Test connection mode — sends a one-off SMS without persisting a log entry.
    // Requires authenticated super-admin. Returns request/response details for diagnostics.
    if (body.test_connection === true) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: userData } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
      const uid = userData.user?.id;
      if (!uid) {
        return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", uid).eq("role", "super_admin").maybeSingle();
      if (!roleRow) {
        return new Response(JSON.stringify({ ok: false, error: "Forbidden — super admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const mobile = String(body.mobile ?? "").trim();
      const message = String(body.message ?? "Test SMS from Smart Irrigation — connection OK.").slice(0, 300);
      if (!mobile || mobile.replace(/\D/g, "").length < 10) {
        return new Response(JSON.stringify({ ok: false, error: "Provide a valid mobile number" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const token = await getGreenWebToken();
      if (!token) {
        return new Response(JSON.stringify({ ok: false, error: "GreenWeb API token is not configured." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const sender = await resolveSenderId(body.office_id ?? null);
      if (sender === "__DISABLED__") {
        return new Response(JSON.stringify({ ok: false, error: "SMS disabled for this office" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const normalized = normalizeBdMobile(mobile);
      const params = new URLSearchParams({ token: "***", to: normalized, message });
      if (sender && sender.trim()) params.set("sender", sender.trim());
      const safeRequestUrl = "https://api.greenweb.com.bd/api.php?" + params.toString();

      const r = await sendViaGreenWeb(mobile, message, sender);
      const tested_at = new Date().toISOString();

      // Persist last test result to sms_settings.config.last_test (no token bytes)
      try {
        const { data: cur } = await admin.from("sms_settings").select("config").eq("id", 1).maybeSingle();
        const cfg = (cur?.config ?? {}) as Record<string, unknown>;
        cfg["last_test"] = {
          ok: r.ok,
          tested_at,
          mobile: normalized,
          sender: sender ?? null,
          response: r.resp.slice(0, 200),
          tested_by: uid,
        };
        await admin.from("sms_settings").update({ config: cfg }).eq("id", 1);
      } catch (_) { /* non-fatal */ }

      return new Response(JSON.stringify({
        ok: r.ok,
        request: { url: safeRequestUrl, to: normalized, sender: sender ?? null, message_length: message.length },
        response: r.resp,
        provider: "greenweb",
        tested_at,
      }), { status: r.ok ? 200 : 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Retry mode (manual)
    if (body.retry === true) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claims } = await userClient.auth.getUser();
      if (!claims?.user?.id) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const ids: string[] = Array.isArray(body.ids) && body.ids.length
        ? body.ids
        : (await admin.from("sms_logs").select("id").in("status", ["failed", "queued"]).order("created_at", { ascending: true }).limit(50)).data?.map((r: any) => r.id) ?? [];
      const results = [];
      for (const id of ids) results.push({ id, ...(await processLog(id)) });
      return new Response(JSON.stringify({ processed: results.length, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Bulk send (announcement)
    if (Array.isArray(body.mobiles) && body.mobiles.length > 0 && typeof body.message === "string") {
      const authHeader = req.headers.get("Authorization");
      let createdBy: string | null = null;
      if (authHeader) {
        const { data } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
        createdBy = data.user?.id ?? null;
      }
      const inserts = body.mobiles
        .filter((m: string) => m && m.trim().length >= 6)
        .map((m: string) => ({ mobile: m.trim(), message: body.message, status: "queued", event_type: "bulk", created_by: createdBy }));
      if (!inserts.length) return new Response(JSON.stringify({ error: "no valid mobiles" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: logs, error: ie } = await admin.from("sms_logs").insert(inserts).select("id");
      if (ie) return new Response(JSON.stringify({ error: ie.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const results = [];
      for (const l of logs ?? []) results.push({ id: l.id, ...(await processLog(l.id)) });
      return new Response(JSON.stringify({ queued: inserts.length, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Trigger-fired (log_id) or ad-hoc (mobile+message)
    let logId: string | null = body.log_id ?? null;
    if (!logId && body.mobile && body.message) {
      const { data, error: ie } = await admin.from("sms_logs").insert({
        mobile: String(body.mobile).trim(),
        message: String(body.message),
        status: "queued",
        event_type: body.event_type ?? "manual",
        farmer_id: body.farmer_id ?? null,
      }).select("id").single();
      if (ie) return new Response(JSON.stringify({ error: ie.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      logId = data.id;
    }
    if (!logId) {
      return new Response(JSON.stringify({ error: "log_id or mobile+message required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const result = await processLog(logId);
    return new Response(JSON.stringify({ id: logId, ...result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
