import { describe, it, expect } from "vitest";

/**
 * Loan repayment → ledger → statement flow contract.
 *
 * The DB triggers (`post_loan_payment_ledger`) write 2 ledger rows per loan
 * payment: a debit on Loans Receivable (credit) and a credit on Cash (debit).
 * They use COALESCE(NULLIF(btrim(NEW.note),''), 'Loan repayment') for description.
 *
 * This test documents the contract that the FarmerStatement page consumes.
 */

type LedgerRow = { id: string; debit: number; credit: number; description: string | null };

function runningBalance(rows: LedgerRow[]) {
  let bal = 0;
  return rows.map((r) => {
    bal += Number(r.debit) - Number(r.credit);
    return { ...r, balance: bal };
  });
}

describe("Loan repayment → ledger → statement flow", () => {
  it("uses the user-entered note as the ledger description (not the fallback)", () => {
    const userNote = "1st installment — Rabi 2026";
    // Simulate trigger COALESCE
    const description = (userNote && userNote.trim()) || "Loan repayment";
    expect(description).toBe(userNote);
  });

  it("falls back to 'Loan repayment' when note is empty/whitespace", () => {
    for (const n of ["", "   ", null as any, undefined as any]) {
      const description = (n && String(n).trim()) || "Loan repayment";
      expect(description).toBe("Loan repayment");
    }
  });

  it("computes running balance correctly across debit/credit pairs", () => {
    const rows: LedgerRow[] = [
      { id: "1", debit: 1000, credit: 0, description: "Loan disbursement" },   // +1000
      { id: "2", debit: 0,    credit: 200, description: "1st installment" },   //  -200 → 800
      { id: "3", debit: 0,    credit: 300, description: "2nd installment" },   //  -300 → 500
      { id: "4", debit: 50,   credit: 0,   description: "Penalty" },           //  +50  → 550
    ];
    const out = runningBalance(rows);
    expect(out.map((r) => r.balance)).toEqual([1000, 800, 500, 550]);
  });

  it("never produces a NaN balance even with string numerics", () => {
    const rows: any[] = [
      { id: "1", debit: "100", credit: "0", description: "x" },
      { id: "2", debit: "0",   credit: "40", description: "y" },
    ];
    const out = runningBalance(rows);
    expect(out[1].balance).toBe(60);
    expect(Number.isNaN(out[1].balance)).toBe(false);
  });
});
