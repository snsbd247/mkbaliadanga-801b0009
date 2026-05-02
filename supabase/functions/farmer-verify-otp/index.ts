// Public endpoint: verify OTP and issue a farmer portal session token.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PEPPER = Deno.env.get("FARMER_OTP_PEPPER") ?? "mk-portal-default-pepper-change-me";
const SESSION_HOURS = 2;

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function genToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "unknown";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const identifier = String(body?.identifier ?? "").trim();
    const otp = String(body?.otp ?? "").trim();
    if (!identifier || !/^\d{6}$/.test(otp)) {
      return new Response(JSON.stringify({ error: "Invalid input" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: farmer } = await admin
      .from("farmers")
      .select("id, name_en, name_bn, farmer_code, member_no, office_id, status")
      .or(`farmer_code.ilike.${identifier},member_no.ilike.${identifier}`)
      .limit(1)
      .maybeSingle();

    if (!farmer || farmer.status !== "active") {
      await new Promise((r) => setTimeout(r, 300));
      return new Response(JSON.stringify({ error: "Invalid or expired code" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Find latest unused, unexpired OTP for this farmer
    const { data: otpRow } = await admin
      .from("farmer_otps")
      .select("*")
      .eq("farmer_id", farmer.id)
      .eq("used", false)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otpRow) {
      return new Response(JSON.stringify({ error: "Invalid or expired code" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if ((otpRow.attempts ?? 0) >= 5) {
      await admin.from("farmer_otps").update({ used: true }).eq("id", otpRow.id);
      return new Response(JSON.stringify({ error: "Too many attempts. Request a new code." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const candidate = await sha256(otp + ":" + PEPPER);
    if (candidate !== otpRow.otp_hash) {
      await admin.from("farmer_otps").update({ attempts: (otpRow.attempts ?? 0) + 1 }).eq("id", otpRow.id);
      return new Response(JSON.stringify({ error: "Invalid or expired code" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Mark OTP used and create session
    await admin.from("farmer_otps").update({ used: true }).eq("id", otpRow.id);

    const token = genToken();
    const token_hash = await sha256(token + ":" + PEPPER);
    const expires_at = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString();

    const { error: sErr } = await admin.from("farmer_portal_sessions").insert({
      farmer_id: farmer.id,
      token_hash,
      expires_at,
      ip: getIp(req),
      user_agent: req.headers.get("user-agent")?.slice(0, 250) ?? null,
    });
    if (sErr) {
      console.error("session insert error", sErr);
      return new Response(JSON.stringify({ error: "Server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      ok: true,
      token,
      expires_at,
      farmer: {
        id: farmer.id,
        name: farmer.name_bn || farmer.name_en,
        farmer_code: farmer.farmer_code,
        member_no: farmer.member_no,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("farmer-verify-otp error", e);
    return new Response(JSON.stringify({ error: "Server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
