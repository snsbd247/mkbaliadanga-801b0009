import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";

export type CanonicalReceiptTotals = {
  receipt_no: string;
  lines: { kind: string; amount: number }[];
  total: number;
};

/**
 * Fetch server-recomputed receipt totals (derived from persisted rows, not a
 * client snapshot). Use this before generating a PDF/Excel export so totals can
 * never be stale. Returns null on failure — callers should fall back gracefully.
 */
export async function getCanonicalReceiptTotals(receiptNo: string): Promise<CanonicalReceiptTotals | null> {
  if (!receiptNo?.trim()) return null;
  try {
    const { data, error } = await db.functions.invoke("receipt-totals", {
      body: { receipt_no: receiptNo.trim() },
    });
    if (error) throw error;
    return data as CanonicalReceiptTotals;
  } catch {
    return null;
  }
}
