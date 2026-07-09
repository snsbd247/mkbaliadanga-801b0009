import { describe, it, expect } from "vitest";
import {
  reconcilePostings,
  journalRefForPayment,
  type ReconPayment,
} from "@/lib/irrigationPostingReconciliation";

const pay = (id: string, receipt_no: string, amount: number): ReconPayment => ({
  id,
  receipt_no,
  amount,
});

describe("irrigation posting reconciliation", () => {
  it("marks a payment ok when cashbook receipt and balanced journal both match", () => {
    const payments = [pay("pay-aaaaaaaa1111", "4696", 1800)];
    const receipts = [{ receipt_no: "4696", reference_id: "inv-A", amount: 1800 }];
    const journals = [
      { reference: journalRefForPayment("pay-aaaaaaaa1111"), total_debit: 1800, total_credit: 1800 },
    ];
    const res = reconcilePostings(payments, receipts, journals);
    expect(res.rows[0].ok).toBe(true);
    expect(res.rows[0].cashbook).toBe("ok");
    expect(res.rows[0].journal).toBe("ok");
    expect(res.discrepancies).toBe(0);
  });

  it("flags a missing cashbook receipt", () => {
    const payments = [pay("pay-bbbbbbbb2222", "4697", 947)];
    const journals = [
      { reference: journalRefForPayment("pay-bbbbbbbb2222"), total_debit: 947, total_credit: 947 },
    ];
    const res = reconcilePostings(payments, [], journals);
    expect(res.rows[0].cashbook).toBe("missing");
    expect(res.rows[0].ok).toBe(false);
    expect(res.discrepancies).toBe(1);
  });

  it("flags a missing journal entry", () => {
    const payments = [pay("pay-cccccccc3333", "4698", 486)];
    const receipts = [{ receipt_no: "4698", reference_id: "inv-C", amount: 486 }];
    const res = reconcilePostings(payments, receipts, []);
    expect(res.rows[0].cashbook).toBe("ok");
    expect(res.rows[0].journal).toBe("missing");
    expect(res.rows[0].ok).toBe(false);
  });

  it("flags an unbalanced journal", () => {
    const payments = [pay("pay-dddddddd4444", "4699", 500)];
    const receipts = [{ receipt_no: "4699", reference_id: "inv-D", amount: 500 }];
    const journals = [
      { reference: journalRefForPayment("pay-dddddddd4444"), total_debit: 500, total_credit: 300 },
    ];
    const res = reconcilePostings(payments, receipts, journals);
    expect(res.rows[0].journal).toBe("unbalanced");
    expect(res.rows[0].ok).toBe(false);
  });

  it("flags amount mismatch between payment and cashbook", () => {
    const payments = [pay("pay-eeeeeeee5555", "4700", 1000)];
    const receipts = [{ receipt_no: "4700", reference_id: "inv-E", amount: 900 }];
    const journals = [
      { reference: journalRefForPayment("pay-eeeeeeee5555"), total_debit: 1000, total_credit: 1000 },
    ];
    const res = reconcilePostings(payments, receipts, journals);
    expect(res.rows[0].cashbook).toBe("amount_mismatch");
    expect(res.rows[0].ok).toBe(false);
  });

  it("reconciles multiple payments (single + multi invoice) independently", () => {
    const payments = [
      pay("pay-11111111aaaa", "5001", 1200),
      pay("pay-22222222bbbb", "5002", 800),
      pay("pay-33333333cccc", "5003", 450),
    ];
    const receipts = [
      { receipt_no: "5001", reference_id: "inv-1", amount: 1200 },
      { receipt_no: "5002", reference_id: "inv-2", amount: 800 },
      // 5003 cashbook missing
    ];
    const journals = [
      { reference: journalRefForPayment("pay-11111111aaaa"), total_debit: 1200, total_credit: 1200 },
      { reference: journalRefForPayment("pay-22222222bbbb"), total_debit: 800, total_credit: 800 },
      { reference: journalRefForPayment("pay-33333333cccc"), total_debit: 450, total_credit: 450 },
    ];
    const res = reconcilePostings(payments, receipts, journals);
    expect(res.totalPayments).toBe(3);
    expect(res.totalPaymentAmount).toBe(2450);
    expect(res.cashbookOk).toBe(2);
    expect(res.journalOk).toBe(3);
    expect(res.discrepancies).toBe(1); // only 5003 cashbook missing
    expect(res.rows.find((r) => r.receipt_no === "5003")?.cashbook).toBe("missing");
  });
});
