import { describe, it, expect } from "vitest";
import { computeHandCash, IRRIGATION_INCOME_KINDS } from "@/lib/handCash";

describe("computeHandCash — Dashboard vs Cash Book parity", () => {
  it("sums irrigation-kind receipts minus irrigation expenses", () => {
    const res = computeHandCash({
      receipts: [
        { kind: "irrigation", amount: 10000, receipt_no: "R1" },
        { kind: "bigha_rent", amount: 5000, receipt_no: "R2" },
        { kind: "savings_deposit", amount: 9999, receipt_no: "R3" }, // ignored
      ],
      expenses: [{ amount: 3000 }, { amount: 1000 }],
    });
    expect(res.receiptIncome).toBe(15000);
    expect(res.expense).toBe(4000);
    expect(res.closing).toBe(11000);
  });

  it("includes approved irrigation payments only when receipt_no is not already a receipt", () => {
    const res = computeHandCash({
      receipts: [{ kind: "irrigation", amount: 2000, receipt_no: "R1" }],
      payments: [
        { kind: "irrigation", status: "approved", amount: 500, receipt_no: "R1" }, // dup -> excluded
        { kind: "irrigation", status: "approved", amount: 5000, receipt_no: "P9" }, // new -> included
        { kind: "irrigation", status: "pending", amount: 700, receipt_no: "P10" }, // not approved
      ],
      expenses: [],
    });
    expect(res.paymentIncome).toBe(5000);
    expect(res.closing).toBe(7000);
  });

  it("respects opening balance for a period", () => {
    const res = computeHandCash({
      receipts: [{ kind: "irrigation", amount: 1000, receipt_no: "R1" }],
      expenses: [{ amount: 400 }],
      opening: 2500,
    });
    expect(res.closing).toBe(3100);
  });

  it("Dashboard and Cash Book produce equal closing for identical inputs + range", () => {
    // Simulated shared dataset for a date range.
    const receipts = [
      { kind: "irrigation", amount: 21716, receipt_no: "R1" },
    ];
    const payments = [
      { kind: "irrigation", status: "approved", amount: 5000, receipt_no: "P1" },
    ];
    const expenses = [{ amount: 68427 }];
    const opening = 0;

    // Dashboard path.
    const dashboard = computeHandCash({ receipts, payments, expenses, opening });

    // Cash Book path: it merges payment-fallback receipts into receipts first,
    // then sums receipts - expenses + opening.
    const receiptNos = new Set(receipts.map((r) => r.receipt_no));
    const merged = [
      ...receipts,
      ...payments
        .filter((p) => p.status === "approved" && p.receipt_no && !receiptNos.has(p.receipt_no))
        .map((p) => ({ kind: "irrigation", amount: p.amount, receipt_no: p.receipt_no })),
    ];
    const totalIncome = merged
      .filter((r) => IRRIGATION_INCOME_KINDS.has(r.kind))
      .reduce((s, r) => s + r.amount, 0);
    const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);
    const cashbookClosing = opening + totalIncome - totalExpense;

    expect(dashboard.closing).toBe(cashbookClosing);
    expect(dashboard.closing).toBe(-41711);
  });
});
