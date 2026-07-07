import { db } from "@/lib/db";
import { autoReceiptNo } from "@/lib/receiptNo";

/**
 * Background backfill: assign a deterministic receipt_no to legacy payment rows
 * that were created before receipt numbers were persisted. Uses autoReceiptNo
 * (derived from the payment id) so it never consumes the office serial sequence.
 *
 * Safe to call fire-and-forget on page mount; runs at most once per session.
 */
let ran = false;

export async function backfillMissingReceiptNos(officeId?: string | null): Promise<number> {
  if (ran) return 0;
  ran = true;
  try {
    let query = db
      .from("payments")
      .select("id, occurred_at, created_at")
      .is("receipt_no", null)
      .limit(500);
    if (officeId) query = query.eq("office_id", officeId);
    const { data, error } = await query;
    if (error || !data?.length) return 0;

    let updated = 0;
    for (const row of data as Array<{ id: string; occurred_at?: string | null; created_at?: string | null }>) {
      const when = row.occurred_at || row.created_at;
      const receiptNo = autoReceiptNo("PAY", row.id, when ? new Date(when) : new Date());
      const { error: upErr } = await db
        .from("payments")
        .update({ receipt_no: receiptNo })
        .eq("id", row.id)
        .is("receipt_no", null);
      if (!upErr) updated++;
    }
    return updated;
  } catch {
    return 0;
  }
}
