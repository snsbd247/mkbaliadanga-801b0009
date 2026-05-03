// Issue (or rotate) the QR token for a farmer's membership card.
// Auth: requires a logged-in admin/staff (validated via getClaims).
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

function genToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return "mkc_" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function err(status: number, msg: string) {
  return new Response(JSON.stringify({ error: msg }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return err(401, "Unauthorized");
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: claimsData, error: claimsErr } = await userClient.auth.getUser();
    if (claimsErr || !claimsData?.user?.id) return err(401, "Unauthorized");
    const userId = claimsData.user.id as string;

    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
    const allowed = (roles ?? []).some((r: any) => ["super_admin", "admin", "committee", "staff"].includes(r.role));
    if (!allowed) return err(403, "Forbidden");

    const body = await req.json().catch(() => ({}));
    const farmerId = String(body?.farmer_id ?? "").trim();
    const rotate = !!body?.rotate;
    if (!/^[0-9a-f-]{36}$/i.test(farmerId)) return err(400, "Invalid farmer_id");

    const { data: farmer } = await admin.from("farmers").select("id, status").eq("id", farmerId).maybeSingle();
    if (!farmer || farmer.status !== "active") return err(404, "Farmer not found");

    if (rotate) {
      await admin.from("qr_tokens").update({ revoked: true }).eq("farmer_id", farmerId).eq("revoked", false);
    }

    let { data: existing } = await admin
      .from("qr_tokens")
      .select("token, created_at")
      .eq("farmer_id", farmerId).eq("revoked", false)
      .order("created_at", { ascending: false })
      .limit(1).maybeSingle();

    if (!existing) {
      const token = genToken();
      const { data: ins, error: insErr } = await admin
        .from("qr_tokens")
        .insert({ farmer_id: farmerId, token, created_by: userId })
        .select("token, created_at").single();
      if (insErr) return err(500, "Could not issue token");
      existing = ins;

      await admin.from("audit_logs").insert({
        user_id: userId, action: "issue", entity: "qr_tokens",
        entity_id: farmerId, new_values: { rotated: rotate },
      });
    }

    return new Response(JSON.stringify({ ok: true, token: existing!.token, issued_at: existing!.created_at }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("farmer-card-token error", e);
    // Return 200 + fallback signal so the client SDK / fetch caller can read
    // the body and show a friendly message instead of a blank screen.
    return new Response(
      JSON.stringify({ ok: false, error: "SERVICE_FAILED", fallback: true, message: String((e as any)?.message ?? e) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
