/**
 * Lump-sum ("একবারে পরিশোধ — মেয়াদ শেষে") loan helpers.
 *
 * For a lump-sum plan the whole principal + interest is due in a single
 * installment at the end of the term. These pure helpers compute the schedule
 * and validate the interest input so the logic stays testable and consistent
 * across the loan form, payment screens and receipts.
 */

export const LUMP_SUM_TYPE = "lump_sum" as const;

export function isLumpSum(installmentType: string | null | undefined): boolean {
  return installmentType === LUMP_SUM_TYPE;
}

export type LumpSumInput = {
  principal: number;
  interestRate: number; // percent for the whole term
  durationMonths: number;
  issuedOn: string; // yyyy-mm-dd
};

export type LumpSumScheduleRow = {
  seq: number;
  dueDate: string; // yyyy-mm-dd
  principalDue: number;
  interestDue: number;
  totalDue: number;
};

/** Add `months` calendar months to an ISO date string (yyyy-mm-dd). */
export function addMonths(isoDate: string, months: number): string {
  const d = new Date(isoDate + "T00:00:00");
  if (isNaN(d.getTime())) return isoDate;
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  // guard against month overflow (e.g. Jan 31 + 1 = Mar 3)
  if (d.getDate() < day) d.setDate(0);
  return d.toISOString().slice(0, 10);
}

/** Interest amount for a lump-sum loan: principal * rate% (flat over the term). */
export function lumpSumInterest(principal: number, interestRate: number): number {
  const p = Number(principal || 0);
  const r = Number(interestRate || 0);
  if (p <= 0 || r <= 0) return 0;
  return Math.round((p * r) / 100);
}

/** Single-row schedule: full principal + interest due at end of term. */
export function lumpSumSchedule(input: LumpSumInput): LumpSumScheduleRow[] {
  const principalDue = Math.round(Number(input.principal || 0));
  const interestDue = lumpSumInterest(input.principal, input.interestRate);
  const dueDate = addMonths(input.issuedOn, Math.max(1, Number(input.durationMonths || 0)));
  return [
    {
      seq: 1,
      dueDate,
      principalDue,
      interestDue,
      totalDue: principalDue + interestDue,
    },
  ];
}

export type InterestValidation = { ok: boolean; error?: string };

/**
 * Validate a lump-sum interest-rate input.
 * Allowed: numeric, 0–100, at most 2 decimal places.
 */
export function validateLumpSumInterest(
  raw: number | string,
  tx: (en: string, bn: string) => string,
): InterestValidation {
  const str = String(raw).trim();
  if (str === "") return { ok: false, error: tx("Interest rate is required", "সুদের হার আবশ্যক") };
  if (!/^\d+(\.\d{1,2})?$/.test(str)) {
    return {
      ok: false,
      error: tx("Enter a valid number with up to 2 decimals", "সর্বোচ্চ ২ দশমিক সহ বৈধ সংখ্যা দিন"),
    };
  }
  const n = Number(str);
  if (isNaN(n) || n < 0) return { ok: false, error: tx("Interest rate cannot be negative", "সুদের হার ঋণাত্মক হতে পারে না") };
  if (n > 100) return { ok: false, error: tx("Interest rate must be 100 or less", "সুদের হার ১০০ বা তার কম হতে হবে") };
  return { ok: true };
}
