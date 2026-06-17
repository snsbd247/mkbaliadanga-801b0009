import { describe, it, expect } from "vitest";
import { computeStatement } from "../irrigationCashStatement";
import { computeSocietyStatement } from "../societyCashStatement";
import { flagCashMismatches, CASH_REPORT_TABLES, CASH_REQUIRED_TABLES, type CashCountRow } from "../cashReportBackup";

// E2E-style regression: feed demo-shaped rows (the kind seedCashReports produces)
// into the report engines and assert the rendered totals are internally consistent
// for BOTH irrigation (সেচ) and society (সমিতি).

describe("cash reports — irrigation statement totals", () => {
  const income = [
    { kind: "irrigation", amount: 1000 },
    { kind: "irrigation", amount: 500 },
    { income_type: "pond_lease", stream: "sech", amount: 300 },
    { income_type: "misc", stream: "sech", amount: 200 },
  ];
  const expenses = [
    { stream: "irrigation", head: "শ্রমিক মজুরি", amount: 400 },
    { stream: "irrigation", head: "বিদ্যুৎ বিল", amount: 250 },
    { stream: "savings", head: "should be ignored", amount: 9999 }, // wrong stream
  ];
  const stmt = computeStatement(income, expenses, 1000, "bn");

  it("sums only irrigation income", () => {
    expect(stmt.totalIncome).toBe(2000);
  });
  it("sums only irrigation-stream expenses (ignores other streams)", () => {
    expect(stmt.totalExpense).toBe(650);
  });
  it("computes opening/closing fund balance correctly", () => {
    expect(stmt.openingFund).toBe(1000);
    expect(stmt.grandIncome).toBe(3000);          // income + opening
    expect(stmt.closingFund).toBe(3000 - 650);    // grandIncome - expense
    expect(stmt.grandExpense).toBe(stmt.totalExpense + stmt.closingFund);
  });
  it("balances: grandIncome equals grandExpense (double-entry)", () => {
    expect(stmt.grandIncome).toBe(stmt.grandExpense);
  });
});

describe("cash reports — society statement totals", () => {
  const stmt = computeSocietyStatement({
    savings: [
      { type: "share_collection", amount: 500 },
      { type: "deposit", amount: 1200 },
      { type: "withdraw", amount: 300 },
    ],
    loanPayments: [{ amount: 800 }],
    bankTx: [
      { txn_type: "deposit", amount: 600 },
      { txn_type: "withdraw", amount: 200 },
      { txn_type: "interest", amount: 50 },
    ],
    officeIncomes: [{ income_type: "misc", amount: 100 }],
    expenses: [
      { head: "বেতন প্রদান", amount: 400 },
      { head: "স্টেশনারি", amount: 150 },
    ],
    loansIssued: [{ principal: 1000 }],
    opening: 500,
  }, "bn");

  it("aggregates society income lines", () => {
    expect(stmt.totalIncome).toBe(500 + 1200 + 800 + 200 + 50 + 100);
  });
  it("aggregates society expense lines incl. loan disbursement & salary split", () => {
    expect(stmt.totalExpense).toBe(600 + 300 + 1000 + 400 + 150);
  });
  it("balances: grandIncome equals grandExpense", () => {
    expect(stmt.grandIncome).toBe(stmt.grandExpense);
    expect(stmt.closingFund).toBe(stmt.grandIncome - stmt.totalExpense);
  });
});

describe("cash reports — post-seed validation flags", () => {
  const ok: CashCountRow[] = CASH_REPORT_TABLES.map((table) => ({
    table, count: 5, required: CASH_REQUIRED_TABLES.includes(table), ok: true,
  }));
  it("reports no mismatch when required tables have rows", () => {
    expect(flagCashMismatches(ok)).toHaveLength(0);
  });
  it("flags a required table that is empty", () => {
    const bad = ok.map((r) => (r.table === "receipts" ? { ...r, count: 0, ok: false } : r));
    const flagged = flagCashMismatches(bad);
    expect(flagged).toHaveLength(1);
    expect(flagged[0].table).toBe("receipts");
  });
  it("does not flag optional empty tables", () => {
    const optionalEmpty = ok.map((r) => (r.table === "hand_cash_submissions" ? { ...r, count: 0, ok: true } : r));
    expect(flagCashMismatches(optionalEmpty)).toHaveLength(0);
  });
});
