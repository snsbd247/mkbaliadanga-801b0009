/**
 * Pure irrigation charge calculation engine.
 * All amounts in BDT; land sizes in শতক (decimal).
 *
 * Basis:
 *  - per_size:  base = rate × land_size (শতক)
 *  - per_day:   base = rate × quantity (days)
 *  - per_hour:  base = rate × quantity (hours)
 *  - per_land:  base = rate (flat per land, qty ignored)
 */
export type IrrigationBasis = "per_size" | "per_day" | "per_hour" | "per_land";

export interface IrrigationInput {
  basis: IrrigationBasis;
  rate: number;
  quantity?: number;       // days/hours; ignored for per_size/per_land
  land_size?: number;      // শতক — required for per_size
  previous_due?: number;
  penalty?: number;
  canal_charge?: number;
  maintenance_charge?: number;
  other_charge?: number;
  paid_amount?: number;
}

export interface IrrigationBreakdown {
  base_charge: number;
  canal_charge: number;
  maintenance_charge: number;
  other_charge: number;
  previous_due: number;
  penalty: number;
  total: number;
  paid_amount: number;
  due_amount: number;
}

const n = (v: any): number => {
  const x = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(x) && x > 0 ? x : 0;
};
const round2 = (v: number) => Math.round(v * 100) / 100;

export function calcBaseCharge(input: Pick<IrrigationInput, "basis" | "rate" | "quantity" | "land_size">): number {
  const rate = n(input.rate);
  switch (input.basis) {
    case "per_size":
      return round2(rate * n(input.land_size));
    case "per_day":
    case "per_hour":
      return round2(rate * n(input.quantity));
    case "per_land":
      return round2(rate);
    default:
      return 0;
  }
}

export function calcIrrigation(input: IrrigationInput): IrrigationBreakdown {
  const base = calcBaseCharge(input);
  const canal = round2(n(input.canal_charge));
  const maint = round2(n(input.maintenance_charge));
  const other = round2(n(input.other_charge));
  const prev = round2(n(input.previous_due));
  const penalty = round2(n(input.penalty));
  const total = round2(base + canal + maint + other + prev + penalty);
  const paid = Math.min(round2(n(input.paid_amount)), total);
  const due = round2(total - paid);
  return {
    base_charge: base,
    canal_charge: canal,
    maintenance_charge: maint,
    other_charge: other,
    previous_due: prev,
    penalty,
    total,
    paid_amount: paid,
    due_amount: due,
  };
}

/** Per-day average due across `days` (e.g., season length) — simple amortization. */
export function dailyDue(totalDue: number, days: number): number {
  const d = Math.max(1, Math.floor(days));
  return round2(n(totalDue) / d);
}

/** Bigha ↔ Shatak conversion. 1 বিঘা = 33 শতক (Bangladesh standard). */
export const SHATAK_PER_BIGHA = 33;
export const shatakToBigha = (shatak: number | string | null | undefined): number =>
  round2(n(shatak) / SHATAK_PER_BIGHA);
export const bighaToShatak = (bigha: number | string | null | undefined): number =>
  round2(n(bigha) * SHATAK_PER_BIGHA);

/**
 * Katha conversion — local org standard: 1 বিঘা = 20 কাঠা.
 * Hence 1 কাঠা = 0.05 বিঘা = 1.65 শতক.
 */
export const KATHA_PER_BIGHA = 20;
export const BIGHA_PER_KATHA = 1 / KATHA_PER_BIGHA; // 0.05
export const SHATAK_PER_KATHA = round2(SHATAK_PER_BIGHA * BIGHA_PER_KATHA); // 1.65

/**
 * Parse "bigha.katha" notation (e.g. 1.15 = ১ বিঘা ১৫ কাঠা) to শতক.
 * Decimal part = number of কাঠা (max 19, since 20 কাঠা = 1 বিঘা).
 */
export const bighaKathaToShatak = (value: number | string | null | undefined): number => {
  const v = n(value);
  if (v <= 0) return 0;
  const bigha = Math.floor(v);
  const katha = Math.round((v - bigha) * 100);
  return round2(bighaToShatak(bigha) + kathaToShatak(katha));
};
/** Format শতক back to "bigha.katha" notation string (e.g. "1.15"). */
export const shatakToBighaKatha = (shatak: number | string | null | undefined): string => {
  const s = n(shatak);
  if (s <= 0) return "0";
  const bigha = Math.floor(s / SHATAK_PER_BIGHA);
  const katha = Math.round((s - bigha * SHATAK_PER_BIGHA) / SHATAK_PER_KATHA);
  return `${bigha}.${String(katha).padStart(2, "0")}`;
};
export const shatakToKatha = (shatak: number | string | null | undefined): number =>
  round2(n(shatak) / SHATAK_PER_KATHA);
export const kathaToShatak = (katha: number | string | null | undefined): number =>
  round2(n(katha) * SHATAK_PER_KATHA);
export const bighaToKatha = (bigha: number | string | null | undefined): number =>
  round2(n(bigha) / BIGHA_PER_KATHA);
export const kathaToBigha = (katha: number | string | null | undefined): number =>
  round2(n(katha) * BIGHA_PER_KATHA);

/**
 * Format a land size (stored in শতক) for human display.
 * - "long" (default): "1.50 বিঘা (49.50 শতক)"
 * - "short": "1.50 বিঘা / 49.50 শতক"
 * - "ascii": "1.50 bigha (49.50 shatak)" — for PDFs/Excels without Bangla fonts
 * - "with_katha": "1.50 বিঘা · 10.00 কাঠা · 49.50 শতক"
 */
export function formatLandSize(
  shatak: number | string | null | undefined,
  variant: "long" | "short" | "ascii" | "with_katha" = "long",
): string {
  if (shatak == null || shatak === "") return "—";
  const s = n(shatak);
  if (s <= 0) return variant === "ascii" ? "0 bigha (0 shatak)" : "০ বিঘা (০ শতক)";
  const b = shatakToBigha(s);
  const k = shatakToKatha(s);
  const sf = s.toFixed(2);
  const bf = b.toFixed(2);
  const kf = k.toFixed(2);
  if (variant === "ascii") return `${bf} bigha · ${kf} katha (${sf} shatak)`;
  if (variant === "short") return `${bf} বিঘা / ${sf} শতক`;
  if (variant === "with_katha") return `${bf} বিঘা · ${kf} কাঠা · ${sf} শতক`;
  return `${bf} বিঘা (${sf} শতক)`;
}
