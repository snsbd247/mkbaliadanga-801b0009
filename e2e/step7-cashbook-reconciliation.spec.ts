import { test, expect } from "@playwright/test";
import {
  buildCashBook,
  summarizeCashBook,
  validateHistoricalEntry,
} from "../src/lib/irrigationCashBookLedger";
import { isLivePayment, type PaymentRecord } from "../src/lib/irrigationPaymentLifecycle";

/**
 * ধাপ ৭ — Cash book reconciles against Step 6 payment states: cancelled
 * (voided) payments are excluded, the running balance never goes stale, and
 * the period report matches the last running balance. Historical entries that
 * fall inside a closed period are rejected.
 */
test("cash book reconciles with Step 6 lifecycle and validates historical entries", () => {
  const payments: PaymentRecord[] = [
    { id: "a", amount: 1000, status: "approved" },
    { id: "b", amount: 500, status: "approved" },
    { id: "c", amount: 300, status: "cancelled" }, // must be excluded
  ];

  const entries = payments
    .filter(isLivePayment)
    .map((p, idx) => ({ date: `2026-01-0${idx + 1}`, direction: "in" as const, amount: p.amount }));
  entries.push({ date: "2026-01-05", direction: "out", amount: 200 });

  const rows = buildCashBook(entries, 0);
  const report = summarizeCashBook(rows, 0);

  // Cancelled payment (300) excluded → in = 1500, out = 200, closing = 1300.
  expect(report.total_in).toBe(1500);
  expect(report.total_out).toBe(200);
  expect(report.closing).toBe(1300);
  expect(report.closing).toBe(rows[rows.length - 1].balance);

  // Historical entry inside a closed period is rejected (bilingual).
  const blocked = validateHistoricalEntry({ date: "2025-12-10", amount: 100, direction: "in" }, "2025-12-31", "2026-02-01");
  expect(blocked.ok).toBe(false);
  expect(blocked.error!.bn).toContain("বন্ধ");
});
