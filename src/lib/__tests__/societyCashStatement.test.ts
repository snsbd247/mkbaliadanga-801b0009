import { describe, it, expect } from "vitest";
import {
  computeSocietyStatement,
  computeBankSummary,
  incomeDrillDownUrl,
  expenseDrillDownUrl,
  incomingDrillDownUrl,
} from "@/lib/societyCashStatement";

describe("society audit drill-down links", () => {
  const from = "2025-07-01";
  const to = "2026-06-30";

  it("income link scopes to savings stream for the selected range", () => {
    expect(incomeDrillDownUrl(from, to)).toBe(`/savings?stream=saving&from=${from}&to=${to}`);
  });

  it("expense link scopes to savings expenses for the selected range", () => {
    expect(expenseDrillDownUrl(from, to)).toBe(`/reports/expenses?stream=savings&from=${from}&to=${to}`);
  });

  it("incoming-funds link scopes to bank report for the selected range", () => {
    expect(incomingDrillDownUrl(from, to)).toBe(`/reports/bank?stream=saving&from=${from}&to=${to}`);
  });
});

describe("computeSocietyStatement (সমিতির জমা খরচ হিসাব)", () => {
  it("groups income/expense lines from backend rows and balances grand totals", () => {
    const r = computeSocietyStatement({
      savings: [
        { type: "share_collection", amount: 2000 },
        { type: "deposit", amount: 38410 },
        { type: "withdraw", amount: 900 },
      ],
      loanPayments: [{ amount: 15808.33 }],
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
    });
    expect(r.incomeLines.find((l) => l.label === "সঞ্চয় আদায়")?.amount).toBe(38410);
    expect(r.expenseLines.find((l) => l.label === "বেতন প্রদান")?.amount).toBe(42000);
    expect(r.expenseLines.find((l) => l.label === "ঋণ প্রদান")?.amount).toBe(120000);
    expect(r.grandIncome).toBe(r.grandExpense); // balanced statement
    expect(r.closingFund).toBe(r.grandIncome - r.totalExpense);
  });

  it("omits zero-amount lines", () => {
    const r = computeSocietyStatement({
      savings: [{ type: "deposit", amount: 100 }],
      loanPayments: [], bankTx: [], officeIncomes: [], expenses: [], loansIssued: [],
    });
    expect(r.incomeLines).toHaveLength(1);
    expect(r.expenseLines).toHaveLength(0);
  });

  it("computes per-account bank summary with closing balance", () => {
    const rows = computeBankSummary(
      [{ id: "a", account_no: "4123", account_title: "সমিতি", opening_balance: 33749 }],
      [
        { bank_account_id: "a", txn_type: "interest", amount: 7578 },
        { bank_account_id: "a", txn_type: "charge", amount: 1919 },
        { bank_account_id: "a", txn_type: "deposit", amount: 2102540 },
        { bank_account_id: "a", txn_type: "withdraw", amount: 632500 },
      ],
    );
    expect(rows[0].closing).toBe(33749 + 7578 - 1919 + 2102540 - 632500);
  });
});
