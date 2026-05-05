/**
 * Format a loan-receipt number from a template string.
 * Tokens supported: {YYYY} {MM} {DD} {YYYYMMDD} {TAIL}
 *   {TAIL} = last 6 alphanumeric chars of the source seed (uppercased, padded).
 */
export function formatLoanReceiptNo(
  template: string | null | undefined,
  seed: string,
  when: Date = new Date(),
): string {
  const tpl = (template && template.trim()) || "LOAN-{YYYYMMDD}-{TAIL}";
  const yyyy = String(when.getFullYear());
  const mm = String(when.getMonth() + 1).padStart(2, "0");
  const dd = String(when.getDate()).padStart(2, "0");
  const tail = String(seed || "")
    .replace(/[^a-z0-9]/gi, "")
    .slice(-6)
    .toUpperCase()
    .padStart(6, "0");
  return tpl
    .replace(/\{YYYYMMDD\}/g, `${yyyy}${mm}${dd}`)
    .replace(/\{YYYY\}/g, yyyy)
    .replace(/\{MM\}/g, mm)
    .replace(/\{DD\}/g, dd)
    .replace(/\{TAIL\}/g, tail);
}

/**
 * Validate that an installment schedule's totals match the loan record.
 * Returns { ok, scheduledTotal, paidFromInstallments, paidFromPayments, mismatch }.
 */
export function validateLoanTotals(
  loan: { total_payable: number | string | null | undefined },
  installments: { amount: number | string; paid_amount: number | string }[],
  payments: { amount: number | string }[],
  tolerance = 0.5,
): { ok: boolean; scheduledTotal: number; paidFromInstallments: number; paidFromPayments: number; loanTotal: number; mismatch: string | null } {
  const scheduledTotal = installments.reduce((s, i) => s + Number(i.amount || 0), 0);
  const paidFromInstallments = installments.reduce((s, i) => s + Number(i.paid_amount || 0), 0);
  const paidFromPayments = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const loanTotal = Number(loan.total_payable || 0);
  const issues: string[] = [];
  if (installments.length && Math.abs(scheduledTotal - loanTotal) > tolerance) {
    issues.push(`schedule(${scheduledTotal.toFixed(2)}) ≠ payable(${loanTotal.toFixed(2)})`);
  }
  if (Math.abs(paidFromInstallments - paidFromPayments) > tolerance) {
    issues.push(`installments-paid(${paidFromInstallments.toFixed(2)}) ≠ payments(${paidFromPayments.toFixed(2)})`);
  }
  return {
    ok: issues.length === 0,
    scheduledTotal,
    paidFromInstallments,
    paidFromPayments,
    loanTotal,
    mismatch: issues.length ? issues.join(" · ") : null,
  };
}
