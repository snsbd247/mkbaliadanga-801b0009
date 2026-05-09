/**
 * Canonical Farmer ID helpers.
 *
 * Farmer IDs are stored as a plain zero-padded 5-digit string ("00001").
 * Legacy values like "F-00001", " 00001 ", "1", or "2026-00000001" are
 * normalized into the canonical form.
 *
 * The same helper is used by:
 *  - the Farmer ID input on the Farmers form
 *  - the Bulk Farmer Import (CSV/XLSX)
 *  - the DB trigger `set_farmer_code` (mirror of this logic in plpgsql)
 */

const PAD = 5;

/** Strict regex for the canonical farmer code stored in DB. */
export const FARMER_CODE_RE = /^\d{5,}$/;

/** Returns true when `code` is already in canonical zero-padded form. */
export function isCanonicalFarmerCode(code: string | null | undefined): boolean {
  return typeof code === "string" && FARMER_CODE_RE.test(code);
}

/**
 * Convert any user/import input to the canonical "00001" form.
 *
 * Accepted inputs (all yield "00001"):
 *   "F-00001", "f-1", "  00001 ", "2026-00000001", "1", 1
 *
 * Returns `{ ok: false, error }` for inputs that contain no digits or
 * exceed a sane length so the import flow can surface a clear error.
 */
export function normalizeFarmerCode(
  input: unknown,
): { ok: true; value: string } | { ok: false; error: string } {
  if (input == null) return { ok: false, error: "Farmer ID is empty" };
  const raw = String(input).trim();
  if (!raw) return { ok: false, error: "Farmer ID is empty" };

  // Strip an alpha (or alpha+year) prefix like "F-", "f-", "2026-".
  // Anything left must be digits; otherwise the input is malformed.
  const digits = raw.replace(/^[A-Za-z]+-?/, "").replace(/^\d{4}-/, "");
  if (!/^\d+$/.test(digits)) {
    return { ok: false, error: `"${raw}" is not a valid Farmer ID (expected digits, e.g. 00001)` };
  }
  if (digits.length > 12) {
    return { ok: false, error: `"${raw}" is too long for a Farmer ID` };
  }
  // Drop leading zeros so "00000001" and "1" both canonicalize to "00001".
  const stripped = digits.replace(/^0+/, "") || "0";
  return { ok: true, value: stripped.padStart(PAD, "0") };
}

/**
 * Display formatter — returns the canonical form or the original value
 * unchanged when normalization fails (so legacy/junk data is still visible).
 */
export function formatFarmerCode(code: string | null | undefined): string {
  if (code == null || code === "") return "";
  const r = normalizeFarmerCode(code);
  return r.ok ? r.value : String(code);
}
