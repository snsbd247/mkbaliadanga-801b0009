// ধাপ ৪ — Step 4 invoice generation API.
// Computes due totals for office/date/farmer filters used by the dashboard,
// FarmerDetail and PDF/Excel exports. Enforces office-level authorization
// (users may only read their assigned office) and returns bilingual errors.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface BilingualError { field: string; en: string; bn: string }

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const r2 = (v: number) => Math.round(v * 100) / 100;

function validateQuery(q: Record<string, string>): BilingualError[] {
  const errors: BilingualError[] = [];
  if (!q.office_id?.trim())
    errors.push({ field: "office_id", en: "Office is required.", bn: "অফিস নির্বাচন আবশ্যক।" });
  if (q.from && !isDate(q.from))
    errors.push({ field: "from", en: "Start date must be a valid date (YYYY-MM-DD).", bn: "শুরুর তারিখ সঠিক হতে হবে (YYYY-MM-DD)।" });
  if (q.to && !isDate(q.to))
    errors.push({ field: "to", en: "End date must be a valid date (YYYY-MM-DD).", bn: "শেষের তারিখ সঠিক হতে হবে (YYYY-MM-DD)।" });
  if (q.from && q.to && isDate(q.from) && isDate(q.to) && q.from > q.to)
    errors.push({ field: "to", en: "End date must be on or after the start date.", bn: "শেষের তারিখ শুরুর তারিখের সমান বা পরে হতে হবে।" });
  return errors;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const url = new URL(req.url);
    const q: Record<string, string> = {
      office_id: String(body?.office_id ?? url.searchParams.get("office_id") ?? "").trim(),
      farmer_id: String(body?.farmer_id ?? url.searchParams.get("farmer_id") ?? "").trim(),
      from: String(body?.from ?? url.searchParams.get("from") ?? "").trim(),
      to: String(body?.to ?? url.searchParams.get("to") ?? "").trim(),
    };

    const errors = validateQuery(q);
    if (errors.length) return json({ errors }, 400);

    // Authenticate the caller and enforce office-level authorization.
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { data: profile } = await supabase
      .from("profiles").select("office_id").eq("id", user.id).maybeSingle();
    const userOffice = (profile as any)?.office_id ?? null;
    if (userOffice && userOffice !== q.office_id) {
      return json({
        error: { en: "You can only view invoices for your assigned office.", bn: "আপনি কেবল আপনার নির্ধারিত অফিসের চালান দেখতে পারবেন।" },
      }, 403);
    }

    let query = supabase
      .from("irrigation_invoices")
      .select("payable_amount,paid_amount,due_amount,due_date,status")
      .eq("office_id", q.office_id)
      .is("deleted_at", null);
    if (q.farmer_id) query = query.eq("farmer_id", q.farmer_id);
    if (q.from) query = query.gte("invoice_date", q.from);
    if (q.to) query = query.lte("invoice_date", q.to);

    const { data: rows, error } = await query;
    if (error) throw error;

    const today = new Date().toISOString().slice(0, 10);
    let payable = 0, paid = 0, due = 0, overdue = 0;
    for (const r of rows ?? []) {
      const p = Number((r as any).payable_amount || 0);
      const pd = Number((r as any).paid_amount || 0);
      const d = Number((r as any).due_amount ?? p - pd);
      payable += p; paid += pd; due += d;
      if (d > 0 && (r as any).due_date && (r as any).due_date < today) overdue += d;
    }

    return json({
      summary: { payable: r2(payable), paid: r2(paid), due: r2(due), overdue: r2(overdue), invoiceCount: (rows ?? []).length },
      filters: q,
    });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
