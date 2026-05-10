/**
 * Hybrid Irrigation Rate Resolver — pure logic.
 *
 * Layered priority:
 *   1. Manual override (admin-supplied rate + reason)
 *   2. Irrigation Category rate for the season
 *   3. Default Land-Type rate for the season
 *   4. No rate found → returns warning, callers must surface UI block
 *
 * This module is intentionally side-effect free so it can be unit-tested
 * and reused by both the invoice generator and the UI preview.
 */

export type RateSource = "STANDARD" | "CATEGORY" | "MANUAL";
export type CalculationBasis = "per_shotok" | "per_bigha" | "flat" | "custom";

export interface LandTypeRateInput {
  land_type_id?: string | null;
  land_type_code?: string | null;
  rate_per_shotok: number;
  basis?: CalculationBasis; // defaults to per_shotok
}

export interface CategoryRateInput {
  irrigation_category_id: string;
  category_name: string;
  rate: number;
  rate_type: CalculationBasis;
  is_negotiable?: boolean;
}

export interface ManualOverrideInput {
  rate: number;
  reason: string;
  basis?: CalculationBasis;
}

export interface ResolveInput {
  /** Resolved land-type rate (preferred fallback). */
  landTypeRate?: LandTypeRateInput | null;
  /** Pre-selected category rate for this land + season, if any. */
  categoryRate?: CategoryRateInput | null;
  /** User-supplied manual override (highest priority). */
  manualOverride?: ManualOverrideInput | null;
}

export interface ResolvedRate {
  source: RateSource;
  rate: number;
  basis: CalculationBasis;
  /** Original (pre-override) rate from the deterministic layer below — used for audit. */
  originalStandardRate: number;
  categoryId?: string | null;
  categoryName?: string | null;
  overrideReason?: string | null;
  isNegotiable?: boolean;
  warning?: string;
}

const isPosNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;

/** Pick the deterministic (non-manual) rate from category → land-type, for audit baseline. */
function deterministicBase(input: ResolveInput): { rate: number; basis: CalculationBasis; source: RateSource | null; cat?: CategoryRateInput | null } {
  const { categoryRate, landTypeRate } = input;
  if (categoryRate && isPosNum(categoryRate.rate)) {
    return { rate: categoryRate.rate, basis: categoryRate.rate_type, source: "CATEGORY", cat: categoryRate };
  }
  if (landTypeRate && isPosNum(landTypeRate.rate_per_shotok)) {
    return {
      rate: landTypeRate.rate_per_shotok,
      basis: landTypeRate.basis ?? "per_shotok",
      source: "STANDARD",
    };
  }
  return { rate: 0, basis: "per_shotok", source: null };
}

export const NO_RATE_WARNING_BN = "এই জমির জন্য কোনো সেচ রেট কনফিগার করা নেই।";

export function resolveIrrigationRate(input: ResolveInput): ResolvedRate {
  const base = deterministicBase(input);
  const { manualOverride } = input;

  // 1. Manual override wins
  if (manualOverride && isPosNum(manualOverride.rate)) {
    return {
      source: "MANUAL",
      rate: manualOverride.rate,
      basis: manualOverride.basis ?? base.basis,
      originalStandardRate: base.rate,
      categoryId: base.cat?.irrigation_category_id ?? null,
      categoryName: base.cat?.category_name ?? null,
      overrideReason: manualOverride.reason || null,
      isNegotiable: base.cat?.is_negotiable ?? false,
    };
  }

  // 2. + 3. deterministic base
  if (base.source) {
    return {
      source: base.source,
      rate: base.rate,
      basis: base.basis,
      originalStandardRate: base.rate,
      categoryId: base.cat?.irrigation_category_id ?? null,
      categoryName: base.cat?.category_name ?? null,
      isNegotiable: base.cat?.is_negotiable ?? false,
    };
  }

  // 4. Nothing found
  return {
    source: "STANDARD",
    rate: 0,
    basis: "per_shotok",
    originalStandardRate: 0,
    warning: NO_RATE_WARNING_BN,
  };
}
