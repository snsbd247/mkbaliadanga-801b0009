// Background retry queue processor.
// Picks pending/retrying jobs whose next_retry_at <= now() and dispatches them.
// Currently handles: sms_send (re-invokes send-sms function).
// receipt_generation jobs are admin-retry only (browser-side regeneration).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SCHEDULE_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];
function nextRetryAt(attempt: number) {
  const idx = Math.min(Math.max(attempt, 0), SCHEDULE_MS.length - 1);
  return new Date(Date.now() + SCHEDULE_MS[idx]).toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: jobs, error } = await supabase
    .from("background_retry_jobs")
    .select("*")
    .in("status", ["pending", "retrying"])
    .lte("next_retry_at", new Date().toISOString())
    .order("next_retry_at", { ascending: true })
    .limit(50);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let processed = 0, succeeded = 0, failed = 0;

  for (const job of jobs ?? []) {
    processed++;
    try {
      if (job.job_type === "sms_send") {
        const body = job.payload ?? {};
        const { error: sErr } = await supabase.functions.invoke("send-sms", { body });
        if (sErr) throw sErr;
      } else if (job.job_type === "cashbook_write") {
        const p = job.payload ?? {};
        // Idempotent: skip if a Cash Book receipt already exists for this receipt_no.
        const { data: existing } = await supabase
          .from("receipts").select("id").eq("kind", "irrigation").eq("receipt_no", p.receipt_no).maybeSingle();
        if (!existing) {
          const { error: rErr } = await supabase.from("receipts").insert({
            kind: "irrigation", farmer_id: p.farmer_id, reference_id: p.reference_id,
            amount: p.amount, method: p.method, receipt_no: p.receipt_no,
            receipt_date: new Date().toISOString().slice(0, 10), office_id: p.office_id,
          });
          if (rErr) throw rErr;
        }
      } else if (job.job_type === "journal_post") {
        const p = job.payload ?? {};
        // Idempotent: skip if a journal with this reference already exists.
        const { data: existing } = await supabase
          .from("journal_entries").select("id").eq("reference", p.reference).maybeSingle();
        if (!existing) {
          const { data: accs } = await supabase.from("accounts").select("id,code").in("code", ["1010", "IRR-INCOME", "4010"]);
          const byCode: Record<string, string> = Object.fromEntries((accs ?? []).map((a: any) => [a.code, a.id]));
          const cash = byCode["1010"];
          const income = byCode["IRR-INCOME"] ?? byCode["4010"];
          if (!cash || !income) throw new Error("Required accounts (1010 / income) missing");
          const amount = Number(p.amount || 0);
          const { data: je, error: jeErr } = await supabase.from("journal_entries").insert({
            entry_date: new Date().toISOString().slice(0, 10),
            reference: p.reference, description: `Irrigation payment retry (${p.invoice_no ?? ""})`,
            office_id: p.office_id, posted: true, posted_at: new Date().toISOString(),
          }).select("id").single();
          if (jeErr || !je) throw jeErr ?? new Error("Journal insert failed");
          const { error: lErr } = await supabase.from("journal_entry_lines").insert([
            { journal_id: je.id, account_id: cash, debit: amount, credit: 0, position: 0, description: "Cash received" },
            { journal_id: je.id, account_id: income, debit: 0, credit: amount, position: 1, description: "Irrigation income" },
          ]);
          if (lErr) throw lErr;
        }
      } else {
        // Unknown / browser-only job type — skip (will be retried manually)
        continue;
      }
      await supabase
        .from("background_retry_jobs")
        .update({ status: "succeeded", last_error: null })
        .eq("id", job.id);
      succeeded++;
    } catch (e: any) {
      const attempt = (job.retry_count ?? 0) + 1;
      const exhausted = attempt > (job.max_retry ?? 4);
      await supabase
        .from("background_retry_jobs")
        .update({
          status: exhausted ? "permanently_failed" : "retrying",
          retry_count: attempt,
          next_retry_at: nextRetryAt(attempt - 1),
          last_error: String(e?.message ?? e).slice(0, 4000),
        })
        .eq("id", job.id);
      failed++;
    }
  }

  return new Response(JSON.stringify({ processed, succeeded, failed }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
