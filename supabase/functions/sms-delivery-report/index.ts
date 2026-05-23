// Delivery Report (DLR) ingestion endpoint.
// Providers callback with delivery status for previously-sent SMS.
// Accepts GET (query string) or POST (json or form-encoded).
// Recognized fields (case-insensitive): id|log_id|reference, status, mobile, provider, error
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function normalizeStatus(s: string | undefined | null): "delivered" | "undelivered" | "sent" | null {
  if (!s) return null;
  const v = s.toString().toLowerCase();
  if (/(deliver|success|dlvrd|ok\b)/.test(v)) return "delivered";
  if (/(fail|reject|undeliv|expir|invalid|error)/.test(v)) return "undelivered";
  if (/(sent|submit|accept)/.test(v)) return "sent";
  return null;
}

function pick(obj: Record<string, unknown>, ...keys: string[]) {
  for (const k of keys) {
    const lower = k.toLowerCase();
    for (const [key, val] of Object.entries(obj)) {
      if (key.toLowerCase() === lower && val != null && String(val).trim() !== "") {
        return String(val);
      }
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    let payload: Record<string, unknown> = {};
    const url = new URL(req.url);
    url.searchParams.forEach((v, k) => (payload[k] = v));

    if (req.method === "POST") {
      const ct = req.headers.get("content-type") ?? "";
      if (ct.includes("application/json")) {
        try { payload = { ...payload, ...(await req.json()) }; } catch { /* ignore */ }
      } else {
        try {
          const form = await req.formData();
          form.forEach((v, k) => (payload[k] = typeof v === "string" ? v : ""));
        } catch { /* ignore */ }
      }
    }

    const logId = pick(payload, "log_id", "id", "reference", "msg_id", "message_id");
    const mobile = pick(payload, "mobile", "to", "msisdn", "number");
    const rawStatus = pick(payload, "status", "dlr_status", "delivery_status", "state");
    const provider = pick(payload, "provider") ?? "greenweb";
    const status = normalizeStatus(rawStatus);

    if (!logId && !mobile) {
      return new Response(JSON.stringify({ ok: false, error: "missing log id or mobile" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the target log row (by id first, fall back to most recent matching mobile)
    let target: { id: string; status: string } | null = null;
    if (logId) {
      const { data } = await admin.from("sms_logs").select("id,status").eq("id", logId).maybeSingle();
      if (data) target = data as { id: string; status: string };
    }
    if (!target && mobile) {
      const { data } = await admin
        .from("sms_logs")
        .select("id,status")
        .eq("mobile", mobile)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) target = data as { id: string; status: string };
    }

    if (!target) {
      return new Response(JSON.stringify({ ok: false, error: "log not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const update: Record<string, unknown> = {
      dlr_payload: payload,
      provider_used: provider,
    };
    if (status === "delivered") {
      update.status = "delivered";
      update.delivered_at = new Date().toISOString();
    } else if (status === "undelivered") {
      update.status = "failed";
    } else if (status === "sent" && target.status === "queued") {
      update.status = "sent";
      update.sent_at = new Date().toISOString();
    }

    const { error: ue } = await admin.from("sms_logs").update(update).eq("id", target.id);
    if (ue) throw ue;

    return new Response(JSON.stringify({ ok: true, log_id: target.id, status: update.status ?? target.status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
