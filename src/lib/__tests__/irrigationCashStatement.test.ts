import { describe, it, expect } from "vitest";
import { computeStatement } from "@/lib/irrigationCashStatement";

describe("computeStatement (সেচ জমা খরচ হিসাব)", () => {
  it("totals income from farmer payments + office incomes and groups by label", () => {
    const income = [
      { kind: "irrigation", amount: 1000 },
      { kind: "irrigation", amount: 500 },
      { kind: "scrap", amount: 200 },
      { income_type: "grant", stream: "sech", amount: 300 },
    ];
    const r = computeStatement(income, [], 0);
    expect(r.totalIncome).toBe(2000);
    const irr = r.incomeLines.find((l) => l.label === "সেচ চার্জ আদায় (বকেয়া সহ)");
    expect(irr?.amount).toBe(1500);
    expect(r.incomeLines.find((l) => l.label === "অনুদান")?.amount).toBe(300);
  });

  it("ignores non-irrigation expenses and payments outside irrigation kinds", () => {
    const r = computeStatement(
      [{ kind: "loan", amount: 999 }],
      [{ stream: "savings", head: "Office Rent", amount: 60000 }],
      0,
    );
    expect(r.totalIncome).toBe(0);
    expect(r.totalExpense).toBe(0);
  });

  it("computes fund chain: grandIncome, closingFund, grandExpense", () => {
    const r = computeStatement(
      [{ kind: "irrigation", amount: 10000 }],
      [{ stream: "irrigation", head: "Diesel", amount: 4000 }],
      2000,
    );
    expect(r.totalIncome).toBe(10000);
    expect(r.totalExpense).toBe(4000);
    expect(r.openingFund).toBe(2000);
    expect(r.grandIncome).toBe(12000);   // income + opening
    expect(r.closingFund).toBe(8000);    // grandIncome - expense
    expect(r.grandExpense).toBe(12000);  // expense + closing
    // balanced two-column statement
    expect(r.grandIncome).toBe(r.grandExpense);
  });

  it("coerces string amounts from backend numeric columns", () => {
    const r = computeStatement([{ kind: "irrigation", amount: "1500.50" as any }], [], 0);
    expect(r.totalIncome).toBeCloseTo(1500.5);
  });
});
