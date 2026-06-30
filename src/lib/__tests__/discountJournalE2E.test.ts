import { describe, it, expect } from "vitest";
import { computeInvoiceTotals, grossAmount } from "@/lib/invoiceDiscount";
import { checkBalanced, formatImbalance } from "@/lib/accountingPosting";

/**
 * End-to-end style check: an invoice with a discount, followed by a payment,
 * must keep the discounted payable consistent with the journal postings used
 * for PDF/Excel export totals.
 *
 * Gross-income method:
 *  - Discount journal:   Dr Discount Expense (delta) / Cr Irrigation Income (delta)
 *  - Collection journal: Dr Cash (collected)        / Cr Irrigation Income (collected)
 *  - Net recognised income = gross (income is credited gross via discount + collection)
 */
describe("discount + payment journal vs export totals", () => {
  const inv = {
    irrigation_amount: 1000,
    paid_amount: 0,
    invoice_status: "generated" as const,
  };

  it("discounted payable equals collection journal debit (export total)", () => {
    const gross = grossAmount(inv, 0, 0); // 1000
    const discount = 200;
    const totals = computeInvoiceTotals(inv, discount, null, 0, 0);
    expect(totals.payable).toBe(800);

    // Discount posting
    const discountJournal = [
      { debit: discount, credit: 0 },
      { debit: 0, credit: discount },
    ];
    const discBal = checkBalanced(discountJournal);
    expect(discBal.balanced).toBe(true);

    // Collection posting for the full discounted payable
    const collectionJournal = [
      { debit: totals.payable, credit: 0 },
      { debit: 0, credit: totals.payable },
    ];
    const collBal = checkBalanced(collectionJournal);
    expect(collBal.balanced).toBe(true);

    // Export "net payable" must equal the cash debited
    expect(collectionJournal[0].debit).toBe(totals.payable);

    // Gross income recognised = discount credit + collection credit = gross
    const incomeCredit = discountJournal[1].credit + collectionJournal[1].credit;
    expect(incomeCredit).toBe(gross);
  });

  it("flags an unbalanced journal with amounts, reference and exact difference", () => {
    const bad = checkBalanced([
      { debit: 800, credit: 0 },
      { debit: 0, credit: 750 },
    ]);
    expect(bad.balanced).toBe(false);
    expect(bad.difference).toBe(50);

    const withRef = { ...bad, reference: "INV-1001" };
    const en = formatImbalance(withRef, "en");
    const bn = formatImbalance(withRef, "bn");
    expect(en).toContain("INV-1001");
    expect(en).toContain("800");
    expect(en).toContain("750");
    expect(en).toContain("50");
    expect(bn).toContain("INV-1001");
    expect(bn).toContain("পার্থক্য");
  });
});
