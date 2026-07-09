import { describe, expect, it } from "vitest";
import { buildIrrigationLedgerRows, buildIrrigationPostingLines } from "@/lib/irrigationPaymentPostings";

describe("irrigation payment postings", () => {
  it("folds missing split accounts into the canonical income account and stays balanced", () => {
    const lines = buildIrrigationPostingLines(
      { amount: 2614, isCurrent: true, delayFee: 100, maintenanceAmount: 50, canalAmount: 25 },
      { "1010": "cash", "4010": "income" },
    );
    expect(lines).toHaveLength(2);
    expect(lines.reduce((s, l) => s + l.debit, 0)).toBe(2614);
    expect(lines.reduce((s, l) => s + l.credit, 0)).toBe(2614);
    expect(lines[1].account_id).toBe("income");
  });

  it("creates ledger rows for the accounts module", () => {
    const lines = buildIrrigationPostingLines(
      { amount: 568, isCurrent: false },
      { "1010": "cash", "IRR-INCOME": "income", "IRR-PREV-DUE": "prev" },
    );
    const ledgerRows = buildIrrigationLedgerRows({
      paymentId: "payment-1",
      entryDate: "2026-07-09",
      officeId: "office-1",
      createdBy: "user-1",
      lines,
    });
    expect(ledgerRows).toHaveLength(2);
    expect(ledgerRows.every((row) => row.reference_type === "irrigation_payment")).toBe(true);
    expect(ledgerRows.reduce((s, row) => s + row.debit, 0)).toBe(568);
    expect(ledgerRows.reduce((s, row) => s + row.credit, 0)).toBe(568);
  });
});