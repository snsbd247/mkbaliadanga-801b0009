// Public endpoint: farmer requests an OTP by farmer_code or member_no.
// Generates a 6-digit OTP, stores its SHA-256 hash, and sends via existing send-sms.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const PEPPER = Deno.env.get("FARMER_OTP_PEPPER") ?? "mk-portal-default-pepper-change-me";

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function maskMobile(m: string): string {
  if (!m) return "";
  const t = m.trim();
  if (t.length <= 4) return "***";
  return t.slice(0, 3) + "****" + t.slice(-3);
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
    if (!identifier || identifier.length < 3 || identifier.length > 64) {
      return new Response(JSON.stringify({ error: "Invalid identifier" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Look up farmer by farmer_code OR member_no (case-insensitive)
    const { data: farmer, error: fErr } = await admin
      .from("farmers")
      .select("id, name_en, name_bn, mobile, office_id, farmer_code, member_no, status")
      .or(`farmer_code.ilike.${identifier},member_no.ilike.${identifier}`)
      .limit(1)
      .maybeSingle();

    if (fErr) {
      console.error("farmer lookup error", fErr);
    }

    // Always respond generically to avoid enumeration
    const generic = { ok: true, message: "If the farmer exists, an OTP has been sent." };

    if (!farmer || farmer.status !== "active" || !farmer.mobile) {
      // small delay to mitigate timing attacks
      await new Promise((r) => setTimeout(r, 300));
      return new Response(JSON.stringify(generic), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const ip = getIp(req);

    // Rate limit: max 3 OTPs per farmer per 15 minutes
    const windowStart = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count } = await admin
      .from("farmer_otps")
      .select("id", { count: "exact", head: true })
      .eq("farmer_id", farmer.id)
      .gte("created_at", windowStart);

    if ((count ?? 0) >= 3) {
      return new Response(JSON.stringify({ error: "Too many OTP requests. Try again later." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otp_hash = await sha256(otp + ":" + PEPPER);
    const expires_at = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const mobile_masked = maskMobile(farmer.mobile);

    const { error: insErr } = await admin.from("farmer_otps").insert({
      farmer_id: farmer.id,
      otp_hash,
      mobile_masked,
      expires_at,
      ip,
    });
    if (insErr) {
      console.error("otp insert error", insErr);
      return new Response(JSON.stringify({ error: "Server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Send SMS via existing send-sms function
    const message = `Your verification code is ${otp}. Valid for 5 minutes. Do not share.`;
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": ANON_KEY, "Authorization": `Bearer ${ANON_KEY}` },
        body: JSON.stringify({
          mobile: farmer.mobile,
          message,
          event_type: "farmer_portal_otp",
          farmer_id: farmer.id,
        }),
      });
    } catch (e) {
      console.error("send-sms invoke failed", e);
    }

    return new Response(JSON.stringify({ ok: true, mobile_masked, message: "OTP sent." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("farmer-request-otp error", e);
    return new Response(JSON.stringify({ error: "Server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
