import { describe, it, expect } from "vitest";
import {
  computeSocietyStatement,
  computeBankSummary,
  incomeDrillDownUrl,
  expenseDrillDownUrl,
  incomingDrillDownUrl,
} from "@/lib/societyCashStatement";

// Backend-shaped rows mirroring savings_transactions / loan_payments /
// bank_transactions / office_incomes / expenses / loans for one office + range.
const FROM = "2025-07-01";
const TO = "2026-06-30";

const backend = {
  savings: [
    { type: "share_collection", amount: 2000 },
    { type: "deposit", amount: 38410 },
    { type: "deposit", amount: 1590 },
    { type: "withdraw", amount: 900 },
  ],
  loanPayments: [{ amount: 15808.33 }, { amount: 4191.67 }],
  bankTx: [
    { txn_type: "deposit", amount: 360000 },
    { txn_type: "withdraw", amount: 120600 },
    { txn_type: "interest", amount: 2400 },
  ],
  officeIncomes: [{ income_type: "other", amount: 500 }],
  expenses: [
    { head: "Salary", amount: 42000 },
    { head: "Office Rent", amount: 6000 },
  ],
  loansIssued: [{ principal: 120000 }],
  opening: 766,
};

describe("society audit totals match recomputation from backend records", () => {
  it("income/expense totals equal an independent sum of source rows", () => {
    const r = computeSocietyStatement(backend);

    const expectedIncome =
      2000 + (38410 + 1590) + (15808.33 + 4191.67) + 120600 + 2400 + 500;
    const expectedExpense = 360000 + 2400 + 900 + 120000 + 42000 + 6000;

    expect(r.totalIncome).toBeCloseTo(expectedIncome, 2);
    expect(r.totalExpense).toBeCloseTo(expectedExpense, 2);
    expect(r.grandIncome).toBeCloseTo(r.totalIncome + backend.opening, 2);
    expect(r.closingFund).toBeCloseTo(r.grandIncome - r.totalExpense, 2);
    expect(r.grandIncome).toBeCloseTo(r.grandExpense, 2); // balanced
  });

  it("bank summary closing reconciles per account", () => {
    const rows = computeBankSummary(
      [{ id: "x", account_no: "4123", account_title: "সমিতি", opening_balance: 33749 }],
      [
        { bank_account_id: "x", txn_type: "interest", amount: 7578 },
        { bank_account_id: "x", txn_type: "charge", amount: 1919 },
        { bank_account_id: "x", txn_type: "deposit", amount: 2102540 },
        { bank_account_id: "x", txn_type: "withdraw", amount: 632500 },
      ],
    );
    expect(rows[0].closing).toBeCloseTo(33749 + 7578 - 1919 + 2102540 - 632500, 2);
  });

  it("drill-down URLs carry the same date range used to compute totals", () => {
    expect(incomeDrillDownUrl(FROM, TO)).toContain(`from=${FROM}`);
    expect(incomeDrillDownUrl(FROM, TO)).toContain(`to=${TO}`);
    expect(expenseDrillDownUrl(FROM, TO)).toContain(`from=${FROM}`);
    expect(incomingDrillDownUrl(FROM, TO)).toContain(`to=${TO}`);
    // streams are correctly scoped per source
    expect(incomeDrillDownUrl(FROM, TO)).toContain("stream=saving");
    expect(expenseDrillDownUrl(FROM, TO)).toContain("stream=savings");
    expect(incomingDrillDownUrl(FROM, TO)).toContain("/reports/bank");
  });
});
