// Recalculate interest + total payable for active lump-sum loans when a loan
// plan's term (duration_months) or interest rate is edited.
// For lump-sum plans the whole principal + flat interest is due at term end:
//   total_payable = round(principal * (1 + interest_rate/100))   when interest enabled
//   next_due_on   = issued_on + duration_months
// Auth: any logged-in user; service role performs the writes after auth check.
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

function err(status: number, msg: string) {
  return new Response(JSON.stringify({ error: msg }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function addMonths(isoDate: string, months: number): string {
  const d = new Date((isoDate || new Date().toISOString().slice(0, 10)) + "T00:00:00");
  if (isNaN(d.getTime())) return isoDate;
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return err(401, "Unauthorized");
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: cErr } = await userClient.auth.getUser();
    if (cErr || !claims?.user?.id) return err(401, "Unauthorized");

    const body = await req.json().catch(() => ({}));
    const planId = body?.plan_id ? String(body.plan_id) : null;
    if (!planId) return err(400, "plan_id is required");

    const { data: plan, error: pErr } = await admin
      .from("loan_plans").select("id, installment_type, interest_rate, duration_months").eq("id", planId).maybeSingle();
    if (pErr) return err(500, pErr.message);
    if (!plan) return err(404, "Loan plan not found");
    if (plan.installment_type !== "lump_sum") {
      return new Response(JSON.stringify({ updated: 0, skipped: "not_lump_sum" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rate = Number(plan.interest_rate || 0);
    const months = Math.max(1, Number(plan.duration_months || 0));

    // Active loans = not yet fully paid / not deleted.
    const { data: loans, error: lErr } = await admin
      .from("loans")
      .select("id, principal, interest_enabled, issued_on, status")
      .eq("plan_id", planId)
      .is("deleted_at", null)
      .in("status", ["pending", "approved", "active", "disbursed"]);
    if (lErr) return err(500, lErr.message);

    let updated = 0;
    for (const loan of loans ?? []) {
      const principal = Number(loan.principal || 0);
      const interestEnabled = !!loan.interest_enabled;
      const totalPayable = interestEnabled ? Math.round(principal * (1 + rate / 100)) : Math.round(principal);
      const nextDueOn = addMonths(String(loan.issued_on || "").slice(0, 10), months);
      const { error: uErr } = await admin
        .from("loans")
        .update({
          interest_rate: interestEnabled ? rate : 0,
          total_payable: totalPayable,
          next_due_on: nextDueOn,
        })
        .eq("id", loan.id);
      if (!uErr) updated++;
    }

    return new Response(JSON.stringify({ updated, total: loans?.length ?? 0, rate, months }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return err(500, e instanceof Error ? e.message : "Unexpected error");
  }
});
