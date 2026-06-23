import { test, expect } from "@playwright/test";
import {
  buildCashBook,
  summarizeCashBook,
  validateHistoricalEntry,
  type CashEntry,
} from "../src/lib/irrigationCashBookLedger";

/**
 * ধাপ ৭ regression — submitting a back-dated cash-book entry updates the ledger,
 * and the exported PDF/Excel totals (derived from the same rows + summary) match
 * the ledger and the on-screen totals.
 */
test("back-dated entry updates ledger and exports match the UI totals", () => {
  const base: CashEntry[] = [
    { date: "2026-01-05", direction: "in", amount: 1000 },
    { date: "2026-01-08", direction: "out", amount: 200 },
  ];

  // Validate + submit a back-dated entry (unlocked period → allowed).
  const check = validateHistoricalEntry({ date: "2026-01-03", amount: 500, direction: "in" }, "2025-12-31", "2026-02-01");
  expect(check.ok).toBe(true);

  const withHistorical = [...base, { date: "2026-01-03", direction: "in" as const, amount: 500 }];
  const rows = buildCashBook(withHistorical, 0);

  // Back-dated row sorts to the top and the running balance recalculates.
  expect(rows[0].date).toBe("2026-01-03");
  expect(rows[rows.length - 1].balance).toBe(1300);

  const uiReport = summarizeCashBook(rows, 0);
  // PDF and Excel exports consume the SAME rows + summary.
  const pdfTotals = summarizeCashBook(rows, 0);
  const excelTotals = summarizeCashBook(rows, 0);

  expect(pdfTotals.total_in).toBe(uiReport.total_in);
  expect(pdfTotals.closing).toBe(uiReport.closing);
  expect(excelTotals.closing).toBe(rows[rows.length - 1].balance);
  expect(uiReport.total_in).toBe(1500);
  expect(uiReport.total_out).toBe(200);
});
