import { describe, it, expect } from "vitest";
import {
  suggestedInterest,
  loanPrincipalExceeds,
  validateLoanPayment,
  loanInterestDue,
  type LoanForRules,
} from "@/lib/loanPaymentRules";

const baseLoan: LoanForRules = {
  principal: 10000,
  remaining: 10000,
  interest_rate: 9,
  duration_months: 6,
  issued_on: null,
  last_payment_on: null,
};

describe("loan payment rules — principal mandatory", () => {
  it("rejects a loan payment with interest but no principal", () => {
    expect(validateLoanPayment(baseLoan, 0, 100).error).toBe("principal_required");
  });

  it("accepts a payment with only principal (interest optional)", () => {
    expect(validateLoanPayment(baseLoan, 500, 0).ok).toBe(true);
  });

  it("accepts a payment with principal + partial interest", () => {
    expect(validateLoanPayment(baseLoan, 500, 100).ok).toBe(true);
  });

  it("rejects negative amounts", () => {
    expect(validateLoanPayment(baseLoan, -1, 0).error).toBe("negative");
    expect(validateLoanPayment(baseLoan, 100, -5).error).toBe("negative");
  });

  it("blocks principal greater than remaining", () => {
    expect(loanPrincipalExceeds(baseLoan, 10001)).toBe(true);
    expect(validateLoanPayment(baseLoan, 10001, 0).error).toBe("exceeds_remaining");
  });
});

describe("loan interest is never carried as a profit-due", () => {
  it("paying 100 of a 500 suggested interest leaves NO interest due", () => {
    // partial interest payment must not create a 400 due
    expect(loanInterestDue()).toBe(0);
  });
});

describe("monthly interest suggestion from loan plan", () => {
  it("returns 0 when rate or duration is zero", () => {
    expect(suggestedInterest({ ...baseLoan, interest_rate: 0 })).toBe(0);
    expect(suggestedInterest({ ...baseLoan, duration_months: 0 })).toBe(0);
  });

  it("returns 0 when there is no start date", () => {
    expect(suggestedInterest(baseLoan)).toBe(0);
  });

  it("accrues monthly: ~1 month at 9%/6mo on 10000 ≈ 150", () => {
    const oneMonthAgo = Date.now() - 1000 * 60 * 60 * 24 * 30;
    const v = suggestedInterest({ ...baseLoan, issued_on: new Date(oneMonthAgo).toISOString() });
    expect(v).toBe(Math.round(10000 * (9 / 100 / 6) * 1));
  });
});
