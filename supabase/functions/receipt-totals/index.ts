// Recomputes canonical receipt totals server-side from PERSISTED rows so
// PDF/Excel exports can never rely on a stale client snapshot. Totals are
// derived only from rows that were actually saved (i.e. lines that were
// included at save time), making "include flags" authoritative by construction.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const receiptNo = (url.searchParams.get("receipt_no") || "").trim();
    if (!receiptNo) {
      return new Response(JSON.stringify({ error: "receipt_no is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Payments rows (loan / savings / misc) that are live and not voided.
    const { data: pays, error: pErr } = await supabase
      .from("payments")
      .select("id,kind,amount,status,voided_at,reference_id")
      .eq("receipt_no", receiptNo)
      .is("deleted_at", null);
    if (pErr) throw pErr;

    // Savings transactions (deposit / share) recorded under the same receipt.
    const { data: stx, error: sErr } = await supabase
      .from("savings_transactions")
      .select("type,amount,status")
      .eq("receipt_no", receiptNo)
      .is("deleted_at", null);
    if (sErr) throw sErr;

    const live = (pays ?? []).filter((p: any) => !p.voided_at && p.status !== "voided");
    const lines: { kind: string; amount: number }[] = [];

    for (const s of stx ?? []) {
      if ((s as any).status !== "approved") continue;
      const amt = Number((s as any).amount || 0);
      if (amt <= 0) continue;
      const t = (s as any).type;
      if (t === "deposit") lines.push({ kind: "savings", amount: amt });
      else if (t === "share_collection" || t === "share_deposit") lines.push({ kind: "share", amount: amt });
    }
    for (const p of live) {
      const amt = Number((p as any).amount || 0);
      if (amt > 0 && (p as any).kind !== "savings") lines.push({ kind: (p as any).kind, amount: amt });
    }

    const total = lines.reduce((s, l) => s + l.amount, 0);

    return new Response(JSON.stringify({ receipt_no: receiptNo, lines, total }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
