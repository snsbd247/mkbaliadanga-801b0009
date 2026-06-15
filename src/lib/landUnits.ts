// Land-area unit conversions for irrigation receipts.
// Canonical storage unit is শতক (shatak/decimal).
// Reference: 1 বিঘা = 33 শতক = 20 কাঠা  →  1 কাঠা = 1.65 শতক.

export const SHATAK_PER_BIGHA = 33;
export const KATHA_PER_BIGHA = 20;
export const SHATAK_PER_KATHA = SHATAK_PER_BIGHA / KATHA_PER_BIGHA; // 1.65

export interface LandUnits {
  shatak: number;
  bigha: number;
  katha: number;
}

/** Convert a শতক value into বিঘা and কাঠা equivalents. */
export function shatakToUnits(shatak: number): LandUnits {
  const s = Number(shatak) || 0;
  return {
    shatak: s,
    bigha: s / SHATAK_PER_BIGHA,
    katha: s / SHATAK_PER_KATHA,
  };
}

/**
 * Human-readable land-size label showing বিঘা · কাঠা · (শতক).
 * Returns null when the size is not available.
 */
export function landSizeLabel(shatak: number | null | undefined, lang: "bn" | "en"): string | null {
  if (shatak == null) return null;
  const u = shatakToUnits(Number(shatak));
  // Per client convention the receipt shows land size in কাঠা ও শতক only (no বিঘা).
  return lang === "bn"
    ? `${u.katha.toFixed(2)} কাঠা · ${u.shatak.toFixed(2)} শতক`
    : `${u.katha.toFixed(2)} katha · ${u.shatak.toFixed(2)} shatak`;
}
