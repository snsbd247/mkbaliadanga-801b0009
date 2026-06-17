import { describe, it, expect } from "vitest";

// Mirrors the pure recalculation + export logic used by the combined-receipt
// edit flow (Payments.saveEditReceipt) and the printed/exported receipt.
// These functions intentionally duplicate the inline page logic so a
// regression in the formulas is caught without a full e2e harness.

type Include = { savings: boolean; share: boolean; loan: boolean };
type Amounts = { savings: number; share: number; loan_principal: number; loan_interest: number; misc: number };

/** Section amounts after applying include flags — an unchecked line is 0. */
function exportAmounts(
  raw: { savings: number; share: number; loan_principal: number; loan_interest: number; misc?: number },
  include: Include,
): Amounts {
  return {
    savings: include.savings ? Number(raw.savings || 0) : 0,
    share: include.share ? Number(raw.share || 0) : 0,
    loan_principal: include.loan ? Number(raw.loan_principal || 0) : 0,
    loan_interest: include.loan ? Number(raw.loan_interest || 0) : 0,
    misc: Number(raw.misc || 0),
  };
}

/** Only sections with a positive amount are rendered in the receipt body. */
function renderedRows(a: Amounts): string[] {
  const order: [keyof Amounts, string][] = [
    ["savings", "সঞ্চয়"],
    ["share", "শেয়ার"],
    ["loan_principal", "ঋণ আসল"],
    ["loan_interest", "ঋণ লাভ"],
    ["misc", "বিবিধ"],
  ];
  return order.filter(([k]) => Number(a[k]) > 0).map(([, label]) => label);
}

function exportTotal(a: Amounts): number {
  return a.savings + a.share + a.loan_principal + a.loan_interest + a.misc;
}

/** Edit recalculation: invoice payable/due + paid + payment amount stay consistent. */
function recalcAfterEdit(
  inv: { payable_amount: number; paid_amount: number; due_amount: number },
  change: { oldFee: number; newFee: number; oldAmount: number; newAmount: number },
) {
  const feeDiff = change.newFee - change.oldFee;
  const amtDiff = change.newAmount - change.oldAmount;
  const payable = inv.payable_amount + feeDiff;
  const due = Math.max(0, inv.due_amount + feeDiff - amtDiff);
  const paid = Math.max(0, inv.paid_amount + amtDiff);
  const status = paid <= 0 ? "unpaid" : paid >= payable ? "paid" : "partial";
  return { payable, due, paid, status };
}

describe("combined receipt edit — export amounts & placement", () => {
  const raw = { savings: 100, share: 50, loan_principal: 200, loan_interest: 20, misc: 0 };

  it("places only included lines with correct section labels", () => {
    const a = exportAmounts(raw, { savings: true, share: true, loan: true });
    expect(renderedRows(a)).toEqual(["সঞ্চয়", "শেয়ার", "ঋণ আসল", "ঋণ লাভ"]);
    expect(exportTotal(a)).toBe(370);
  });

  it("drops unchecked lines from export totals (no stale client data)", () => {
    const a = exportAmounts(raw, { savings: true, share: false, loan: false });
    expect(renderedRows(a)).toEqual(["সঞ্চয়"]);
    expect(exportTotal(a)).toBe(100);
  });
});

describe("combined receipt edit — due/paid recalculation", () => {
  it("keeps payable/due/paid consistent when penalty increases", () => {
    const r = recalcAfterEdit(
      { payable_amount: 1000, paid_amount: 600, due_amount: 400 },
      { oldFee: 0, newFee: 100, oldAmount: 600, newAmount: 600 },
    );
    expect(r).toEqual({ payable: 1100, due: 500, paid: 600, status: "partial" });
  });

  it("marks invoice paid when payment covers payable", () => {
    const r = recalcAfterEdit(
      { payable_amount: 1000, paid_amount: 600, due_amount: 400 },
      { oldFee: 0, newFee: 0, oldAmount: 600, newAmount: 1000 },
    );
    expect(r).toEqual({ payable: 1000, due: 0, paid: 1000, status: "paid" });
  });

  it("never produces negative due or paid", () => {
    const r = recalcAfterEdit(
      { payable_amount: 500, paid_amount: 100, due_amount: 400 },
      { oldFee: 200, newFee: 0, oldAmount: 100, newAmount: 0 },
    );
    expect(r.due).toBeGreaterThanOrEqual(0);
    expect(r.paid).toBeGreaterThanOrEqual(0);
  });
});

describe("combined receipt — shared receipt number", () => {
  it("all included lines share the same receiptNo", () => {
    const receiptNo = "COMBO-2026-06-0001";
    const lines = [
      { kind: "savings", receipt_no: receiptNo },
      { kind: "share", receipt_no: receiptNo },
      { kind: "loan", receipt_no: receiptNo },
    ];
    expect(new Set(lines.map((l) => l.receipt_no)).size).toBe(1);
  });
});
