// Authenticated farmer payment-intent submission.
// Validates farmer-portal session token, then writes to public_payment_intents using service role.
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

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const ALLOWED_HINTS = new Set(["irrigation", "loan", "savings", "other"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({} as any));
    const token = String(
      (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "") || body?.token || "",
    ).trim();
    if (!token || token.length < 32) return json({ error: "Unauthorized" }, 401);

    // Validate session
    const token_hash = await sha256(token + ":" + PEPPER);
    const { data: session } = await admin
      .from("farmer_portal_sessions")
      .select("id, farmer_id, expires_at")
      .eq("token_hash", token_hash)
      .maybeSingle();
    if (!session) return json({ error: "Unauthorized" }, 401);
    if (new Date(session.expires_at).getTime() < Date.now()) return json({ error: "Session expired" }, 401);

    // Input validation
    const amount = Number(body?.amount);
    const allocation_hint = String(body?.allocation_hint ?? "other");
    const phone = body?.phone ? String(body.phone).trim().slice(0, 20) : null;
    const note = body?.note ? String(body.note).trim().slice(0, 500) : null;
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) {
      return json({ error: "Invalid amount" }, 400);
    }
    if (!ALLOWED_HINTS.has(allocation_hint)) return json({ error: "Invalid allocation hint" }, 400);

    // Resolve farmer (always tie to the token's farmer — never trust client farmer_code)
    const { data: farmer } = await admin
      .from("farmers")
      .select("id, farmer_code, office_id")
      .eq("id", session.farmer_id)
      .maybeSingle();
    if (!farmer) return json({ error: "Farmer not found" }, 404);

    // Touch session
    admin.from("farmer_portal_sessions").update({ last_used_at: new Date().toISOString() }).eq("id", session.id).then(() => {});

    const { data: inserted, error } = await admin.from("public_payment_intents").insert({
      farmer_code: farmer.farmer_code,
      office_id: farmer.office_id,
      phone,
      amount,
      allocation_hint,
      note,
      status: "pending",
    }).select("id").single();
    if (error) {
      console.error("insert error", error);
      return json({ error: "Insert failed" }, 500);
    }

    return json({ ok: true, id: inserted.id });
  } catch (e) {
    console.error("farmer-submit-payment-intent error", e);
    return json({ error: "Server error" }, 500);
  }
});
