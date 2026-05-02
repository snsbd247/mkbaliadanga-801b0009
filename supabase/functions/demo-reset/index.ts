import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Missing auth" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: who } = await userClient.auth.getUser();
    if (!who?.user) return json({ error: "Invalid session" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", who.user.id);
    if (!(roles ?? []).some((r: any) => r.role === "super_admin")) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const confirm = body?.confirm;
    if (confirm !== "RESET") return json({ error: "Confirmation required" }, 400);

    // Wipe transactional tables (preserve locations, offices, profiles, accounts, settings, roles)
    const tables = [
      "payment_allocations", "payments", "loan_payments", "loans",
      "irrigation_charges", "savings_transactions", "savings_yearly_opening",
      "shares", "expenses", "receipts",
      "ledger_entries", "journal_entry_lines", "journal_entries",
      "land_relations", "lands", "farmer_otps", "farmer_portal_sessions",
      "qr_tokens", "sms_logs", "notifications", "audit_logs",
      "farmers",
    ];

    for (const t of tables) {
      const { error } = await admin.from(t).delete().not("id", "is", null);
      if (error && !/no rows|does not exist/i.test(error.message)) {
        console.error(`wipe ${t}:`, error.message);
      }
    }

    // Reseed: 10 demo farmers in Baliadanga Branch
    const officeId = "11111111-1111-1111-1111-111111111111";
    const { data: office } = await admin.from("offices").select("id").eq("id", officeId).maybeSingle();
    if (!office) {
      await admin.from("offices").insert({ id: officeId, name: "Baliadanga Branch", address: "Rangpur" });
    }

    // Find Baliadanga mouza (created earlier)
    const { data: mouza } = await admin.from("mouzas").select("id, ward_id, union_id").ilike("name", "%baliadanga%").maybeSingle();

    const farmers = Array.from({ length: 10 }, (_, i) => ({
      farmer_code: `BAL-${String(i + 1).padStart(4, "0")}`,
      member_no: `M${String(i + 1).padStart(4, "0")}`,
      name_en: `Demo Farmer ${i + 1}`,
      name_bn: `ডেমো কৃষক ${i + 1}`,
      father_name: `Father ${i + 1}`,
      mother_name: `Mother ${i + 1}`,
      mobile: `+8801700000${String(i).padStart(3, "0")}`,
      nid: `19900000000000${String(i).padStart(2, "0")}`,
      village: "Baliadanga",
      mouza: "Baliadanga",
      mouza_id: mouza?.id ?? null,
      ward_id: mouza?.ward_id ?? null,
      union_id: mouza?.union_id ?? null,
      office_id: officeId,
      status: "active",
    }));

    const { data: insertedFarmers, error: fErr } = await admin.from("farmers").insert(farmers).select("id");
    if (fErr) return json({ error: `Farmer seed failed: ${fErr.message}` }, 500);

    // 1 land per farmer
    const lands = (insertedFarmers ?? []).map((f, i) => ({
      farmer_id: f.id,
      land_size: 0.5 + (i % 5) * 0.25,
      mouza: "Baliadanga",
      mouza_id: mouza?.id ?? null,
      dag_no: `D${100 + i}`,
      field_type: "medium_land",
      owner_type: "owner",
      office_id: officeId,
    }));
    await admin.from("lands").insert(lands);

    // Sample savings (deposits)
    const savings = (insertedFarmers ?? []).slice(0, 5).map((f) => ({
      farmer_id: f.id, type: "deposit", amount: 1000, status: "approved", office_id: officeId,
    }));
    await admin.from("savings_transactions").insert(savings);

    // Sample loan
    if (insertedFarmers?.[0]) {
      await admin.from("loans").insert({
        farmer_id: insertedFarmers[0].id, principal: 10000, interest_rate: 12, total_payable: 11200,
        status: "approved", office_id: officeId,
      });
    }

    return json({ ok: true, farmers_inserted: insertedFarmers?.length ?? 0 });
  } catch (e: any) {
    console.error(e);
    return json({ error: e?.message ?? "Server error" }, 500);
  }
});
