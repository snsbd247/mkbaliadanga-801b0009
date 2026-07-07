/**
 * Verifies that an irrigation payment's persisted coverage (the
 * `irrigation_invoice_payments` rows) matches what the UI intended to pay:
 * the same set of invoice ids and the same summed total.
 *
 * Split into a pure comparator (`comparePaymentCoverage`) for unit testing and
 * a thin fetch wrapper (`verifyPaymentCoverage`) used by the panel after save.
 */
import { db } from "@/lib/db";

export const COVERAGE_TOLERANCE = 0.5;

export interface CoverageRow {
  invoice_id: string;
  collected_amount: number;
}

export interface CoverageCheck {
  ok: boolean;
  savedTotal: number;
  expectedTotal: number;
  missingInvoiceIds: string[];
  unexpectedInvoiceIds: string[];
  totalMismatch: boolean;
}

/** Pure comparison of saved coverage rows vs the expected invoice ids/total. */
export function comparePaymentCoverage(
  rows: CoverageRow[],
  expectedInvoiceIds: string[],
  expectedTotal: number,
): CoverageCheck {
  const savedIds = new Set(rows.map((r) => r.invoice_id));
  const expectedIds = new Set(expectedInvoiceIds);
  const savedTotal = +rows.reduce((s, r) => s + Number(r.collected_amount || 0), 0).toFixed(2);
  const missingInvoiceIds = [...expectedIds].filter((id) => !savedIds.has(id));
  const unexpectedInvoiceIds = [...savedIds].filter((id) => !expectedIds.has(id));
  const totalMismatch = Math.abs(savedTotal - Number(expectedTotal || 0)) > COVERAGE_TOLERANCE;
  return {
    ok: missingInvoiceIds.length === 0 && unexpectedInvoiceIds.length === 0 && !totalMismatch,
    savedTotal,
    expectedTotal: +Number(expectedTotal || 0).toFixed(2),
    missingInvoiceIds,
    unexpectedInvoiceIds,
    totalMismatch,
  };
}

/** Re-fetch the saved coverage for a payment and compare it to expectations. */
export async function verifyPaymentCoverage(
  paymentId: string,
  expectedInvoiceIds: string[],
  expectedTotal: number,
): Promise<CoverageCheck> {
  const { data, error } = await db
    .from("irrigation_invoice_payments")
    .select("invoice_id,collected_amount")
    .eq("payment_id", paymentId);
  if (error) {
    return {
      ok: false,
      savedTotal: 0,
      expectedTotal: +Number(expectedTotal || 0).toFixed(2),
      missingInvoiceIds: expectedInvoiceIds,
      unexpectedInvoiceIds: [],
      totalMismatch: true,
    };
  }
  return comparePaymentCoverage((data as CoverageRow[]) ?? [], expectedInvoiceIds, expectedTotal);
}
