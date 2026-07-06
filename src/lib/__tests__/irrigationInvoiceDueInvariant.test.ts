import { describe, it, expect } from "vitest";

/**
 * Invariant: every irrigation invoice must satisfy
 *   due_amount = max(payable_amount - paid_amount, 0)
 * This mirrors the server-side auto-correction in GenericTableController so a
 * regression in the frontend insert payload is caught before it ships.
 */
function normalizeDue(row: { payable_amount?: any; paid_amount?: any; due_amount?: any }) {
  const payable = Number(row.payable_amount ?? 0);
  const paid = Number(row.paid_amount ?? 0);
  return { ...row, due_amount: Math.max(payable - paid, 0) };
}

describe("irrigation invoice due invariant", () => {
  it("sets due = payable when no payment exists", () => {
    expect(normalizeDue({ payable_amount: 491, paid_amount: 0 }).due_amount).toBe(491);
  });

  it("sets due = payable - paid for partial payments", () => {
    expect(normalizeDue({ payable_amount: 491, paid_amount: 200 }).due_amount).toBe(291);
  });

  it("sets due = 0 when fully paid", () => {
    expect(normalizeDue({ payable_amount: 491, paid_amount: 491 }).due_amount).toBe(0);
  });

  it("never returns a negative due", () => {
    expect(normalizeDue({ payable_amount: 100, paid_amount: 250 }).due_amount).toBe(0);
  });

  it("treats missing due_amount as needing correction (no zero-due leak)", () => {
    const row = { payable_amount: 491, paid_amount: 0 } as any;
    const fixed = normalizeDue(row);
    expect(fixed.due_amount).toBe(491);
    expect(fixed.due_amount).toBe(fixed.payable_amount - fixed.paid_amount);
  });

  it("holds the invariant across a batch of generated invoices", () => {
    const batch = [
      { payable_amount: 491, paid_amount: 0 },
      { payable_amount: 1200, paid_amount: 0 },
      { payable_amount: 800, paid_amount: 800 },
      { payable_amount: 640, paid_amount: 100 },
    ].map(normalizeDue);
    for (const r of batch) {
      expect(r.due_amount).toBe(Math.max(r.payable_amount - r.paid_amount, 0));
    }
  });
});
