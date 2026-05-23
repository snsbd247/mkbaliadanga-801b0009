import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let period: string | null = null;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body?.period_month && /^\d{4}-\d{2}-\d{2}$/.test(body.period_month)) {
          period = body.period_month;
        }
      } catch { /* no body */ }
    }
    if (!period) {
      const d = new Date();
      period = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
    }

    const { data, error } = await supabase.rpc("run_monthly_depreciation_batch", {
      _period_month: period,
    });
    if (error) throw error;

    const rows = (data || []) as Array<{ status: string }>;
    const summary = rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {});

    return new Response(
      JSON.stringify({ ok: true, period_month: period, count: rows.length, summary, results: rows }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
