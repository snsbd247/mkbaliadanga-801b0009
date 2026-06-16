import { describe, it, expect } from "vitest";

// Mirrors the include-flag gating used in CombinedPayment for totals and
// printed receipt amounts: an unchecked line must contribute 0 everywhere.
type Form = {
  savings: number; share: number; loan_principal: number; loan_interest: number;
  include: { savings: boolean; share: boolean; loan: boolean };
};

function computeTotal(f: Form): number {
  return (
    (f.include.savings ? Number(f.savings || 0) : 0) +
    (f.include.share ? Number(f.share || 0) : 0) +
    (f.include.loan ? Number(f.loan_principal || 0) + Number(f.loan_interest || 0) : 0)
  );
}

function printedAmounts(f: Form) {
  return {
    savings: f.include.savings ? Number(f.savings || 0) : 0,
    share: f.include.share ? Number(f.share || 0) : 0,
    loan_principal: f.include.loan ? Number(f.loan_principal || 0) : 0,
    loan_interest: f.include.loan ? Number(f.loan_interest || 0) : 0,
  };
}

describe("combined payment include flags", () => {
  it("includes all lines when checked", () => {
    const f: Form = { savings: 100, share: 50, loan_principal: 200, loan_interest: 20, include: { savings: true, share: true, loan: true } };
    expect(computeTotal(f)).toBe(370);
    expect(printedAmounts(f)).toEqual({ savings: 100, share: 50, loan_principal: 200, loan_interest: 20 });
  });

  it("excludes unchecked lines from totals and printed amounts", () => {
    const f: Form = { savings: 100, share: 50, loan_principal: 200, loan_interest: 20, include: { savings: true, share: false, loan: false } };
    expect(computeTotal(f)).toBe(100);
    expect(printedAmounts(f)).toEqual({ savings: 100, share: 0, loan_principal: 0, loan_interest: 0 });
  });

  it("excludes loan interest when loan line is unchecked even if value entered", () => {
    const f: Form = { savings: 0, share: 0, loan_principal: 200, loan_interest: 20, include: { savings: false, share: false, loan: false } };
    expect(computeTotal(f)).toBe(0);
    expect(printedAmounts(f)).toEqual({ savings: 0, share: 0, loan_principal: 0, loan_interest: 0 });
  });
});
