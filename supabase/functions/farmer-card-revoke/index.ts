// Revoke ALL active QR tokens for a farmer (admin / super_admin only).
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
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return err(401, "Unauthorized");
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(authHeader.slice(7));
    if (claimsErr || !claimsData?.claims?.sub) return err(401, "Unauthorized");
    const userId = claimsData.claims.sub as string;

    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
    const allowed = (roles ?? []).some((r: any) => ["super_admin", "admin"].includes(r.role));
    if (!allowed) return err(403, "Forbidden");

    const body = await req.json().catch(() => ({}));
    const farmerId = String(body?.farmer_id ?? "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(farmerId)) return err(400, "Invalid farmer_id");

    const { data: farmer } = await admin
      .from("farmers")
      .select("id, office_id")
      .eq("id", farmerId)
      .maybeSingle();
    if (!farmer) return err(404, "Farmer not found");

    const { data: revoked, error: updErr } = await admin
      .from("qr_tokens")
      .update({ revoked: true })
      .eq("farmer_id", farmerId)
      .eq("revoked", false)
      .select("id");
    if (updErr) return err(500, "Could not revoke");

    await admin.from("audit_logs").insert({
      user_id: userId,
      office_id: farmer.office_id,
      action: "revoke",
      entity: "qr_tokens",
      entity_id: farmerId,
      new_values: { revoked_count: (revoked ?? []).length },
    });

    return new Response(JSON.stringify({ ok: true, revoked: (revoked ?? []).length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("farmer-card-revoke error", e);
    return err(500, "Server error");
  }
});
