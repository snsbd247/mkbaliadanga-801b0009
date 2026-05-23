// Scans assets for low-stock + warranty-expiring conditions and creates
// open rows in `asset_alerts` (deduped by unique partial index on open status).
// Optionally enqueues an SMS to recipients configured in
// sms_settings.config.asset_alert_recipients (array of mobile numbers).
//
// Trigger: cron (daily) or manual POST {office_id?: string}.
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

async function fireSend(logId: string) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
      body: JSON.stringify({ log_id: logId }),
    });
  } catch (_) { /* retry queue picks it up */ }
}

async function enqueueSms(opts: {
  mobiles: string[]; message: string; office_id: string | null;
  alert_id: string; event_type: string;
}) {
  const sent: string[] = [];
  for (const mobile of opts.mobiles) {
    const m = (mobile || "").trim();
    if (!m) continue;
    const { data, error } = await admin.from("sms_logs").insert({
      mobile: m, message: opts.message, status: "queued",
      event_type: opts.event_type, reference_type: "asset_alert",
      reference_id: opts.alert_id, office_id: opts.office_id,
    }).select("id").maybeSingle();
    if (!error && data?.id) { sent.push(data.id); await fireSend(data.id); }
  }
  return sent.length;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let body: any = {};
  if (req.method === "POST") { try { body = await req.json(); } catch { body = {}; } }
  const officeFilter: string | null = body.office_id ?? null;

  const { data: settings } = await admin.from("sms_settings").select("*").eq("id", 1).maybeSingle();
  const smsEnabled = !!settings?.enabled;
  const recipients: string[] = Array.isArray((settings?.config as any)?.asset_alert_recipients)
    ? (settings!.config as any).asset_alert_recipients : [];

  const today = new Date().toISOString().slice(0, 10);
  let created = 0; let smsSent = 0;

  // -------- 1) Low-stock scan --------
  let stocksQ = admin.from("asset_stocks").select(
    "id,office_id,asset_id,location_id,quantity,assets!inner(asset_code,name_en,name_bn,unit,min_stock_level,tracking_mode,deleted_at)"
  );
  if (officeFilter) stocksQ = stocksQ.eq("office_id", officeFilter);
  const { data: stocks, error: stocksErr } = await stocksQ;
  if (stocksErr) {
    return new Response(JSON.stringify({ error: stocksErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  for (const s of (stocks ?? []) as any[]) {
    const a = s.assets; if (!a || a.deleted_at) continue;
    const threshold = Number(a.min_stock_level || 0);
    if (threshold <= 0) continue;
    if (Number(s.quantity) > threshold) continue;

    const msg_en = `Low stock: ${a.asset_code} (${a.name_en}) at ${Number(s.quantity)} ${a.unit || ""} (threshold ${threshold}).`;
    const msg_bn = `স্টক কম: ${a.asset_code} (${a.name_bn || a.name_en}) — বর্তমান ${Number(s.quantity)} ${a.unit || ""} (সীমা ${threshold})।`;

    const { data: ins } = await admin.from("asset_alerts").insert({
      office_id: s.office_id, asset_id: s.asset_id, location_id: s.location_id,
      alert_type: "low_stock",
      severity: Number(s.quantity) <= 0 ? "critical" : "warning",
      message_en: msg_en, message_bn: msg_bn,
      details: { quantity: Number(s.quantity), threshold, unit: a.unit },
    }).select("id").maybeSingle();
    // unique index swallows duplicates → ins will be null on conflict
    if (ins?.id) {
      created++;
      if (smsEnabled && recipients.length) {
        const n = await enqueueSms({
          mobiles: recipients, message: msg_bn, office_id: s.office_id,
          alert_id: ins.id, event_type: "asset_low_stock",
        });
        smsSent += n;
        if (n > 0) await admin.from("asset_alerts").update({ sms_sent_count: n, last_sms_at: new Date().toISOString() }).eq("id", ins.id);
      }
    }
  }

  // -------- 2) Warranty expiring / expired --------
  let assetsQ = admin.from("assets").select(
    "id,office_id,asset_code,name_en,name_bn,warranty_until,warranty_alert_days"
  ).is("deleted_at", null).not("warranty_until", "is", null);
  if (officeFilter) assetsQ = assetsQ.eq("office_id", officeFilter);
  const { data: assets } = await assetsQ;

  for (const a of (assets ?? []) as any[]) {
    if (!a.warranty_until) continue;
    const days = Number(a.warranty_alert_days || 0);
    const exp = new Date(a.warranty_until + "T00:00:00Z");
    const todayD = new Date(today + "T00:00:00Z");
    const diffDays = Math.round((exp.getTime() - todayD.getTime()) / 86400000);

    let alert_type: "warranty_expiring" | "warranty_expired" | null = null;
    let severity: "info" | "warning" | "critical" = "info";
    if (diffDays < 0) { alert_type = "warranty_expired"; severity = "critical"; }
    else if (days > 0 && diffDays <= days) { alert_type = "warranty_expiring"; severity = "warning"; }
    if (!alert_type) continue;

    const msg_en = alert_type === "warranty_expired"
      ? `Warranty expired: ${a.asset_code} (${a.name_en}) on ${a.warranty_until}.`
      : `Warranty expiring in ${diffDays} day(s): ${a.asset_code} (${a.name_en}) on ${a.warranty_until}.`;
    const msg_bn = alert_type === "warranty_expired"
      ? `ওয়ারেন্টি শেষ: ${a.asset_code} (${a.name_bn || a.name_en}) — ${a.warranty_until}।`
      : `${diffDays} দিনে ওয়ারেন্টি শেষ হচ্ছে: ${a.asset_code} (${a.name_bn || a.name_en}) — ${a.warranty_until}।`;

    const { data: ins } = await admin.from("asset_alerts").insert({
      office_id: a.office_id, asset_id: a.id, location_id: null,
      alert_type, severity, message_en: msg_en, message_bn: msg_bn,
      details: { warranty_until: a.warranty_until, days_remaining: diffDays },
    }).select("id").maybeSingle();
    if (ins?.id) {
      created++;
      if (smsEnabled && recipients.length) {
        const n = await enqueueSms({
          mobiles: recipients, message: msg_bn, office_id: a.office_id,
          alert_id: ins.id, event_type: `asset_${alert_type}`,
        });
        smsSent += n;
        if (n > 0) await admin.from("asset_alerts").update({ sms_sent_count: n, last_sms_at: new Date().toISOString() }).eq("id", ins.id);
      }
    }
  }

  return new Response(JSON.stringify({ created, smsSent }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
