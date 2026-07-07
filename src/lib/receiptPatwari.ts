/**
 * Resolve which patwari should appear on a payment receipt.
 * Prefers the patwari linked to the land; falls back to a manually selected
 * patwari when the land has none.
 */
export type ReceiptPatwari = { name: string | null; name_bn: string | null; mobile: string | null };

export function resolveReceiptPatwari(
  landPatwari: ReceiptPatwari | null | undefined,
  manualPatwari: ReceiptPatwari | null | undefined,
): { name: string | null; mobile: string | null } {
  const p = landPatwari ?? (landPatwari ? null : manualPatwari) ?? null;
  if (!p) return { name: null, mobile: null };
  return { name: p.name_bn || p.name || null, mobile: p.mobile ?? null };
}
