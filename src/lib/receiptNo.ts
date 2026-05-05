/**
 * Receipt number helpers.
 * - Auto-generated when the user does not supply one.
 * - Manual entry (field-collected paper receipts) is normalized + validated.
 */
export type ReceiptKind = "PAY" | "SAV" | "LOAN" | "IRR";

export function autoReceiptNo(kind: ReceiptKind, seed: string, when: Date = new Date()): string {
  const ymd = `${when.getFullYear()}${String(when.getMonth() + 1).padStart(2, "0")}${String(when.getDate()).padStart(2, "0")}`;
  const tail = String(seed || "").replace(/[^a-z0-9]/gi, "").slice(-6).toUpperCase().padStart(6, "0");
  return `${kind}-${ymd}-${tail}`;
}

/** Trim, uppercase, collapse spaces. Returns null when empty so callers can fall back to auto. */
export function normalizeReceiptNo(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const v = String(raw).trim().replace(/\s+/g, "-").toUpperCase();
  return v.length === 0 ? null : v;
}

/** Manual receipts: 3–32 chars, alphanumerics + dash/slash. */
export function isValidManualReceiptNo(raw: string): boolean {
  const v = String(raw ?? "").trim();
  if (v.length < 3 || v.length > 32) return false;
  return /^[A-Za-z0-9][A-Za-z0-9\-\/]*[A-Za-z0-9]$/.test(v);
}

/** শতক (decimal) normalization: clamps negatives, rounds to 2dp. */
export function normalizeShotok(v: any): number {
  const n = typeof v === "number" ? v : parseFloat(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}
