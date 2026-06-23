// ধাপ ৫ — Receipt & paid-history API.
// Returns receipt numbering + paid history for office/date/farmer filters with
// the same pagination + sorting the UI uses. Enforces office-level
// authorization (users may only read their assigned office).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const r2 = (v: number) => Math.round(v * 100) / 100;
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const url = new URL(req.url);
    const pick = (k: string) => String(body?.[k] ?? url.searchParams.get(k) ?? "").trim();
    const officeId = pick("office_id");
    const farmerId = pick("farmer_id");
    const from = pick("from");
    const to = pick("to");
    const page = Math.max(parseInt(pick("page") || "1", 10) || 1, 1);
    const perPage = Math.min(Math.max(parseInt(pick("per_page") || "25", 10) || 25, 1), 200);
    const sortDir = pick("sort") === "asc" ? true : false; // default: newest first

    const errors: { field: string; en: string; bn: string }[] = [];
    if (!officeId) errors.push({ field: "office_id", en: "Office is required.", bn: "অফিস নির্বাচন আবশ্যক।" });
    if (from && !isDate(from)) errors.push({ field: "from", en: "Start date must be valid (YYYY-MM-DD).", bn: "শুরুর তারিখ সঠিক হতে হবে (YYYY-MM-DD)।" });
    if (to && !isDate(to)) errors.push({ field: "to", en: "End date must be valid (YYYY-MM-DD).", bn: "শেষের তারিখ সঠিক হতে হবে (YYYY-MM-DD)।" });
    if (errors.length) return json({ errors }, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: userData } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { data: profile } = await supabase.from("profiles").select("office_id").eq("id", user.id).maybeSingle();
    const userOffice = (profile as any)?.office_id ?? null;
    if (userOffice && userOffice !== officeId) {
      return json({ error: { en: "You can only view receipts for your assigned office.", bn: "আপনি কেবল আপনার নির্ধারিত অফিসের রসিদ দেখতে পারবেন।" } }, 403);
    }

    let query = supabase
      .from("irrigation_invoice_payments")
      .select("id,receipt_no,amount,paid_at,method,farmer_id,office_id", { count: "exact" })
      .eq("office_id", officeId)
      .is("deleted_at", null)
      .order("paid_at", { ascending: sortDir })
      .range((page - 1) * perPage, page * perPage - 1);
    if (farmerId) query = query.eq("farmer_id", farmerId);
    if (from) query = query.gte("paid_at", from);
    if (to) query = query.lte("paid_at", `${to}T23:59:59`);

    const { data: rows, error, count } = await query;
    if (error) throw error;

    let runningPaid = 0;
    const history = (rows ?? []).map((p: any) => {
      const amount = r2(Number(p.amount || 0));
      runningPaid = r2(runningPaid + amount);
      return {
        id: p.id,
        receipt_no: p.receipt_no ?? `IRR-${String(p.paid_at).slice(0, 10).replace(/-/g, "")}-${String(p.id).slice(-6).toUpperCase()}`,
        amount,
        paid_at: p.paid_at,
        method: p.method ?? null,
        farmer_id: p.farmer_id,
        paid_to_date: runningPaid,
      };
    });

    return json({
      history,
      pagination: { page, per_page: perPage, total: count ?? history.length, sort: sortDir ? "asc" : "desc" },
      filters: { office_id: officeId, farmer_id: farmerId, from, to },
    });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
