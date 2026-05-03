// Bulk-issue/return active QR tokens + minimal card data for many farmers in one call.
// Used by the "Bulk QR Cards" admin page to render a multi-page PDF.
// Auth: requires admin/super_admin/committee/staff.
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
    const { data: claimsData, error: claimsErr } = await userClient.auth.getUser());
    if (claimsErr || !claimsData?.user?.id) return err(401, "Unauthorized");
    const userId = claimsData.user.id as string;
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
    const allowed = (roles ?? []).some((r: any) => ["super_admin", "admin", "committee", "staff"].includes(r.role));
    if (!allowed) return err(403, "Forbidden");

    const body = await req.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body?.farmer_ids) ? body.farmer_ids : [];
    const cleaned = ids.filter((s) => typeof s === "string" && /^[0-9a-f-]{36}$/i.test(s)).slice(0, 200);
    if (cleaned.length === 0) return err(400, "farmer_ids required (max 200)");

    const { data: farmers } = await admin
      .from("farmers")
      .select("id, name_en, name_bn, farmer_code, member_no, mobile, village, address, photo_url, status, office_id")
      .in("id", cleaned);

    const out: any[] = [];
    for (const f of (farmers ?? []) as any[]) {
      if (f.status !== "active") {
        out.push({ farmer_id: f.id, error: "inactive" });
        continue;
      }
      // Get most recent active token, issue one if none.
      const { data: tok } = await admin.from("qr_tokens")
        .select("token, created_at").eq("farmer_id", f.id).eq("revoked", false)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      let token = tok?.token; let issuedAt = tok?.created_at;
      if (!token) {
        const newTok = genToken();
        const { data: ins, error: insErr } = await admin.from("qr_tokens")
          .insert({ farmer_id: f.id, token: newTok, created_by: userId })
          .select("token, created_at").single();
        if (insErr || !ins) { out.push({ farmer_id: f.id, error: "issue_failed" }); continue; }
        token = ins.token; issuedAt = ins.created_at;
        await admin.from("audit_logs").insert({
          user_id: userId, office_id: f.office_id, action: "issue",
          entity: "qr_tokens", entity_id: f.id, new_values: { source: "bulk" },
        });
      }
      out.push({
        farmer_id: f.id,
        farmer: {
          name: f.name_bn || f.name_en, name_en: f.name_en,
          farmer_code: f.farmer_code, member_no: f.member_no,
          mobile: f.mobile, village: f.village, address: f.address,
          photo_url: f.photo_url,
        },
        token, issued_at: issuedAt,
      });
    }

    await admin.from("audit_logs").insert({
      user_id: userId, action: "bulk_card_issue", entity: "qr_tokens",
      new_values: { count: out.length },
    });

    return new Response(JSON.stringify({ ok: true, items: out }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("farmer-cards-bulk error", e);
    return err(500, "Server error");
  }
});
