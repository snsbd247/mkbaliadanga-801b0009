/**
 * Loan installment delay-fee engine.
 * Pure functions only — easy to unit test and safe to reuse on server/client.
 */

export type DelayFeeMode = "flat" | "percent";

export interface LoanDelayFeeSettings {
  mode: DelayFeeMode;
  value: number;
  grace_days: number;
  auto_apply: boolean;
  allow_partial_installment: boolean;
}

export const DEFAULT_DELAY_SETTINGS: LoanDelayFeeSettings = {
  mode: "flat",
  value: 0,
  grace_days: 0,
  auto_apply: true,
  allow_partial_installment: false,
};

export interface InstallmentLike {
  id: string;
  installment_no: number;
  amount: number | string;
  paid_amount?: number | string | null;
  due_date: string;
  status?: string | null;
}

function toNum(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function diffDays(a: Date, b: Date): number {
  const ms = a.getTime() - b.getTime();
  return Math.floor(ms / 86400000);
}

/**
 * Compute the delay fee for a single installment given a payment date.
 * Returns 0 when within grace period or auto_apply disabled.
 */
export function computeInstallmentDelayFee(
  installment: InstallmentLike,
  settings: LoanDelayFeeSettings,
  paymentDate: Date = new Date(),
): number {
  if (!settings.auto_apply) return 0;
  if (!installment?.due_date) return 0;
  const due = new Date(installment.due_date);
  const overdueDays = diffDays(paymentDate, due);
  if (overdueDays <= settings.grace_days) return 0;

  const amount = toNum(installment.amount);
  if (settings.mode === "percent") {
    return Math.max(0, +(amount * (toNum(settings.value) / 100)).toFixed(2));
  }
  return Math.max(0, +toNum(settings.value).toFixed(2));
}

/**
 * Validate that the user-supplied payment amount is sufficient to cover
 * the installment + delay fee. Honors `allow_partial_installment`.
 */
export interface InstallmentValidation {
  ok: boolean;
  required: number;
  remaining: number;
  delayFee: number;
  reason?: string;
}

export function validateInstallmentPayment(
  installment: InstallmentLike,
  settings: LoanDelayFeeSettings,
  amountReceived: number,
  paymentDate: Date = new Date(),
): InstallmentValidation {
  const due = toNum(installment.amount);
  const alreadyPaid = toNum(installment.paid_amount);
  const remaining = Math.max(0, due - alreadyPaid);
  const delayFee = computeInstallmentDelayFee(installment, settings, paymentDate);
  const required = remaining + delayFee;
  const recv = toNum(amountReceived);

  if (settings.allow_partial_installment) {
    return { ok: recv > 0, required, remaining, delayFee };
  }
  if (recv + 0.005 < required) {
    return {
      ok: false,
      required,
      remaining,
      delayFee,
      reason: "নির্ধারিত কিস্তির চেয়ে কম টাকা গ্রহণ করা যাবে না।",
    };
  }
  return { ok: true, required, remaining, delayFee };
}

/**
 * Pick the next collectable installment (oldest unpaid).
 */
export function nextDueInstallment<T extends InstallmentLike>(installments: T[]): T | null {
  const open = installments
    .filter((i) => (i.status ?? "") !== "paid" && toNum(i.paid_amount) < toNum(i.amount))
    .sort((a, b) => a.installment_no - b.installment_no);
  return open[0] ?? null;
}

/**
 * Allocate an incoming amount across overdue + current installment.
 * Returns ordered list of {installment_id, applied, delay_fee}.
 */
export interface AllocationLine {
  installment_id: string;
  installment_no: number;
  applied: number;
  delay_fee: number;
}

export function allocateAcrossInstallments(
  installments: InstallmentLike[],
  settings: LoanDelayFeeSettings,
  amount: number,
  paymentDate: Date = new Date(),
): AllocationLine[] {
  let remaining = toNum(amount);
  const out: AllocationLine[] = [];
  const open = [...installments]
    .filter((i) => (i.status ?? "") !== "paid" && toNum(i.paid_amount) < toNum(i.amount))
    .sort((a, b) => a.installment_no - b.installment_no);

  for (const i of open) {
    if (remaining <= 0) break;
    const fee = computeInstallmentDelayFee(i, settings, paymentDate);
    const need = Math.max(0, toNum(i.amount) - toNum(i.paid_amount)) + fee;
    const applied = Math.min(remaining, need);
    out.push({ installment_id: i.id, installment_no: i.installment_no, applied, delay_fee: Math.min(fee, applied) });
    remaining -= applied;
  }
  return out;
}
