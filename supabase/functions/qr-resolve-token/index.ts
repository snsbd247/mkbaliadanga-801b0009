// Resolve a scanned QR token to the farmer summary used by the Scan Payment screen.
// Auth: requires a logged-in admin/staff. Logs every lookup to audit_logs.
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

function maskMobile(m?: string | null): string | null {
  if (!m) return null;
  return m.length <= 4 ? "***" : m.slice(0, 3) + "****" + m.slice(-3);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return err(401, "Unauthorized");
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(authHeader.slice(7));
    if (claimsErr || !claimsData?.claims?.sub) return err(401, "Unauthorized");
    const userId = claimsData.claims.sub as string;

    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
    const allowed = (roles ?? []).some((r: any) => ["super_admin", "admin", "committee", "staff"].includes(r.role));
    if (!allowed) return err(403, "Forbidden");

    const body = await req.json().catch(() => ({}));
    const token = String(body?.token ?? "").trim();
    if (!/^mkc_[0-9a-f]{32}$/i.test(token)) return err(400, "Invalid token format");

    const { data: tok } = await admin
      .from("qr_tokens").select("farmer_id, revoked, expires_at")
      .eq("token", token).maybeSingle();
    if (!tok) return err(404, "Token not recognized");
    const expired = tok.expires_at && new Date(tok.expires_at).getTime() < Date.now();
    if (tok.revoked || expired) {
      return new Response(
        JSON.stringify({ error: "This card has been revoked or expired. Please request a new card." }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: farmer } = await admin
      .from("farmers")
      .select("id, name_en, name_bn, farmer_code, member_no, mobile, village, photo_url, status, office_id")
      .eq("id", tok.farmer_id).maybeSingle();
    if (!farmer || farmer.status !== "active") return err(404, "Farmer not active");

    // Compute simple dues
    const [{ data: loans }, { data: irr }, { data: payments }] = await Promise.all([
      admin.from("loans").select("id, total_payable, loan_payments(amount,status)").eq("farmer_id", farmer.id).eq("status", "approved"),
      admin.from("irrigation_charges").select("due_amount").eq("farmer_id", farmer.id).gt("due_amount", 0),
      admin.from("savings_transactions").select("type, amount, status").eq("farmer_id", farmer.id),
    ]);

    const loanDue = (loans ?? []).reduce((acc: number, l: any) => {
      const paid = (l.loan_payments ?? []).filter((p: any) => p.status === "approved").reduce((s: number, p: any) => s + Number(p.amount), 0);
      return acc + Math.max(Number(l.total_payable) - paid, 0);
    }, 0);
    const irrDue = (irr ?? []).reduce((acc: number, r: any) => acc + Number(r.due_amount ?? 0), 0);
    const savingsBalance = (payments ?? [])
      .filter((p: any) => p.status === "approved")
      .reduce((acc: number, p: any) => acc + (p.type === "deposit" ? Number(p.amount) : -Number(p.amount)), 0);

    await admin.from("audit_logs").insert({
      user_id: userId, office_id: farmer.office_id,
      action: "scan", entity: "qr_tokens", entity_id: farmer.id,
      new_values: { token_prefix: token.slice(0, 8) },
    });

    return new Response(JSON.stringify({
      ok: true,
      farmer: {
        id: farmer.id,
        name: farmer.name_bn || farmer.name_en,
        farmer_code: farmer.farmer_code,
        member_no: farmer.member_no,
        mobile_masked: maskMobile(farmer.mobile),
        village: farmer.village,
        photo_url: farmer.photo_url,
        office_id: farmer.office_id,
      },
      summary: { loan_due: loanDue, irrigation_due: irrDue, savings_balance: savingsBalance },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("qr-resolve-token error", e);
    return err(500, "Server error");
  }
});
