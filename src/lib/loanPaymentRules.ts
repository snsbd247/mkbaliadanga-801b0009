/**
 * Pure loan-payment rules shared by the Combined Payment screen.
 * Centralizing them keeps the business logic testable and guarantees the
 * client requirements stay consistent:
 *  - Principal is mandatory when paying a loan.
 *  - Interest is OPTIONAL and is NEVER carried as an outstanding due.
 *  - Loan due is principal-only (mirrors farmer_dues_breakdown in the DB).
 */

export type LoanForRules = {
  principal: number;
  remaining: number; // principal-only remaining balance
  interest_rate: number;
  duration_months: number;
  issued_on: string | null;
  last_payment_on: string | null;
};

const MS_PER_MONTH = 1000 * 60 * 60 * 24 * 30;

/** Monthly-accrued interest suggestion based on the loan plan. */
export function suggestedInterest(loan: LoanForRules | null | undefined, now: number = Date.now()): number {
  if (!loan) return 0;
  const rate = Number(loan.interest_rate || 0);
  const dur = Number(loan.duration_months || 0);
  if (rate <= 0 || dur <= 0) return 0;
  const since = loan.last_payment_on || loan.issued_on;
  if (!since) return 0;
  const months = Math.max(0, Math.round((now - new Date(since).getTime()) / MS_PER_MONTH));
  const principalRemaining = Math.min(loan.principal, loan.remaining);
  return Math.round(principalRemaining * (rate / 100 / dur) * months);
}

/** True when the entered principal exceeds the remaining principal balance. */
export function loanPrincipalExceeds(loan: LoanForRules | null | undefined, principal: number): boolean {
  return !!loan && Number(principal || 0) > loan.remaining;
}

export type LoanPaymentValidation = { ok: boolean; error?: "principal_required" | "exceeds_remaining" | "negative" };

/** Validate a loan payment input. Interest is optional; only principal is required. */
export function validateLoanPayment(
  loan: LoanForRules | null | undefined,
  principal: number,
  interest: number,
): LoanPaymentValidation {
  const p = Number(principal || 0);
  const i = Number(interest || 0);
  if (p < 0 || i < 0) return { ok: false, error: "negative" };
  if (p + i > 0 && p <= 0) return { ok: false, error: "principal_required" };
  if (loanPrincipalExceeds(loan, p)) return { ok: false, error: "exceeds_remaining" };
  return { ok: true };
}

/**
 * Profit (interest) is optional and partial interest must NEVER be recorded as
 * an outstanding due. Always returns 0 — kept as a function so callers and tests
 * encode the rule explicitly.
 */
export function loanInterestDue(): 0 {
  return 0;
}
