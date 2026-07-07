import { describe, it, expect } from "vitest";
import type { AppRole } from "@/auth/AuthProvider";
import { canEditInvoice, computeInvoiceTotals } from "@/lib/invoiceDiscount";

const OFFICE_A = "office-a";
const OFFICE_B = "office-b";

const generatedInvoice = {
  invoice_status: "generated" as string,
  office_id: OFFICE_A,
  irrigation_amount: 1000,
  paid_amount: 0,
};

describe("canEditInvoice — office scoping (regression)", () => {
  it("staff CAN edit an invoice in their own office", () => {
    const roles: AppRole[] = ["staff"];
    const res = canEditInvoice(roles, generatedInvoice, { userOfficeId: OFFICE_A });
    expect(res.ok).toBe(true);
  });

  it("staff CANNOT edit an invoice from another office", () => {
    const roles: AppRole[] = ["staff"];
    const res = canEditInvoice(roles, generatedInvoice, { userOfficeId: OFFICE_B });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("office_mismatch");
  });

  it("super_admin CAN edit an invoice from ANY office", () => {
    const roles: AppRole[] = ["super_admin"];
    const res = canEditInvoice(roles, generatedInvoice, { userOfficeId: OFFICE_B });
    expect(res.ok).toBe(true);
  });

  it("admin is restricted to their own office (mirrors RLS)", () => {
    const roles: AppRole[] = ["admin"];
    expect(canEditInvoice(roles, generatedInvoice, { userOfficeId: OFFICE_A }).ok).toBe(true);
    expect(canEditInvoice(roles, generatedInvoice, { userOfficeId: OFFICE_B }).reason).toBe("office_mismatch");
  });

  it("staff cannot edit an already-approved (paid) invoice even in own office", () => {
    const roles: AppRole[] = ["staff"];
    const paid = { ...generatedInvoice, invoice_status: "paid" };
    const res = canEditInvoice(roles, paid, { userOfficeId: OFFICE_A });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("staff_approved_locked");
  });
});

describe("invoice edit persists due_amount and invoice_status", () => {
  it("staff edit that fully discounts clears due and marks paid", () => {
    const totals = computeInvoiceTotals(generatedInvoice, 1000);
    expect(totals.payable).toBe(0);
    expect(totals.due).toBe(0);
    expect(totals.status).toBe("paid");
  });

  it("partial charge change keeps a positive due amount", () => {
    const totals = computeInvoiceTotals({ ...generatedInvoice, paid_amount: 200 }, 0);
    expect(totals.payable).toBe(1000);
    expect(totals.due).toBe(800);
    expect(totals.status).toBe("partial_paid");
  });
});
