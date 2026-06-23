import { test, expect } from "@playwright/test";
import { computeBargaDue } from "../src/lib/irrigationBargaDue";
import { allocatePaymentToBarga } from "../src/lib/irrigationBargaAllocation";
import { validateBargaSplit, bargaErrorMessages } from "../src/lib/irrigationBargaValidation";

/**
 * Unified Barga payment flow (logic-level E2E).
 *
 * Proves a payment is applied to Barga dues FIRST, produces clear allocation
 * rows, never over-applies, and that all balances reconcile:
 *   sum(applied) + leftover === payment amount
 * The same `computeBargaDue` / `allocatePaymentToBarga` logic backs the UI and
 * reports, so what the user pays on screen matches what is recorded.
 */

const settings = { delay_fee_enabled: false } as any;

test("payment applies to Barga due first and balances reconcile", () => {
  const dues = computeBargaDue({
    owner_farmer_id: "OWNER",
    parcel_area: 100,
    rate_per_shotok: 10,
    settings,
    due_date: "2026-06-30",
    relations: [{ sharecropper_farmer_id: "SC1", area_decimal: 40 }],
  });

  const totalDue = dues.reduce((s, d) => s + d.due_amount, 0);
  expect(totalDue).toBeGreaterThan(0);

  const payment = Math.round(totalDue * 0.6 * 100) / 100;
  const { allocations, leftover } = allocatePaymentToBarga(payment, dues);

  const applied = allocations.reduce((s, a) => s + a.applied, 0);
  // Reconciliation: every taka is accounted for.
  expect(Math.round((applied + leftover) * 100) / 100).toBe(payment);
  // Never over-applies a single row.
  for (const a of allocations) {
    expect(a.applied).toBeLessThanOrEqual(a.due_before + 1e-9);
    expect(a.due_after).toBe(Math.round((a.due_before - a.applied) * 100) / 100);
  }
});

test("overpayment leaves clear leftover, never negative dues", () => {
  const dues = computeBargaDue({
    owner_farmer_id: "OWNER",
    parcel_area: 50,
    rate_per_shotok: 10,
    settings,
    due_date: "2026-06-30",
    relations: [{ sharecropper_farmer_id: "SC1", share_percentage: 50 }],
  });
  const totalDue = dues.reduce((s, d) => s + d.due_amount, 0);
  const { allocations, leftover } = allocatePaymentToBarga(totalDue + 500, dues);
  for (const a of allocations) expect(a.due_after).toBeGreaterThanOrEqual(0);
  expect(leftover).toBeCloseTo(500, 2);
});

test("invalid split surfaces bilingual reconciliation errors", () => {
  const errors = validateBargaSplit({
    parcel_area: 100,
    relations: [{ sharecropper_farmer_id: "SC1", area_decimal: 120 }],
  });
  expect(errors.length).toBeGreaterThan(0);
  expect(bargaErrorMessages(errors, "bn")[0]).toContain("জমির পরিমাণ");
  expect(bargaErrorMessages(errors, "en")[0].toLowerCase()).toContain("parcel area");
});
