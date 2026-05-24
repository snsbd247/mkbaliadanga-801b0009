/**
 * Today's payment method-wise collection summary.
 * Reads from `payments` (approved + not voided) for the calling user's office.
 */
import { supabase } from "@/integrations/supabase/client";

export interface MethodSummary {
  method: string;
  count: number;
  total: number;
}

export async function getTodayMethodSummary(opts?: { officeId?: string | null }): Promise<MethodSummary[]> {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  let q = supabase
    .from("payments")
    .select("method,amount,status,office_id,created_at")
    .gte("created_at", start.toISOString())
    .eq("status", "approved")
    .is("deleted_at", null);
  if (opts?.officeId) q = q.eq("office_id", opts.officeId);
  const { data } = await q;
  const map = new Map<string, MethodSummary>();
  for (const r of data ?? []) {
    const m = String((r as any).method || "cash").toLowerCase();
    const row = map.get(m) ?? { method: m, count: 0, total: 0 };
    row.count += 1;
    row.total += Number((r as any).amount) || 0;
    map.set(m, row);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}
