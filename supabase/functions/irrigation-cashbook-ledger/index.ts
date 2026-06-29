// ধাপ ৭ — Cash book ledger + period summary API.
// Returns running-balance cash book rows and a period report for the same
// date/office filters the dashboard uses. Reconciles against live Step 5
// receipts (irrigation_invoice_payments) and excludes Step 6 cancelled
// (voided) payments. Enforces office-level authorization.
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
    const from = pick("from");
    const to = pick("to");
    const opening = Number(pick("opening") || "0") || 0;

    const errors: { field: string; en: string; bn: string }[] = [];
    if (!officeId) errors.push({ field: "office_id", en: "Office is required.", bn: "অফিস নির্বাচন আবশ্যক।" });
    if (from && !isDate(from)) errors.push({ field: "from", en: "Start date must be valid (YYYY-MM-DD).", bn: "শুরুর তারিখ সঠিক হতে হবে।" });
    if (to && !isDate(to)) errors.push({ field: "to", en: "End date must be valid (YYYY-MM-DD).", bn: "শেষের তারিখ সঠিক হতে হবে।" });
    if (errors.length) return json({ errors }, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: userData } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { data: profile } = await supabase.from("profiles").select("office_id").eq("id", user.id).maybeSingle();
    const userOffice = (profile as any)?.office_id ?? null;
    if (userOffice && userOffice !== officeId) {
      return json({ error: { en: "You can only view the cash book for your assigned office.", bn: "আপনি কেবল আপনার নির্ধারিত অফিসের ক্যাশ বুক দেখতে পারবেন।" } }, 403);
    }

    // জমা (cash in): live irrigation receipts.
    let pq = supabase
      .from("irrigation_invoice_payments")
      .select("collected_amount,created_at,payments(receipt_no,method)")
      .eq("office_id", officeId)
      .gt("collected_amount", 0);
    if (from) pq = pq.gte("created_at", from);
    if (to) pq = pq.lte("created_at", `${to}T23:59:59`);
    const { data: pays, error: pErr } = await pq;
    if (pErr) throw pErr;

    // খরচ (cash out): irrigation expenses.
    let eq = supabase
      .from("expenses")
      .select("amount,expense_date,head,note")
      .eq("office_id", officeId)
      .is("deleted_at", null);
    if (from) eq = eq.gte("expense_date", from);
    if (to) eq = eq.lte("expense_date", to);
    const { data: exps } = await eq;

    type Row = { date: string; direction: "in" | "out"; amount: number; head: string | null; ref: string | null; i: number };
    const entries: Row[] = [];
    let i = 0;
    for (const p of pays ?? []) entries.push({ date: String((p as any).created_at).slice(0, 10), direction: "in", amount: Number((p as any).collected_amount || 0), head: (p as any).payments?.method ?? "সেচ আদায়", ref: (p as any).payments?.receipt_no ?? null, i: i++ });
    for (const e of exps ?? []) entries.push({ date: String((e as any).expense_date).slice(0, 10), direction: "out", amount: Number((e as any).amount || 0), head: (e as any).head ?? "খরচ", ref: (e as any).note ?? null, i: i++ });

    entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.i - b.i));
    let balance = opening, total_in = 0, total_out = 0;
    const rows = entries.map((e) => {
      const amt = Math.max(e.amount, 0);
      const debit = e.direction === "in" ? amt : 0;
      const credit = e.direction === "out" ? amt : 0;
      total_in += debit; total_out += credit;
      balance = r2(balance + debit - credit);
      return { date: e.date, head: e.head, ref: e.ref, debit: r2(debit), credit: r2(credit), balance };
    });

    const net = r2(total_in - total_out);
    return json({
      rows,
      report: { opening: r2(opening), total_in: r2(total_in), total_out: r2(total_out), net, closing: r2(opening + net), count: rows.length },
      filters: { office_id: officeId, from, to },
    });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
