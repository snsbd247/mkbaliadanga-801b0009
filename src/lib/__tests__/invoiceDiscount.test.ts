import { describe, it, expect } from "vitest";
import {
  grossAmount,
  validateDiscount,
  computeInvoiceTotals,
  canEditInvoiceDiscount,
  canEditInvoice,
} from "@/lib/invoiceDiscount";

const base = {
  irrigation_amount: 1000,
  maintenance_amount: 0,
  canal_amount: 0,
  other_charge: 100,
  delay_fee: 50,
  paid_amount: 0,
  invoice_status: "generated",
};

describe("grossAmount", () => {
  it("sums all charge components", () => {
    expect(grossAmount(base)).toBe(1150);
  });
});

describe("validateDiscount", () => {
  it("rejects negative discounts", () => {
    expect(validateDiscount(1150, -1, "x", 0).code).toBe("negative");
  });
  it("rejects discount exceeding invoice amount", () => {
    expect(validateDiscount(1150, 2000, "x", 0).code).toBe("exceeds_invoice");
  });
  it("requires a reason when discount changes", () => {
    expect(validateDiscount(1150, 200, "", 0).code).toBe("reason_required");
  });
  it("requires a reason for any non-zero discount, even if unchanged", () => {
    expect(validateDiscount(1150, 200, "", 200).code).toBe("reason_required");
  });
  it("accepts a valid discount", () => {
    expect(validateDiscount(1150, 200, "promo", 0)).toEqual({ ok: true, code: "ok" });
  });
});

describe("computeInvoiceTotals", () => {
  it("recalculates payable/due consistently", () => {
    const t = computeInvoiceTotals(base, 150);
    expect(t.payable).toBe(1000);
    expect(t.due).toBe(1000);
    expect(t.status).toBe("generated");
  });
  it("clamps discount to gross and never goes negative", () => {
    const t = computeInvoiceTotals(base, 99999);
    expect(t.payable).toBe(0);
    expect(t.due).toBe(0);
    expect(t.status).toBe("paid");
  });
  it("marks partial when partly paid", () => {
    const t = computeInvoiceTotals({ ...base, paid_amount: 500 }, 0);
    expect(t.payable).toBe(1150);
    expect(t.due).toBe(650);
    expect(t.status).toBe("partial_paid");
  });
  it("payable + discount equals gross", () => {
    const t = computeInvoiceTotals(base, 300);
    expect(t.payable + t.discount).toBe(t.gross);
  });
});

describe("role-based edit permission", () => {
  it("allows admin/staff to edit discounts", () => {
    expect(canEditInvoiceDiscount(["staff"])).toBe(true);
    expect(canEditInvoiceDiscount(["admin"])).toBe(true);
    expect(canEditInvoiceDiscount(["committee"])).toBe(false);
  });
  it("prevents staff editing approved invoices", () => {
    expect(canEditInvoice(["staff"], { ...base, invoice_status: "paid" }).ok).toBe(false);
    expect(canEditInvoice(["staff"], { ...base, invoice_status: "partial_paid" }).ok).toBe(false);
    expect(canEditInvoice(["staff"], base).ok).toBe(true);
  });
  it("allows admin to edit approved invoices", () => {
    expect(canEditInvoice(["admin"], { ...base, invoice_status: "paid" }).ok).toBe(true);
  });
  it("blocks roles without permission", () => {
    expect(canEditInvoice(["committee"], base)).toEqual({ ok: false, reason: "no_permission" });
  });
});
