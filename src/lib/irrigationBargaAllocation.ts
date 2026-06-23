/**
 * Unified payment allocation that applies a payment to Barga (sharecropper)
 * dues FIRST, producing clear allocation rows, then leaves any remainder for
 * the caller to apply to other charges. Balances always reconcile:
 *   sum(allocations.applied) + leftover === payment amount.
 */
import type { BargaDueRow } from "./irrigationBargaDue";

const num = (v: unknown): number => {
  const x = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(x) && x > 0 ? x : 0;
};
const r2 = (v: number) => Math.round(v * 100) / 100;

export interface BargaAllocationRow {
  billed_farmer_id: string;
  land_id?: string;
  due_before: number;
  applied: number;
  due_after: number;
}

export interface BargaAllocationResult {
  allocations: BargaAllocationRow[];
  leftover: number;
}

export function allocatePaymentToBarga(
  amount: number,
  dues: Array<BargaDueRow & { land_id?: string }>,
): BargaAllocationResult {
  let remaining = num(amount);
  const allocations: BargaAllocationRow[] = [];
  for (const d of dues) {
    const due = num(d.due_amount);
    if (due <= 0) continue;
    const applied = r2(Math.min(remaining, due));
    if (applied <= 0) break;
    remaining = r2(remaining - applied);
    allocations.push({
      billed_farmer_id: d.billed_farmer_id,
      land_id: d.land_id,
      due_before: due,
      applied,
      due_after: r2(due - applied),
    });
  }
  return { allocations, leftover: r2(remaining) };
}
