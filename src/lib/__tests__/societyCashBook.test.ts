import { describe, it, expect } from "vitest";
import { buildJamaRows, buildKharchRows, sumJama, sumKharch } from "@/lib/societyCashBook";

const farmerNames = { f1: "করিম", f2: "রহিম" };
const loanFarmers = { l1: "f2" };

const input = {
  savings: [
    { txn_date: "2026-02-02", type: "deposit", amount: 2100, receipt_no: "2042", farmer_id: "f1" },
    { txn_date: "2026-02-03", type: "share_collection", amount: 150, receipt_no: "2401", farmer_id: "f1" },
    { txn_date: "2026-02-25", type: "withdraw", amount: 900, receipt_no: "3018", farmer_id: "f2" },
  ],
  loanPayments: [
    { paid_on: "2026-02-10", amount: 1300, principal_amount: 1000, interest_amount: 300, receipt_no: "2482", loan_id: "l1" },
  ],
  bankTx: [
    { txn_date: "2026-02-22", txn_type: "withdraw", amount: 80000, reference_no: "BK1" },
    { txn_date: "2026-02-22", txn_type: "deposit", amount: 5000, reference_no: "BK2" },
  ],
  officeIncomes: [
    { received_on: "2026-02-05", income_type: "form", amount: 200, receipt_no: "F1", payer_name: "নতুন সদস্য" },
  ],
  expenses: [
    { expense_date: "2026-02-26", head: "Salary", amount: 12000, voucher_no: "636", payee: "কর্মচারী", is_bank_deposit: false },
    { expense_date: "2026-02-26", head: "ব্যাংক জমা", amount: 5000, voucher_no: "637", is_bank_deposit: true },
    { expense_date: "2026-02-27", head: "অফিস খরচ", amount: 800, voucher_no: "638", payee: "দোকান", is_bank_deposit: false },
  ],
  loansIssued: [
    { issued_on: "2026-02-20", principal: 50000, loan_no: "L100", farmer_id: "f2" },
  ],
  farmerNames, loanFarmers,
};

describe("societyCashBook জমা ledger", () => {
  const rows = buildJamaRows(input);
  it("buckets each receipt into the right column with farmer name", () => {
    const dep = rows.find((r) => r.savings > 0)!;
    expect(dep.name).toBe("করিম");
    expect(dep.savings).toBe(2100);
    const share = rows.find((r) => r.share > 0)!;
    expect(share.share).toBe(150);
    const loan = rows.find((r) => r.loanPrincipal > 0)!;
    expect(loan.name).toBe("রহিম");
    expect(loan.loanInterest).toBe(300);
    expect(rows.find((r) => r.bankWithdraw > 0)?.bankWithdraw).toBe(80000);
    expect(rows.find((r) => r.form > 0)?.form).toBe(200);
  });
  it("column totals add up", () => {
    const t = sumJama(rows);
    expect(t.savings).toBe(2100);
    expect(t.share).toBe(150);
    expect(t.loanPrincipal).toBe(1000);
    expect(t.bankWithdraw).toBe(80000);
    expect(t.total).toBe(2100 + 150 + 1300 + 80000 + 200);
  });
});

describe("societyCashBook খরচ ledger", () => {
  const rows = buildKharchRows(input);
  it("buckets deposit-return, loan-given, salary, bank-deposit, misc", () => {
    expect(rows.find((r) => r.depositReturn > 0)?.depositReturn).toBe(900);
    expect(rows.find((r) => r.loanGiven > 0)?.loanGiven).toBe(50000);
    expect(rows.find((r) => r.salary > 0)?.salary).toBe(12000);
    expect(rows.find((r) => r.bankDeposit > 0)?.bankDeposit).toBe(5000);
    expect(rows.find((r) => r.misc > 0)?.misc).toBe(800);
  });
  it("column totals add up", () => {
    const t = sumKharch(rows);
    expect(t.total).toBe(900 + 50000 + 12000 + 5000 + 800);
  });
});
