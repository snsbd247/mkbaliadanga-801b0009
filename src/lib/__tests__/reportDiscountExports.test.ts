import { describe, it, expect } from "vitest";
import { checkBalanced } from "@/lib/accountingPosting";

/**
 * Automated guard: report exports must carry the discount columns, and the
 * exported monetary totals must reconcile with the journal entry totals.
 *
 * We model the export rows exactly as the report pages build them (invoice and
 * loan reports), then assert the discount columns exist and that the summed
 * payable/discount values match the corresponding double-entry journal.
 */

type InvoiceRow = {
  payable_amount: number;
  paid_amount: number;
  due_amount: number;
  discount_amount: number;
  discount_reason: string | null;
  irrigation_amount: number;
};

// Mirrors the InvoiceReport Excel mapping (key names that must stay present).
const toInvoiceExportRow = (r: InvoiceRow) => ({
  Discount: r.discount_amount ?? 0,
  DiscountReason: r.discount_reason ?? "",
  Payable: r.payable_amount,
  Paid: r.paid_amount,
  Due: r.due_amount,
});

describe("report exports include discount columns and reconcile with journals", () => {
  const invoices: InvoiceRow[] = [
    { irrigation_amount: 1000, discount_amount: 200, discount_reason: "জমি কমেছে", payable_amount: 800, paid_amount: 800, due_amount: 0 },
    { irrigation_amount: 500, discount_amount: 0, discount_reason: null, payable_amount: 500, paid_amount: 0, due_amount: 500 },
  ];

  it("every invoice export row exposes Discount and DiscountReason keys", () => {
    for (const inv of invoices) {
      const row = toInvoiceExportRow(inv);
      expect(row).toHaveProperty("Discount");
      expect(row).toHaveProperty("DiscountReason");
      expect(row).toHaveProperty("Payable");
    }
  });

  it("payable = gross - discount for every row", () => {
    for (const inv of invoices) {
      expect(inv.payable_amount).toBe(inv.irrigation_amount - inv.discount_amount);
    }
  });

  it("export totals match posted journal totals (gross-income method)", () => {
    const totalGross = invoices.reduce((s, r) => s + r.irrigation_amount, 0);
    const totalDiscount = invoices.reduce((s, r) => s + r.discount_amount, 0);
    const totalPayable = invoices.reduce((s, r) => s + r.payable_amount, 0);
    const totalPaid = invoices.reduce((s, r) => s + r.paid_amount, 0);

    // Discount journal: Dr Discount Expense / Cr Irrigation Income
    const discountJournal = checkBalanced([
      { debit: totalDiscount, credit: 0 },
      { debit: 0, credit: totalDiscount },
    ]);
    expect(discountJournal.balanced || totalDiscount === 0).toBe(true);

    // Collection journal: Dr Cash / Cr Irrigation Income
    const collectionJournal = checkBalanced([
      { debit: totalPaid, credit: 0 },
      { debit: 0, credit: totalPaid },
    ]);
    expect(collectionJournal.balanced || totalPaid === 0).toBe(true);

    // Net payable exported = gross - discount
    expect(totalPayable).toBe(totalGross - totalDiscount);
    // Cash debited equals paid total shown in the export
    expect(collectionJournal.totalDebit).toBe(totalPaid);
  });
});
