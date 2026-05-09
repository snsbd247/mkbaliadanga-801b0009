/**
 * Loan installment delay-fee engine v2.
 * Pure functions only — easy to unit test and safe to reuse on server/client.
 *
 * Modes:
 *   flat     → fixed amount (settings.value)
 *   percent  → percent of installment amount (settings.value%)
 *   daily    → settings.daily_penalty × overdueDays
 *   combined → percent + daily
 *
 * `max_penalty` (nullable) caps the final value.
 * `enforcement_mode` controls payment validation: block | warn | allow.
 */

export type DelayFeeMode = "flat" | "percent" | "daily" | "combined";
export type EnforcementMode = "block" | "warn" | "allow";

export interface LoanDelayFeeSettings {
  mode: DelayFeeMode;
  value: number;
  daily_penalty?: number;
  max_penalty?: number | null;
  grace_days: number;
  auto_apply: boolean;
  allow_partial_installment: boolean;
  enforcement_mode?: EnforcementMode;
}

export const DEFAULT_DELAY_SETTINGS: LoanDelayFeeSettings = {
  mode: "flat",
  value: 0,
  daily_penalty: 0,
  max_penalty: null,
  grace_days: 0,
  auto_apply: true,
  allow_partial_installment: false,
  enforcement_mode: "block",
};

export interface InstallmentLike {
  id: string;
  installment_no: number;
  amount: number | string;
  paid_amount?: number | string | null;
  due_date: string;
  status?: string | null;
}

export interface PenaltyBreakdown {
  fixedPart: number;
  percentPart: number;
  dailyPart: number;
  overdueDays: number;
  capped: boolean;
  total: number;
}

function toNum(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}
function diffDays(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 86400000);
}
function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Detailed breakdown — useful for previews and snapshots. */
export function computePenaltyBreakdown(
  installment: InstallmentLike,
  settings: LoanDelayFeeSettings,
  paymentDate: Date = new Date(),
): PenaltyBreakdown {
  const empty: PenaltyBreakdown = { fixedPart: 0, percentPart: 0, dailyPart: 0, overdueDays: 0, capped: false, total: 0 };
  if (!settings.auto_apply || !installment?.due_date) return empty;
  const due = new Date(installment.due_date);
  const overdueDays = Math.max(0, diffDays(paymentDate, due));
  const billable = Math.max(0, overdueDays - toNum(settings.grace_days));
  if (billable <= 0) return { ...empty, overdueDays };

  const amount = toNum(installment.amount);
  let fixedPart = 0, percentPart = 0, dailyPart = 0;
  switch (settings.mode) {
    case "flat":     fixedPart   = toNum(settings.value); break;
    case "percent":  percentPart = amount * (toNum(settings.value) / 100); break;
    case "daily":    dailyPart   = toNum(settings.daily_penalty) * billable; break;
    case "combined":
      percentPart = amount * (toNum(settings.value) / 100);
      dailyPart   = toNum(settings.daily_penalty) * billable;
      break;
  }
  let total = round2(Math.max(0, fixedPart + percentPart + dailyPart));
  let capped = false;
  if (settings.max_penalty != null && total > toNum(settings.max_penalty)) {
    total = round2(toNum(settings.max_penalty));
    capped = true;
  }
  return { fixedPart: round2(fixedPart), percentPart: round2(percentPart), dailyPart: round2(dailyPart), overdueDays, capped, total };
}

/** Convenience scalar — legacy callers. */
export function computeInstallmentDelayFee(
  installment: InstallmentLike,
  settings: LoanDelayFeeSettings,
  paymentDate: Date = new Date(),
): number {
  return computePenaltyBreakdown(installment, settings, paymentDate).total;
}

/** JSON snapshot stored on installment row at payment-time. */
export function buildPenaltySnapshot(
  installment: InstallmentLike,
  settings: LoanDelayFeeSettings,
  paymentDate: Date = new Date(),
): Record<string, unknown> {
  const b = computePenaltyBreakdown(installment, settings, paymentDate);
  return {
    computed_at: paymentDate.toISOString(),
    rule: {
      mode: settings.mode,
      value: toNum(settings.value),
      daily_penalty: toNum(settings.daily_penalty),
      grace_days: toNum(settings.grace_days),
      max_penalty: settings.max_penalty ?? null,
    },
    breakdown: b,
  };
}

export interface InstallmentValidation {
  ok: boolean;
  required: number;
  remaining: number;
  delayFee: number;
  enforcement: EnforcementMode;
  reason?: string;
  needsOverride?: boolean;
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
  const enforcement: EnforcementMode = settings.enforcement_mode ?? (settings.allow_partial_installment ? "allow" : "block");

  if (recv + 0.005 >= required) return { ok: true, required, remaining, delayFee, enforcement };
  if (enforcement === "allow" || settings.allow_partial_installment) {
    return { ok: recv > 0, required, remaining, delayFee, enforcement, needsOverride: true };
  }
  return {
    ok: false,
    required,
    remaining,
    delayFee,
    enforcement,
    needsOverride: enforcement === "warn",
    reason: "নির্ধারিত কিস্তির চেয়ে কম টাকা গ্রহণ করা যাবে না।",
  };
}

export function nextDueInstallment<T extends InstallmentLike>(installments: T[]): T | null {
  return installments
    .filter((i) => (i.status ?? "") !== "paid" && toNum(i.paid_amount) < toNum(i.amount))
    .sort((a, b) => a.installment_no - b.installment_no)[0] ?? null;
}

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
