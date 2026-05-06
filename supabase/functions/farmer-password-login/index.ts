// Public endpoint: farmer logs in with farmer_code/member_no as username and mobile as password.
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
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

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

function normalizeMobile(m: string): string {
  return (m || "").replace(/\D/g, "").replace(/^88/, "");
}

async function logAttempt(row: {
  identifier: string; farmer_id?: string | null; office_id?: string | null;
  success: boolean; error_reason?: string | null; ip?: string | null; user_agent?: string | null;
}) {
  try { await admin.from("farmer_login_attempts").insert(row); } catch (e) { console.error("log attempt", e); }
}

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const ip = getIp(req);
  const ua = req.headers.get("user-agent")?.slice(0, 250) ?? null;

  try {
    const body = await req.json().catch(() => ({}));
    const identifier = String(body?.identifier ?? "").trim();
    const password = String(body?.password ?? "").trim();
    if (!identifier || identifier.length < 3 || !password) {
      await logAttempt({ identifier, success: false, error_reason: "invalid_input", ip, user_agent: ua });
      return jsonResp({ error: "Invalid input" }, 400);
    }

    // Throttle: count failed attempts in window per IP
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
    const { data: recent } = await admin
      .from("farmer_login_attempts")
      .select("created_at, success")
      .eq("ip", ip)
      .eq("success", false)
      .gte("created_at", windowStart)
      .order("created_at", { ascending: false })
      .limit(RATE_LIMIT_MAX + 1);
    const failedCount = (recent ?? []).length;

    if (failedCount >= RATE_LIMIT_MAX) {
      const oldest = (recent ?? []).slice(0, RATE_LIMIT_MAX).at(-1);
      const oldestMs = oldest ? Date.parse(oldest.created_at as unknown as string) : Date.now();
      const retryAfterMs = Math.max(0, oldestMs + RATE_LIMIT_WINDOW_MS - Date.now());
      const retryAfterSec = Math.ceil(retryAfterMs / 1000);
      await logAttempt({ identifier, success: false, error_reason: "rate_limited", ip, user_agent: ua });
      return new Response(
        JSON.stringify({ error: "Too many attempts. Try again later.", retry_after: retryAfterSec, retry_at: new Date(Date.now() + retryAfterMs).toISOString() }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(retryAfterSec) } },
      );
    }

    // Look up by farmer_code OR member_no (case-insensitive). Also allow leading-zero member_no without dashes.
    const idEsc = identifier.replace(/[%,()]/g, "");
    const { data: farmer } = await admin
      .from("farmers")
      .select("id, name_en, name_bn, farmer_code, member_no, mobile, office_id, status")
      .or(`farmer_code.ilike.${idEsc},member_no.ilike.${idEsc}`)
      .limit(1)
      .maybeSingle();

    if (!farmer || farmer.status !== "active" || !farmer.mobile) {
      await new Promise((r) => setTimeout(r, 300));
      await logAttempt({
        identifier, farmer_id: farmer?.id ?? null, office_id: farmer?.office_id ?? null,
        success: false, error_reason: !farmer ? "unknown_id" : (farmer.status !== "active" ? "inactive" : "no_mobile"),
        ip, user_agent: ua,
      });
      return jsonResp({ error: "Invalid farmer ID or mobile number", attempts_remaining: Math.max(0, RATE_LIMIT_MAX - failedCount - 1) }, 401);
    }

    if (normalizeMobile(password) !== normalizeMobile(farmer.mobile)) {
      await new Promise((r) => setTimeout(r, 300));
      await logAttempt({
        identifier, farmer_id: farmer.id, office_id: farmer.office_id,
        success: false, error_reason: "wrong_password", ip, user_agent: ua,
      });
      return jsonResp({ error: "Invalid farmer ID or mobile number", attempts_remaining: Math.max(0, RATE_LIMIT_MAX - failedCount - 1) }, 401);
    }

    const token = genToken();
    const token_hash = await sha256(token + ":" + PEPPER);
    const expires_at = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString();

    const { error: sErr } = await admin.from("farmer_portal_sessions").insert({
      farmer_id: farmer.id, token_hash, expires_at, ip, user_agent: ua,
    });
    if (sErr) {
      console.error("session insert error", sErr);
      await logAttempt({ identifier, farmer_id: farmer.id, office_id: farmer.office_id, success: false, error_reason: "session_error", ip, user_agent: ua });
      return jsonResp({ error: "Server error" }, 500);
    }

    await logAttempt({ identifier, farmer_id: farmer.id, office_id: farmer.office_id, success: true, ip, user_agent: ua });

    return jsonResp({
      ok: true, token, expires_at,
      farmer: {
        id: farmer.id,
        name: farmer.name_bn || farmer.name_en,
        farmer_code: farmer.farmer_code,
        member_no: farmer.member_no,
      },
    });
  } catch (e) {
    console.error("farmer-password-login error", e);
    await logAttempt({ identifier: "", success: false, error_reason: "exception", ip, user_agent: ua });
    return jsonResp({ error: "Server error" }, 500);
  }
});
