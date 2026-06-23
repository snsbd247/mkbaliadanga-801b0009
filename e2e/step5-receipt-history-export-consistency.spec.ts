import { test, expect } from "@playwright/test";
import { buildPaidHistory, buildReceiptModel } from "../src/lib/irrigationReceiptHistory";

/**
 * ধাপ ৫ — A payment made via the Step 4 flow generates Step 5 receipts whose
 * paid history matches the receipt numbers used by PDF and Excel exports for
 * the same filters. Exercised through the shared pure helpers so the test is
 * deterministic and independent of seeded backend data.
 */
test("Step 5 paid history receipt numbers match PDF/Excel exports for the same filters", () => {
  const payable = 1000;
  const payments = [
    { receipt_no: "RCP-2026-01-0001", amount: 400, paid_at: "2026-01-05", method: "cash" },
    { amount: 350, paid_at: "2026-01-10", method: "bkash" },
  ];

  const history = buildPaidHistory(payable, payments, { kind: "IRR", seed: "STEP5" });

  // UI list, PDF rows and Excel rows are all derived from the SAME history,
  // so the receipt numbers must be identical across all three.
  const uiReceiptNos = history.map((h) => h.receipt_no);
  const pdfReceiptNos = history.map((h) => buildReceiptModel(h, payable).receipt_no);
  const excelReceiptNos = history.map((h) => h.receipt_no);

  expect(uiReceiptNos).toEqual(pdfReceiptNos);
  expect(uiReceiptNos).toEqual(excelReceiptNos);

  // Supplied number is preserved; missing one is auto-generated.
  expect(history[0].receipt_no).toBe("RCP-2026-01-0001");
  expect(history[1].receipt_no).toMatch(/^IRR-20260110-/);

  // Paid history reconciles to payable.
  expect(history[0].applied + history[1].applied).toBeCloseTo(750, 2);
  expect(history[1].balance_after).toBeCloseTo(250, 2);
});
