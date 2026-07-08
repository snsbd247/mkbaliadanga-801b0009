import { describe, it, expect } from "vitest";
import { recalcInvoice } from "@/lib/invoiceRecalc";

/**
 * Regression: payment create → invoice paid → payment receipt delete → due restored.
 *
 * The database mirrors this exact flow:
 *  - irrigation_invoice_payments holds one link row per allocation.
 *  - trg_recalc_invoice_from_payments recomputes invoice.paid_amount as the SUM
 *    of the remaining link rows' collected_amount after any INSERT/UPDATE/DELETE.
 *  - trg_irrigation_invoice_recalc then derives due_amount + invoice_status from
 *    that paid_amount (mirrored purely by recalcInvoice).
 *
 * Deleting the payment now CASCADES to the link rows (previously ON DELETE SET
 * NULL left the row — and its collected_amount — behind, so the invoice stayed
 * "paid"). This test locks in the correct behaviour.
 */
function paidFromLinks(links: Array<{ collected_amount: number }>): number {
  return links.reduce((s, l) => s + Number(l.collected_amount || 0), 0);
}

describe("payment delete restores invoice due (regression)", () => {
  const payable = 1288;

  it("full lifecycle: create → paid → delete → due restored", () => {
    // 1. Create payment: one link row covering the full payable.
    let links = [{ payment_id: "pay-1", collected_amount: payable }];
    let inv = recalcInvoice(payable, paidFromLinks(links));
    expect(inv.invoice_status).toBe("paid");
    expect(inv.due_amount).toBe(0);

    // 2. Delete the payment → CASCADE removes its link row.
    links = links.filter((l) => l.payment_id !== "pay-1");
    inv = recalcInvoice(payable, paidFromLinks(links));

    // 3. Due is fully restored and status is no longer paid.
    expect(inv.due_amount).toBe(payable);
    expect(inv.invoice_status).toBe("generated");
    expect(inv.cleared).toBe(false);
  });

  it("partial payment deleted restores the partial amount", () => {
    let links = [
      { payment_id: "pay-1", collected_amount: 500 },
      { payment_id: "pay-2", collected_amount: 300 },
    ];
    let inv = recalcInvoice(payable, paidFromLinks(links));
    expect(inv.invoice_status).toBe("partial_paid");
    expect(inv.due_amount).toBe(payable - 800);

    // Delete only pay-1 → 300 still applied, due grows back by 500.
    links = links.filter((l) => l.payment_id !== "pay-1");
    inv = recalcInvoice(payable, paidFromLinks(links));
    expect(inv.due_amount).toBe(payable - 300);
    expect(inv.invoice_status).toBe("partial_paid");
  });

  it("deleting the last remaining payment returns invoice to fully due", () => {
    let links = [{ payment_id: "pay-2", collected_amount: 300 }];
    let inv = recalcInvoice(payable, paidFromLinks(links));
    expect(inv.invoice_status).toBe("partial_paid");

    links = [];
    inv = recalcInvoice(payable, paidFromLinks(links));
    expect(inv.due_amount).toBe(payable);
    expect(inv.invoice_status).toBe("generated");
  });

  it("cancelled invoice keeps status even after payment delete", () => {
    let links: Array<{ collected_amount: number }> = [{ collected_amount: payable }];
    let inv = recalcInvoice(payable, paidFromLinks(links), { currentStatus: "cancelled" });
    expect(inv.invoice_status).toBe("cancelled");

    links = [];
    inv = recalcInvoice(payable, paidFromLinks(links), { currentStatus: "cancelled" });
    expect(inv.invoice_status).toBe("cancelled");
    expect(inv.due_amount).toBe(payable);
  });
});
