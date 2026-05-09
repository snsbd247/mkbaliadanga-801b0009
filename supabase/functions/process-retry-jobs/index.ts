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
