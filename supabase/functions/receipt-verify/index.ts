// Public receipt verification — no auth required.
// Returns minimal receipt details for a given verify_token.
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

function maskMobile(m?: string | null) {
  if (!m) return null;
  return m.length <= 4 ? "***" : m.slice(0, 3) + "****" + m.slice(-3);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    let token = url.searchParams.get("token") ?? "";
    if (!token && (req.method === "POST")) {
      const b = await req.json().catch(() => ({}));
      token = String(b?.token ?? "");
    }
    token = token.trim();
    if (!/^[a-f0-9]{16,64}$/i.test(token)) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid token" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: p } = await admin
      .from("payments")
      .select("id, kind, amount, method, note, created_at, status, receipt_no, deleted_at, farmer_id, office_id")
      .eq("verify_token", token)
      .maybeSingle();

    if (!p || p.deleted_at) {
      return new Response(JSON.stringify({ ok: false, error: "Receipt not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: f }, { data: o }, { data: c }] = await Promise.all([
      admin.from("farmers").select("name_en, name_bn, farmer_code, member_no, mobile, village").eq("id", p.farmer_id).maybeSingle(),
      p.office_id
        ? admin.from("offices").select("name").eq("id", p.office_id).maybeSingle()
        : Promise.resolve({ data: null }),
      admin.from("company_settings").select("company_name, company_name_bn").eq("id", 1).maybeSingle(),
    ]);

    return new Response(JSON.stringify({
      ok: true,
      receipt: {
        receipt_no: p.receipt_no,
        kind: p.kind,
        amount: Number(p.amount),
        method: p.method,
        note: p.note,
        date: p.created_at,
        status: p.status,
      },
      farmer: f ? {
        name: f.name_bn || f.name_en,
        member_no: f.member_no ?? f.farmer_code ?? null,
        village: f.village ?? null,
        mobile_masked: maskMobile(f.mobile),
      } : null,
      office: o?.name ?? null,
      company: {
        name: c?.company_name ?? null,
        name_bn: c?.company_name_bn ?? null,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("receipt-verify error", e);
    return new Response(JSON.stringify({ ok: false, error: "Server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
