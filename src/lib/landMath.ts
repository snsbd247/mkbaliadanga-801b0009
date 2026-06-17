// Shared land-size precision + amount calculation utility.
//
// Single source of truth used by BOTH on-screen display and the backend-bound
// payloads so land area and the money derived from it stay consistent
// everywhere. Money rounding funnels through `roundTaka()` (admin-configurable),
// while land area itself is kept exact to 3 decimals (never money-rounded).

import { roundTaka, type RoundingMode } from "./rounding";

/** Land size is stored as numeric(12,3) — exactly 3 decimal places. */
export const LAND_DECIMALS = 3;

/**
 * Normalize a land-size value to exactly 3 decimals, avoiding the binary
 * float artifacts that produce values like 0.19699999999998. We round at the
 * 3rd decimal (half-up) and strip the float noise via a fixed-point reparse.
 */
export function normalizeLandSize(value: number | string | null | undefined): number {
  const n = typeof value === "string" ? parseFloat(value) : Number(value ?? 0);
  if (!isFinite(n) || n <= 0) return 0;
  // +epsilon guards against e.g. 0.1645 stored as 0.16449999...
  const factor = 10 ** LAND_DECIMALS;
  return Math.round((n + Number.EPSILON) * factor) / factor;
}

/**
 * Parse raw text from a land-size input. Returns the normalized number plus a
 * validity flag and an error key so callers can block bad entries (more than
 * 3 decimals, non-numeric, negative).
 */
export function parseLandInput(raw: string): { value: number; valid: boolean; error?: "nan" | "negative" | "precision" } {
  const trimmed = (raw ?? "").trim();
  if (trimmed === "") return { value: 0, valid: true };
  if (!/^\d*\.?\d*$/.test(trimmed)) return { value: 0, valid: false, error: "nan" };
  const n = parseFloat(trimmed);
  if (!isFinite(n)) return { value: 0, valid: false, error: "nan" };
  if (n < 0) return { value: 0, valid: false, error: "negative" };
  const decimals = trimmed.includes(".") ? trimmed.split(".")[1].length : 0;
  if (decimals > LAND_DECIMALS) return { value: normalizeLandSize(n), valid: false, error: "precision" };
  return { value: normalizeLandSize(n), valid: true };
}

/** Display land size exactly as entered (up to 3 decimals), trimming trailing zeros. */
export function formatLand(value: number | string | null | undefined, lang: "en" | "bn" = "en"): string {
  const n = normalizeLandSize(value);
  return n.toLocaleString(lang === "bn" ? "bn-BD" : "en-US", { maximumFractionDigits: LAND_DECIMALS });
}

export type AmountBreakdown = {
  landSize: number;       // normalized 3-decimal area
  rate: number;           // rate per shatak/unit
  raw: number;            // exact landSize * rate (no money rounding)
  rounded: number;        // money-rounded amount (whole taka)
};

/**
 * Convert land size × rate into an amount. The raw product stays exact; only
 * the final money figure is rounded per the active rounding mode.
 */
export function computeLandAmount(
  landSize: number | string | null | undefined,
  rate: number | null | undefined,
  mode?: RoundingMode,
): AmountBreakdown {
  const size = normalizeLandSize(landSize);
  const r = Number(rate ?? 0);
  const raw = size * r;
  return { landSize: size, rate: r, raw, rounded: roundTaka(raw, mode) };
}
