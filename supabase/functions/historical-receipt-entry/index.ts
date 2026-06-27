// ধাপ ২ — Historical (পুরাতন) রশিদ এন্ট্রি
// পুরাতন রশিদকে বিদ্যমান invoice + payment + invoice_payment স্কিমাতেই ঢোকায়,
// যাতে Paid History, Collection Report এবং রিসিপ্ট ডাউনলোড স্বাভাবিকভাবে কাজ করে।
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const num = (v: unknown): number => {
  const x = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(x) ? x : 0;
};
const r2 = (v: number) => Math.round(v * 100) / 100;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  // --- auth: caller must be admin / super_admin / staff ---
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const user = userData?.user;
  if (!user) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
  const allowed = (roles ?? []).some((r: any) => ["admin", "super_admin", "staff", "developer"].includes(r.role));
  if (!allowed) return json({ error: "Forbidden" }, 403);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const {
    office_id, season_id,
    farmer_id, owner_farmer_id,
    mouza, dag_no, land_size, land_type_id, land_type_name, field_type,
    rate, total_charge, due_amount,
    receipt_no, collection_date, note,
  } = body ?? {};

  if (!season_id || !farmer_id || !owner_farmer_id || !receipt_no || !collection_date) {
    return json({ error: "Missing required fields (season_id, farmer_id, owner_farmer_id, receipt_no, collection_date)" }, 400);
  }

  const payable = r2(Math.max(num(total_charge), 0));
  const due = r2(Math.max(num(due_amount), 0));
  const paid = r2(Math.max(payable - due, 0));
  const isBorga = String(farmer_id) !== String(owner_farmer_id);
  const when = new Date(String(collection_date)).toISOString();
  const ft = ["high_land", "medium_land", "low_land", "other"].includes(String(field_type)) ? field_type : "other";

  // Duplicate guard: same receipt_no already entered as a historical payment.
  const { data: dup } = await admin
    .from("payments")
    .select("id").eq("kind", "irrigation").eq("receipt_no", String(receipt_no)).is("deleted_at", null).maybeSingle();
  if (dup) return json({ error: `রশিদ নং ${receipt_no} ইতিমধ্যে এন্ট্রি করা আছে` }, 409);

  // Derive office from the farmer when the client did not pass one.
  let officeId = office_id ?? null;
  if (!officeId) {
    const { data: f } = await admin.from("farmers").select("office_id").eq("id", farmer_id).maybeSingle();
    officeId = (f as any)?.office_id ?? null;
  }

  try {
    // 1) Find or create the land record.
    let landId: string | null = null;
    const { data: existingLand } = await admin
      .from("lands")
      .select("id")
      .eq("farmer_id", farmer_id)
      .eq("owner_farmer_id", owner_farmer_id)
      .eq("mouza", mouza ?? "")
      .eq("dag_no", dag_no ?? "")
      .is("deleted_at", null)
      .maybeSingle();
    if (existingLand?.id) {
      landId = existingLand.id;
    } else {
      const { data: newLand, error: landErr } = await admin
        .from("lands")
        .insert({
          farmer_id,
          owner_farmer_id,
          owner_type: isBorga ? "borgadar" : "owner",
          land_size: num(land_size),
          field_type: ft,
          land_type_id: land_type_id ?? null,
          mouza: mouza ?? null,
          dag_no: dag_no ?? null,
          dag_numbers: dag_no ? String(dag_no).split(/[,\s]+/).filter(Boolean) : [],
          office_id: officeId,
        })
        .select("id").single();
      if (landErr) throw landErr;
      landId = newLand.id;
    }

    // 2) Invoice (backdated to collection date).
    const status = due <= 0 ? "paid" : paid > 0 ? "partial_paid" : "generated";
    const { data: inv, error: invErr } = await admin
      .from("irrigation_invoices")
      .insert({
        invoice_no: `HIST-${receipt_no}`,
        office_id: officeId,
        season_id,
        land_id: landId,
        owner_farmer_id,
        farmer_id,
        is_borga: isBorga,
        irrigation_amount: payable,
        maintenance_amount: 0,
        canal_amount: 0,
        delay_fee: 0,
        other_charge: 0,
        payable_amount: payable,
        paid_amount: paid,
        due_amount: due,
        previous_due_amount: 0,
        due_date: String(collection_date),
        invoice_status: status,
        season_rate: num(rate),
        land_type_id: land_type_id ?? null,
        land_type_name: land_type_name ?? null,
        note: note ?? null,
        generated_by: user.id,
        generated_at: when,
      })
      .select("id, invoice_no").single();
    if (invErr) throw invErr;

    // 3) Payment + invoice_payment (only when something was collected).
    let paymentId: string | null = null;
    if (paid > 0) {
      const { data: pay, error: payErr } = await admin
        .from("payments")
        .insert({
          farmer_id,
          kind: "irrigation",
          category: "general",
          reference_id: inv.id,
          amount: paid,
          method: "cash",
          note: note ?? null,
          status: "approved",
          receipt_no: String(receipt_no),
          collected_by: user.id,
          approved_by: user.id,
          approved_at: when,
          office_id: officeId,
          created_at: when,
        })
        .select("id").single();
      if (payErr) throw payErr;
      paymentId = pay.id;

      const { error: iipErr } = await admin
        .from("irrigation_invoice_payments")
        .insert({
          invoice_id: inv.id,
          payment_id: paymentId,
          collected_amount: paid,
          irrigation_collected: paid,
          maintenance_collected: 0,
          canal_collected: 0,
          delay_fee_collected: 0,
          current_invoice_collected: paid,
          previous_due_collected: 0,
          office_id: officeId,
          created_by: user.id,
          created_at: when,
        });
      if (iipErr) throw iipErr;
    }

    return json({ ok: true, invoice_id: inv.id, invoice_no: inv.invoice_no, land_id: landId, payment_id: paymentId, paid, due });
  } catch (e) {
    return json({ error: String((e as any)?.message ?? e) }, 500);
  }
});
