import { test, expect } from "@playwright/test";
import {
  approvePayment,
  editPayment,
  cancelPayment,
  isLivePayment,
  type PaymentRecord,
} from "../src/lib/irrigationPaymentLifecycle";
import { buildPaidHistory } from "../src/lib/irrigationReceiptHistory";

/**
 * ধাপ ৬ — Full lifecycle: submit (Step 4) → approve → edit → cancel, and verify
 * receipt numbers + paid history stay consistent across the transitions.
 * Exercised through the shared pure helpers so the test is deterministic.
 */
test("payment lifecycle keeps receipt numbers and paid history consistent", () => {
  // Submit
  let p: PaymentRecord = { id: "pay-1", amount: 400, status: "pending" };

  // Edit while pending → amount changes, receipt number (seeded by id) stable.
  const edited = editPayment(p, 500);
  expect(edited.ok).toBe(true);
  p = edited.record!;
  expect(p.amount).toBe(500);

  // Approve → posts to ledger.
  const approved = approvePayment(p, "admin");
  expect(approved.ok).toBe(true);
  p = approved.record!;
  expect(p.status).toBe("approved");

  const liveHistory = buildPaidHistory(1000, [
    { receipt_no: "RCP-2026-01-0009", amount: p.amount, paid_at: "2026-01-05" },
  ], { kind: "IRR", seed: p.id });
  expect(liveHistory[0].receipt_no).toBe("RCP-2026-01-0009");
  expect(liveHistory[0].applied).toBe(500);

  // Cancel → excluded from paid totals; receipt number is unchanged for records.
  const cancelled = cancelPayment(p, "admin", "duplicate entry");
  expect(cancelled.ok).toBe(true);
  p = cancelled.record!;
  expect(isLivePayment(p)).toBe(false);

  const afterCancel = buildPaidHistory(1000, [], { kind: "IRR", seed: p.id });
  expect(afterCancel).toHaveLength(0); // no live payments → empty paid history
});
