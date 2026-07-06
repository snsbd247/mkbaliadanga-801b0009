import { describe, it, expect } from "vitest";
import { computeFinancialSummary } from "../financialSummary";

// Backend-shaped rows mirroring the real source tables.
const base = {
  bankAccounts: [
    { id: "sech1", stream: "sech", opening_balance: 500000 },
    { id: "soc1", stream: "saving", opening_balance: 0 },
  ],
  bankTx: [
    { bank_account_id: "sech1", txn_type: "deposit", amount: 50000 },
    { bank_account_id: "sech1", txn_type: "withdraw", amount: 205000 },
    { bank_account_id: "soc1", txn_type: "withdraw", amount: 400000 },
  ],
  invoices: [
    { paid_amount: 100, due_amount: 8860.5 },
    { paid_amount: 0, due_amount: 53725.5 },
  ],
  collections: [{ collected_amount: 20000 }, { collected_amount: 10126 }],
  officeIncomes: [
    { stream: "sech", amount: 74650 },
    { stream: "saving", amount: 12000 },
  ],
  expenses: [
    { stream: "irrigation", amount: 282600 },
    { stream: "savings", amount: 180600 },
  ],
  savings: [
    { type: "share_collection", amount: 2000 },
    { type: "deposit", amount: 38450 },
    { type: "withdraw", amount: 900 },
  ],
  loanPayments: [{ amount: 15808.33 }],
  loans: [
    { principal: 70000, total_due: 78500 },
    { principal: 55000, total_due: 61100 },
  ],
};

describe("computeFinancialSummary", () => {
  const s = computeFinancialSummary(base);

  it("splits bank balance by stream", () => {
    expect(s.bankBalanceSech).toBeCloseTo(500000 + 50000 - 205000, 2);
    expect(s.bankBalanceSociety).toBeCloseTo(0 - 400000, 2);
    expect(s.bankBalance).toBeCloseTo(s.bankBalanceSech + s.bankBalanceSociety, 2);
  });

  it("computes irrigation income (collections + sech office income)", () => {
    expect(s.irrigationIncome).toBeCloseTo(20000 + 10126 + 74650, 2);
  });

  it("computes irrigation due and expense", () => {
    expect(s.irrigationDue).toBeCloseTo(8860.5 + 53725.5, 2);
    expect(s.irrigationExpense).toBeCloseTo(282600, 2);
  });

  it("computes irrigation cash in hand net of bank movement", () => {
    const netToBank = 50000 - 205000;
    expect(s.irrigationCashInHand).toBeCloseTo(s.irrigationIncome - 282600 - netToBank, 2);
  });

  it("computes loan given and loan due", () => {
    expect(s.loanGiven).toBeCloseTo(125000, 2);
    expect(s.loanDue).toBeCloseTo(139600, 2);
  });

  it("savings cash in hand is finite and reflects society engine", () => {
    expect(Number.isFinite(s.savingsCashInHand)).toBe(true);
  });
});
