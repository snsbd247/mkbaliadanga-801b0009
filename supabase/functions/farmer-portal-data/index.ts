// Public endpoint: returns data for an authenticated farmer (token from farmer-verify-otp).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PEPPER = Deno.env.get("FARMER_OTP_PEPPER") ?? "mk-portal-default-pepper-change-me";

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function unauthorized() {
  return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    let token = "";
    const auth = req.headers.get("Authorization") ?? "";
    if (auth.startsWith("Bearer ")) token = auth.slice(7).trim();
    if (!token) {
      const body = await req.json().catch(() => ({}));
      token = String(body?.token ?? "").trim();
    }
    if (!token || token.length < 32) return unauthorized();

    const token_hash = await sha256(token + ":" + PEPPER);
    const { data: session } = await admin
      .from("farmer_portal_sessions")
      .select("id, farmer_id, expires_at")
      .eq("token_hash", token_hash)
      .maybeSingle();

    if (!session) return unauthorized();
    if (new Date(session.expires_at).getTime() < Date.now()) return unauthorized();

    // touch last_used
    admin.from("farmer_portal_sessions").update({ last_used_at: new Date().toISOString() }).eq("id", session.id).then(() => {});

    const farmerId = session.farmer_id;

    const [farmerRes, savingsRes, loansRes, paymentsRes, irrigationRes, irrigationInvoicesRes, intentsRes] = await Promise.all([
      admin.from("farmers").select("id, name_en, name_bn, mobile, farmer_code, member_no, village, address, photo_url, status").eq("id", farmerId).maybeSingle(),
      admin.from("savings_transactions").select("id, type, amount, status, txn_date, note, created_at").eq("farmer_id", farmerId).order("txn_date", { ascending: false }).limit(500),
      admin.from("loans").select("id, principal, interest_rate, total_payable, status, issued_on, next_due_on, note").eq("farmer_id", farmerId).order("issued_on", { ascending: false }).limit(200),
      admin.from("loan_payments").select("id, loan_id, amount, paid_on, status").eq("status", "approved").in("loan_id",
        // sub-query workaround: fetch loan ids first
        (await admin.from("loans").select("id").eq("farmer_id", farmerId)).data?.map((l: any) => l.id) ?? []
      ).order("paid_on", { ascending: false }).limit(500),
      admin.from("irrigation_charges").select("id, entry_date, total, paid_amount, due_amount, season_id, note").eq("farmer_id", farmerId).order("entry_date", { ascending: false }).limit(200),
      admin.from("irrigation_invoices")
        .select("id, invoice_no, generated_at, due_date, payable_amount, paid_amount, due_amount, invoice_status, season_rate, land_type_name, is_borga, is_manual_rate, seasons(name,year,type), lands(dag_no,mouza,land_size)")
        .eq("farmer_id", farmerId).is("deleted_at", null).order("generated_at", { ascending: false }).limit(200),
    ]);

    const farmerCodeForIntents = farmerRes.data?.farmer_code ?? null;
    const intentsRes = farmerCodeForIntents
      ? await admin.from("public_payment_intents")
          .select("id, amount, allocation_hint, note, status, created_at, processed_at")
          .eq("farmer_code", farmerCodeForIntents)
          .order("created_at", { ascending: false }).limit(100)
      : { data: [] as any[] };

    const farmer = farmerRes.data;
    if (!farmer) return unauthorized();

    const savings = savingsRes.data ?? [];
    const savingsBalance = savings
      .filter((s: any) => s.status === "approved")
      .reduce((acc: number, s: any) => acc + (s.type === "deposit" ? Number(s.amount) : -Number(s.amount)), 0);

    const loans = loansRes.data ?? [];
    const payments = paymentsRes.data ?? [];
    const paidByLoan: Record<string, number> = {};
    for (const p of payments) paidByLoan[p.loan_id] = (paidByLoan[p.loan_id] ?? 0) + Number(p.amount);

    const loansWithDue = loans.map((l: any) => {
      const paid = paidByLoan[l.id] ?? 0;
      return { ...l, paid, due: Math.max(Number(l.total_payable) - paid, 0) };
    });
    const loanBalance = loansWithDue
      .filter((l: any) => l.status === "approved")
      .reduce((acc: number, l: any) => acc + l.due, 0);

    const irrigation = irrigationRes.data ?? [];
    const irrigationDue = irrigation.reduce((a: number, i: any) => a + Number(i.due_amount ?? 0), 0);

    const irrigationInvoices = irrigationInvoicesRes.data ?? [];
    const irrigationInvoiceDue = irrigationInvoices
      .filter((i: any) => i.invoice_status !== "cancelled")
      .reduce((a: number, i: any) => a + Number(i.due_amount ?? 0), 0);

    return new Response(JSON.stringify({
      ok: true,
      farmer: {
        id: farmer.id,
        name: farmer.name_bn || farmer.name_en,
        name_en: farmer.name_en,
        mobile_masked: farmer.mobile ? farmer.mobile.slice(0, 3) + "****" + farmer.mobile.slice(-3) : null,
        farmer_code: farmer.farmer_code,
        member_no: farmer.member_no,
        village: farmer.village,
        address: farmer.address,
        photo_url: farmer.photo_url,
      },
      summary: {
        savings_balance: savingsBalance,
        loan_due: loanBalance,
        irrigation_due: irrigationDue + irrigationInvoiceDue,
        irrigation_invoice_due: irrigationInvoiceDue,
      },
      savings,
      loans: loansWithDue,
      loan_payments: payments,
      irrigation,
      irrigation_invoices: irrigationInvoices,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      irrigation_invoices: irrigationInvoices,
      payment_intents: intentsRes.data ?? [],
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("farmer-portal-data error", e);
    return new Response(JSON.stringify({ error: "Server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
