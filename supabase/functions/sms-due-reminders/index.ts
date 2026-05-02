// Scans loans + irrigation_charges for upcoming/overdue dues and enqueues
// reminder SMS via the existing send-sms function. Dedupe is enforced by
// a unique partial index on sms_logs(event_type, reference_type, reference_id).
//
// Trigger: cron (daily) or manual POST.
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

function fmtBdt(n: number): string {
  return (n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function render(tpl: string, vars: Record<string, string | number>): string {
  let out = tpl;
  for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}

async function fireSend(logId: string) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
      body: JSON.stringify({ log_id: logId }),
    });
  } catch (_) { /* swallow; retry job will pick it up */ }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Parse optional manual override body: { from?: "YYYY-MM-DD", to?: "YYYY-MM-DD", days_ahead?: number, office_id?: string }
  let body: any = {};
  if (req.method === "POST") {
    try { body = await req.json(); } catch (_) { body = {}; }
  }

  const { data: settings } = await admin.from("sms_settings").select("*").eq("id", 1).maybeSingle();
  if (!settings || !settings.enabled || !settings.send_on_due_reminder) {
    return new Response(JSON.stringify({ skipped: "due reminders disabled" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const lang = settings.language === "en" ? "en" : "bn";
  const tpl = lang === "en" ? settings.tpl_due_reminder_en : settings.tpl_due_reminder;

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  // Determine window
  let fromStr = todayStr;
  let horizonStr: string;
  if (body.from && /^\d{4}-\d{2}-\d{2}$/.test(body.from)) fromStr = body.from;
  if (body.to && /^\d{4}-\d{2}-\d{2}$/.test(body.to)) {
    horizonStr = body.to;
  } else {
    const daysAhead = Number.isFinite(Number(body.days_ahead))
      ? Math.max(0, Math.min(60, Number(body.days_ahead)))
      : (settings.reminder_days_before ?? 3);
    const horizon = new Date(today.getTime() + daysAhead * 86400000);
    horizonStr = horizon.toISOString().slice(0, 10);
  }
  const officeFilter: string | null = typeof body.office_id === "string" && body.office_id ? body.office_id : null;

  const summary = { loan: 0, irrigation: 0, skipped_dup: 0, errors: [] as string[] };

  // ----- LOAN dues -----
  const loansQ = admin
    .from("loans")
    .select("id, farmer_id, office_id, total_payable, next_due_on, status")
    .in("status", ["approved"])
    .not("next_due_on", "is", null)
    .gte("next_due_on", fromStr)
    .lte("next_due_on", horizonStr);
  if (officeFilter) loansQ.eq("office_id", officeFilter);
  const { data: loans, error: lerr } = await loansQ;
  if (lerr) summary.errors.push("loans:" + lerr.message);

  for (const ln of loans ?? []) {
    // Compute remaining due
    const { data: paySum } = await admin
      .from("loan_payments")
      .select("amount")
      .eq("loan_id", ln.id)
      .eq("status", "approved");
    const paid = (paySum ?? []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
    const due = Number(ln.total_payable || 0) - paid;
    if (due <= 0) continue;

    const { data: farmer } = await admin.from("farmers").select("mobile, name_en, name_bn").eq("id", ln.farmer_id).maybeSingle();
    const mobile = farmer?.mobile?.trim();
    if (!mobile) continue;

    const message = render(tpl, {
      type: lang === "en" ? "Loan" : "ঋণ",
      due: fmtBdt(due),
      date: ln.next_due_on,
      amount: fmtBdt(due),
    });

    const { data: ins, error: ie } = await admin
      .from("sms_logs")
      .insert({
        mobile, message, status: "queued",
        event_type: "due_reminder_loan",
        farmer_id: ln.farmer_id,
        reference_type: "loan",
        reference_id: ln.id,
        office_id: ln.office_id,
      })
      .select("id")
      .single();
    if (ie) {
      // unique violation = already reminded; that's the point
      if ((ie as any).code === "23505") summary.skipped_dup++;
      else summary.errors.push("loan_log:" + ie.message);
      continue;
    }
    summary.loan++;
    await fireSend(ins.id);
  }

  // ----- IRRIGATION dues -----
  const irrQ = admin
    .from("irrigation_charges")
    .select("id, farmer_id, office_id, due_amount, entry_date")
    .gt("due_amount", 0);
  if (officeFilter) irrQ.eq("office_id", officeFilter);
  const { data: irr, error: ierr } = await irrQ;
  if (ierr) summary.errors.push("irr:" + ierr.message);

  for (const it of irr ?? []) {
    const { data: farmer } = await admin.from("farmers").select("mobile").eq("id", it.farmer_id).maybeSingle();
    const mobile = farmer?.mobile?.trim();
    if (!mobile) continue;

    const message = render(tpl, {
      type: lang === "en" ? "Irrigation" : "সেচ",
      due: fmtBdt(Number(it.due_amount)),
      date: it.entry_date,
      amount: fmtBdt(Number(it.due_amount)),
    });

    const { data: ins, error: ie } = await admin
      .from("sms_logs")
      .insert({
        mobile, message, status: "queued",
        event_type: "due_reminder_irrigation",
        farmer_id: it.farmer_id,
        reference_type: "irrigation",
        reference_id: it.id,
        office_id: it.office_id,
      })
      .select("id")
      .single();
    if (ie) {
      if ((ie as any).code === "23505") summary.skipped_dup++;
      else summary.errors.push("irr_log:" + ie.message);
      continue;
    }
    summary.irrigation++;
    await fireSend(ins.id);
  }

  // ----- Auto-retry queued/failed (rate-limited: 50 max) -----
  const { data: stuck } = await admin
    .from("sms_logs")
    .select("id, retry_count")
    .in("status", ["queued", "failed"])
    .lt("retry_count", 5)
    .order("created_at", { ascending: true })
    .limit(50);
  for (const r of stuck ?? []) await fireSend(r.id);

  return new Response(
    JSON.stringify({ ok: true, ...summary, retried: stuck?.length ?? 0 }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
