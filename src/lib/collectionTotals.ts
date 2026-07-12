/**
 * Collection totals — single source of truth shared by the Dashboard cards and
 * the Collection Report so "today's collection" and the report never diverge.
 *
 * Mirrors src/pages/reports/CollectionReport.tsx exactly:
 *   - irrigation : irrigation_invoice_payments.collected_amount (collected > 0)
 *   - loan       : loan_payments.amount
 *   - savings    : savings_transactions deposits (approved)
 * Voided receipts contribute 0 (never counted).
 */
import { db } from "@/lib/db";

const num = (v: unknown) => Number(v ?? 0) || 0;

export interface CollectionTotal {
  total: number;
  irrigation: number;
  loan: number;
  savings: number;
}

const SAVINGS_DEPOSIT_TYPES = [
  "deposit",
  "deposit_collection",
  "share_deposit",
  "share_collection",
  "profit",
];

/** Sum collections between [from, to] (inclusive, YYYY-MM-DD) across all streams. */
export async function getCollectionTotal(from: string, to: string): Promise<CollectionTotal> {
  const [irr, lp, sv] = await Promise.all([
    db
      .from("irrigation_invoice_payments")
      .select("collected_amount,created_at")
      .gt("collected_amount", 0)
      .gte("created_at", from)
      .lte("created_at", to + "T23:59:59"),
    db
      .from("loan_payments")
      .select("amount,paid_on")
      .gte("paid_on", from)
      .lte("paid_on", to),
    db
      .from("savings_transactions")
      .select("amount,txn_date,type,status")
      .is("deleted_at", null)
      .in("type", SAVINGS_DEPOSIT_TYPES)
      .eq("status", "approved")
      .gte("txn_date", from)
      .lte("txn_date", to),
  ]);

  const irrigation = (irr.data ?? []).reduce((s, r: any) => s + num(r.collected_amount), 0);
  const loan = (lp.data ?? []).reduce((s, r: any) => s + num(r.amount), 0);
  const savings = (sv.data ?? []).reduce((s, r: any) => s + num(r.amount), 0);
  return { total: irrigation + loan + savings, irrigation, loan, savings };
}
