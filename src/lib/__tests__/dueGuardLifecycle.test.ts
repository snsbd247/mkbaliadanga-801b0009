/**
 * অগ্রাধিকার ২ — Due calculation guard.
 *
 * Proves due_amount = payable − paid stays consistent (never double-added)
 * across the receipt → edit → cancel lifecycle, and that report totals
 * reconcile with the per-invoice running balances.
 */
import { describe, it, expect } from "vitest";
import { computeInvoiceDue, aggregate } from "@/lib/irrigationDue";
import { recalcAfterTransfer } from "@/lib/irrigationLandTransfer";

describe("computeInvoiceDue guard", () => {
  it("clamps paid to [0, payable] and never returns negative due", () => {
    expect(computeInvoiceDue(1000, -50)).toMatchObject({ paid: 0, due: 1000, status: "unpaid" });
    expect(computeInvoiceDue(1000, 1500)).toMatchObject({ paid: 1000, due: 0, status: "paid" });
    expect(computeInvoiceDue(1000, 400)).toMatchObject({ paid: 400, due: 600, status: "partial" });
  });

  it("treats zero-payable invoices as unpaid with zero due", () => {
    expect(computeInvoiceDue(0, 0)).toMatchObject({ payable: 0, paid: 0, due: 0, status: "unpaid" });
  });

  it("receipt → edit → cancel keeps due = payable − paid each step (single count)", () => {
    const payable = 3939;
    // 1) Receipt: collect 1300
    let s = computeInvoiceDue(payable, 1300);
    expect(s).toMatchObject({ paid: 1300, due: 2639, status: "partial" });
    // 2) Edit: bump collection to 2000 (diff applied to prior paid, not re-added)
    s = computeInvoiceDue(payable, 2000);
    expect(s).toMatchObject({ paid: 2000, due: 1939, status: "partial" });
    // 3) Cancel: reverse the full 2000 back to zero
    s = computeInvoiceDue(payable, 2000 - 2000);
    expect(s).toMatchObject({ paid: 0, due: payable, status: "unpaid" });
  });

  it("re-applying a reversal twice cannot push paid below zero", () => {
    const afterCancel = computeInvoiceDue(1000, 600 - 600);
    const doubleCancel = computeInvoiceDue(1000, afterCancel.paid - 600);
    expect(doubleCancel.paid).toBe(0);
    expect(doubleCancel.due).toBe(1000);
  });
});

describe("report totals reconcile with invoice running balances", () => {
  it("aggregate(due) == Σ(payable − paid) for live invoices", () => {
    const invoices = [
      computeInvoiceDue(3939, 1300),
      computeInvoiceDue(2000, 2000),
      computeInvoiceDue(1500, 0),
    ].map((s) => ({ payable_amount: s.payable, paid_amount: s.paid, due_amount: s.due, due_date: null }));
    const agg = aggregate(invoices);
    expect(agg.due).toBe(invoices.reduce((t, r) => t + (r.payable_amount - r.paid_amount), 0));
    expect(agg.payable - agg.paid).toBe(agg.due);
  });
});

describe("land transfer moves due exactly once", () => {
  it("closes previous open due and only the fresh due remains", () => {
    const r = recalcAfterTransfer({
      previous: { farmer_id: "A", payable: 3939, paid: 1300 },
      newPayable: 3939,
      newFarmerId: "B",
      newPaid: 0,
    });
    expect(r.previous.due).toBe(0);
    expect(r.previous.closed).toBe(2639);
    expect(r.next.due).toBe(3939);
    // Total outstanding is the fresh due only — the old open due is NOT summed in.
    expect(r.totalDue).toBe(r.next.due);
  });
});
