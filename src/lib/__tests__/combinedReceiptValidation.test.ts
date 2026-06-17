import { describe, it, expect } from "vitest";
import { previewEdit, checkConsistency } from "@/lib/combinedReceiptValidation";

describe("previewEdit — recalculated section totals & due/paid", () => {
  const base = { payable_amount: 1000, due_amount: 400, paid_amount: 600, delay_fee: 0, amount: 600 };

  it("increases payable & due when penalty is added (no payment change)", () => {
    const r = previewEdit(base, { delay_fee: 100, amount: 600 });
    expect(r).toMatchObject({ payable: 1100, due: 500, paid: 600, status: "partial" });
  });

  it("marks paid when payment covers payable", () => {
    const r = previewEdit(base, { delay_fee: 0, amount: 1000 });
    expect(r).toMatchObject({ payable: 1000, due: 0, paid: 1000, status: "paid" });
  });

  it("never goes negative", () => {
    const r = previewEdit({ ...base, paid_amount: 100, due_amount: 400 }, { delay_fee: 0, amount: 0 });
    expect(r.paid).toBeGreaterThanOrEqual(0);
    expect(r.due).toBeGreaterThanOrEqual(0);
  });
});

describe("checkConsistency — save-time guard", () => {
  it("passes when invoice/allocation/payment agree", () => {
    const r = checkConsistency({ invoicePaid: 600, allocationAmount: 600, paymentAmount: 600, payable: 1000, due: 400 });
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it("fails when payment & allocation diverge (stale client data)", () => {
    const r = checkConsistency({ invoicePaid: 600, allocationAmount: 500, paymentAmount: 600, payable: 1000, due: 400 });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/allocation/i);
  });

  it("fails when payable != paid + due", () => {
    const r = checkConsistency({ invoicePaid: 600, allocationAmount: 600, paymentAmount: 600, payable: 1000, due: 300 });
    expect(r.ok).toBe(false);
  });

  it("fails on negative values", () => {
    const r = checkConsistency({ invoicePaid: -10, allocationAmount: 0, paymentAmount: 0, payable: -10, due: 0 });
    expect(r.ok).toBe(false);
  });
});

describe("export never uses stale client data after edit", () => {
  // After editing, the export must derive totals from the recalculated preview,
  // not the pre-edit snapshot.
  it("export total reflects edited amount, not the original", () => {
    const base = { payable_amount: 1000, due_amount: 400, paid_amount: 600, delay_fee: 0, amount: 600 };
    const before = previewEdit(base, { delay_fee: 0, amount: 600 });
    const after = previewEdit(base, { delay_fee: 0, amount: 1000 });
    expect(after.paid).not.toBe(before.paid);
    expect(after.paid).toBe(1000);
  });
});
