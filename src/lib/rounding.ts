// Admin-configurable taka rounding.
//
// Project default: "half_up" — ≥ .50 → up, < .50 → down. Persisted in
// localStorage so admins can change the rule from Settings without a code
// release. Currency formatters (`money`, `moneyPdf`) and Excel/PDF exports
// all funnel through `roundTaka()` so changing the mode rounds every
// invoice / receipt / report consistently.

export type RoundingMode = "half_up" | "half_even" | "floor" | "ceil";

const KEY = "taka_rounding_mode_v1";
export const DEFAULT_ROUNDING: RoundingMode = "half_up";

let cached: RoundingMode | null = null;

export function getRoundingMode(): RoundingMode {
  if (cached) return cached;
  try {
    const v = (typeof localStorage !== "undefined" && localStorage.getItem(KEY)) as RoundingMode | null;
    if (v === "half_up" || v === "half_even" || v === "floor" || v === "ceil") {
      cached = v;
      return v;
    }
  } catch { /* SSR / restricted env */ }
  cached = DEFAULT_ROUNDING;
  return cached;
}

export function setRoundingMode(mode: RoundingMode) {
  cached = mode;
  try { localStorage.setItem(KEY, mode); } catch { /* ignore */ }
}

/** Round a value to whole taka per the active mode. */
export function roundTaka(n: number | null | undefined, mode?: RoundingMode): number {
  const v = Number(n ?? 0);
  if (!isFinite(v)) return 0;
  const m = mode ?? getRoundingMode();
  switch (m) {
    case "floor": return Math.floor(v);
    case "ceil": return Math.ceil(v);
    case "half_even": {
      // Banker's rounding: .5 → nearest even.
      const f = Math.floor(v);
      const diff = v - f;
      if (diff < 0.5) return f;
      if (diff > 0.5) return f + 1;
      return f % 2 === 0 ? f : f + 1;
    }
    case "half_up":
    default:
      // Math.round rounds .5 away from zero → matches "≥ .50 → 1".
      return Math.round(v);
  }
}

/**
 * Sum a list of values rounding each line item first, then totaling. Useful
 * to verify "line items → total" parity in receipts/invoices/reports.
 */
export function sumRounded(values: Array<number | null | undefined>, mode?: RoundingMode): number {
  return values.reduce<number>((s, v) => s + roundTaka(v, mode), 0);
}
