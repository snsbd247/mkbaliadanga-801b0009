/**
 * Soft duplicate-payment detector.
 *
 * Returns the most recent payment for the same farmer with the same amount
 * within the lookback window (default 2 minutes). Callers should prompt the
 * user to confirm before inserting a second, near-identical payment.
 *
 * This complements the DB-level idempotency_key unique constraint by catching
 * accidental re-clicks that use a NEW idempotency key (e.g. after a page
 * reload) but represent the same intended payment.
 */
import { supabase } from "@/integrations/supabase/client";

export interface RecentDuplicate {
  id: string;
  receipt_no: string | null;
  amount: number;
  created_at: string;
  status: string | null;
}

export async function findRecentDuplicatePayment(opts: {
  farmer_id: string;
  amount: number;
  withinSeconds?: number;
}): Promise<RecentDuplicate | null> {
  const win = opts.withinSeconds ?? 120;
  if (!opts.farmer_id || !(opts.amount > 0)) return null;
  const since = new Date(Date.now() - win * 1000).toISOString();
  const { data } = await supabase
    .from("payments")
    .select("id,receipt_no,amount,created_at,status")
    .eq("farmer_id", opts.farmer_id)
    .eq("amount", opts.amount)
    .gte("created_at", since)
    .is("deleted_at", null)
    .neq("status", "voided" as any)
    .order("created_at", { ascending: false })
    .limit(1);
  const row = (data ?? [])[0];
  return row
    ? { id: row.id, receipt_no: row.receipt_no, amount: Number(row.amount), created_at: row.created_at, status: row.status }
    : null;
}
