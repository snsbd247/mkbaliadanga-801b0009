import { describe, it, expect } from "vitest";
import { recalcInvoice } from "@/lib/invoiceRecalc";

describe("invoice recalculation after payment (regression)", () => {
  it("full payment clears due and marks invoice paid (not pending)", () => {
    const r = recalcInvoice(1288, 1288);
    expect(r.due_amount).toBe(0);
    expect(r.invoice_status).toBe("paid");
    expect(r.cleared).toBe(true);
    // Regression guard: must NOT remain a pending/partial/overdue status.
    expect(["partial_paid", "overdue", "generated"]).not.toContain(r.invoice_status);
  });

  it("partial payment keeps a positive due and partial_paid status", () => {
    const r = recalcInvoice(1288, 500);
    expect(r.due_amount).toBe(788);
    expect(r.invoice_status).toBe("partial_paid");
    expect(r.cleared).toBe(false);
  });

  it("overpayment (fp drift) still clears to paid", () => {
    const r = recalcInvoice(1288, 1288.0000001);
    expect(r.due_amount).toBe(0);
    expect(r.invoice_status).toBe("paid");
  });

  it("no payment on an overdue invoice reports overdue", () => {
    const r = recalcInvoice(1000, 0, { dueDate: "2000-01-01" });
    expect(r.invoice_status).toBe("overdue");
  });

  it("cancelled invoices never flip status on payment", () => {
    const r = recalcInvoice(1000, 1000, { currentStatus: "cancelled" });
    expect(r.invoice_status).toBe("cancelled");
  });
});
