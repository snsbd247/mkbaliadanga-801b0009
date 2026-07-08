import { describe, it, expect } from "vitest";
import { buildInvoiceBreakdown, verifyInvoiceConsistency } from "@/lib/invoiceBreakdown";

describe("invoice breakdown (payable composition)", () => {
  it("payable = irrigation + delay + other − discount (maintenance/canal excluded)", () => {
    const b = buildInvoiceBreakdown({
      irrigation_amount: 1287.92,
      delay_fee: 0,
      other_charge: 0,
      discount_amount: 0,
      maintenance_amount: 1287.92, // 100% — used to double the due
      canal_amount: 0,
      paid_amount: 0,
    });
    // Regression: due must equal the total, NOT 2× it.
    expect(b.payable).toBe(1287.92);
    expect(b.due).toBe(1287.92);
    expect(b.excludedTotal).toBe(1287.92);
    // maintenance appears only as an excluded/info line
    expect(b.lines.find((l) => l.key === "maintenance")?.excluded).toBe(true);
    expect(b.lines.find((l) => l.key === "maintenance")?.sign).toBe(0);
  });

  it("adds delay + other and subtracts discount", () => {
    const b = buildInvoiceBreakdown({
      irrigation_amount: 1000,
      delay_fee: 100,
      other_charge: 50,
      discount_amount: 150,
      paid_amount: 0,
    });
    expect(b.payable).toBe(1000);
    expect(b.lines.map((l) => l.key)).toEqual(["irrigation", "delay_fee", "other_charge", "discount"]);
  });

  it("previous due is shown as info only, never folded into payable", () => {
    const b = buildInvoiceBreakdown({
      irrigation_amount: 1000,
      previous_due_amount: 500,
      paid_amount: 0,
    });
    expect(b.payable).toBe(1000); // NOT 1500
    expect(b.previousDue).toBe(500);
    expect(b.lines.find((l) => l.key === "previous_due")?.excluded).toBe(true);
  });

  it("partial payment reduces due", () => {
    const b = buildInvoiceBreakdown({ irrigation_amount: 1000, paid_amount: 300 });
    expect(b.due).toBe(700);
  });
});

describe("invoice consistency auto-check", () => {
  it("flags a double-counted (2×) stored due", () => {
    const r = verifyInvoiceConsistency({
      irrigation_amount: 1287.92,
      maintenance_amount: 1287.92,
      payable_amount: 2575.84, // legacy double-count
      due_amount: 2575.84,
      paid_amount: 0,
    });
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.code)).toEqual(
      expect.arrayContaining(["payable_mismatch", "due_mismatch"]),
    );
    expect(r.expected.due).toBe(1287.92);
  });

  it("passes for a correctly stored invoice", () => {
    const r = verifyInvoiceConsistency({
      irrigation_amount: 1000,
      delay_fee: 100,
      payable_amount: 1100,
      due_amount: 1100,
      paid_amount: 0,
    });
    expect(r.ok).toBe(true);
    expect(r.issues).toHaveLength(0);
  });

  it("flags paid exceeding total", () => {
    const r = verifyInvoiceConsistency({
      irrigation_amount: 1000,
      payable_amount: 1000,
      due_amount: 0,
      paid_amount: 1500,
    });
    expect(r.issues.map((i) => i.code)).toContain("paid_exceeds_payable");
  });

  it("tolerates sub-cent floating point drift", () => {
    const r = verifyInvoiceConsistency({
      irrigation_amount: 1000,
      payable_amount: 1000.0001,
      due_amount: 999.9999,
      paid_amount: 0,
    });
    expect(r.ok).toBe(true);
  });
});
