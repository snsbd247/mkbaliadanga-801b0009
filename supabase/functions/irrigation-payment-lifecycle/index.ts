// ধাপ ৬ — Payment lifecycle API: submit / approve / edit / cancel.
// Role-based authorization, validation, bilingual errors and audit logging.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

type Action = "submit" | "approve" | "edit" | "cancel";
const r2 = (v: number) => Math.round(v * 100) / 100;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const err = (en: string, bn: string, status: number) => json({ error: { en, bn } }, status);

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "") as Action;
    const paymentId = String(body?.payment_id ?? "").trim();

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: userData } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (!user) return err("Unauthorized.", "অননুমোদিত।", 401);

    // Role lookup (approve/cancel require admin/super_admin).
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const roleSet = new Set((roles ?? []).map((r: any) => r.role));
    const isApprover = roleSet.has("admin") || roleSet.has("super_admin");

    const audit = async (act: string, before: unknown, after: unknown) => {
      await supabase.from("audit_logs").insert({
        action: `payment.${act}`,
        actor_id: user.id,
        entity_type: "payment",
        entity_id: paymentId || null,
        before_data: before as any,
        after_data: after as any,
      }).then(() => {}, () => {});
    };

    if (action === "submit") {
      const amount = r2(Number(body?.amount || 0));
      if (amount <= 0) return err("Amount must be greater than zero.", "পরিমাণ শূন্যের বেশি হতে হবে।", 400);
      const { data, error } = await supabase.from("payments").insert({
        farmer_id: body?.farmer_id, office_id: body?.office_id, kind: body?.kind ?? "irrigation",
        amount, method: body?.method ?? "cash", receipt_no: body?.receipt_no ?? null, status: "pending",
      }).select().single();
      if (error) throw error;
      await audit("submit", null, data);
      return json({ payment: data });
    }

    if (!paymentId) return err("payment_id is required.", "payment_id আবশ্যক।", 400);
    const { data: existing, error: fErr } = await supabase.from("payments").select("*").eq("id", paymentId).maybeSingle();
    if (fErr) throw fErr;
    if (!existing) return err("Payment not found.", "পেমেন্ট পাওয়া যায়নি।", 404);

    if (action === "approve") {
      if (!isApprover) return err("You are not allowed to approve payments.", "আপনি পেমেন্ট অনুমোদনের অনুমতিপ্রাপ্ত নন।", 403);
      if (existing.status === "approved") return err("Payment is already approved.", "পেমেন্ট ইতিমধ্যে অনুমোদিত।", 400);
      if (existing.status === "voided") return err("Cancelled payments cannot be approved.", "বাতিল পেমেন্ট অনুমোদন করা যায় না।", 400);
      const { data, error } = await supabase.from("payments").update({ status: "approved" }).eq("id", paymentId).select().single();
      if (error) throw error;
      await audit("approve", existing, data);
      return json({ payment: data });
    }

    if (action === "edit") {
      if (existing.status !== "pending") return err("Only pending payments can be edited.", "শুধু অপেক্ষমাণ পেমেন্ট সম্পাদনা করা যায়।", 400);
      const amount = r2(Number(body?.amount || 0));
      if (amount <= 0) return err("Amount must be greater than zero.", "পরিমাণ শূন্যের বেশি হতে হবে।", 400);
      const { data, error } = await supabase.from("payments").update({ amount }).eq("id", paymentId).select().single();
      if (error) throw error;
      await audit("edit", existing, data);
      return json({ payment: data });
    }

    if (action === "cancel") {
      if (!isApprover) return err("You are not allowed to cancel payments.", "আপনি পেমেন্ট বাতিলের অনুমতিপ্রাপ্ত নন।", 403);
      if (existing.status === "voided") return err("Payment is already cancelled.", "পেমেন্ট ইতিমধ্যে বাতিল।", 400);
      const reason = String(body?.reason ?? "").trim();
      if (!reason) return err("A cancellation reason is required.", "বাতিলের কারণ আবশ্যক।", 400);
      const { data, error } = await supabase.from("payments")
        .update({ status: "voided", voided_at: new Date().toISOString(), note: reason }).eq("id", paymentId).select().single();
      if (error) throw error;
      await audit("cancel", existing, data);
      return json({ payment: data });
    }

    return err("Unknown action.", "অজানা অ্যাকশন।", 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
