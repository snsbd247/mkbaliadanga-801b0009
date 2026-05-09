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
 * Format a land size (stored in শতক) for human display showing both বিঘা & শতক.
 * - "long" (default): "1.50 বিঘা (49.50 শতক)"
 * - "short": "1.50 বিঘা / 49.50 শতক"
 * - "ascii": "1.50 bigha (49.50 shatak)" — for PDFs/Excels without Bangla fonts
 */
export function formatLandSize(
  shatak: number | string | null | undefined,
  variant: "long" | "short" | "ascii" = "long",
): string {
  if (shatak == null || shatak === "") return "—";
  const s = n(shatak);
  if (s <= 0) return variant === "ascii" ? "0 bigha (0 shatak)" : "০ বিঘা (০ শতক)";
  const b = shatakToBigha(s);
  const sf = s.toFixed(2);
  const bf = b.toFixed(2);
  if (variant === "ascii") return `${bf} bigha (${sf} shatak)`;
  if (variant === "short") return `${bf} বিঘা / ${sf} শতক`;
  return `${bf} বিঘা (${sf} শতক)`;
}
