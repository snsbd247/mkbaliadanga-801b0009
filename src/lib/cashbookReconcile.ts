// Cashbook reconciliation helpers.
// Pure functions so they can be unit-tested without React/DB.

export type ReceiptLike = {
  receipt_no?: string | number | null;
  receipt_date?: string | null;
  amount?: number | null;
  kind?: string | null;
  // Reason metadata for excluded rows (voided/deleted payments):
  _excluded_reason?: "voided" | "deleted" | "unapproved" | null;
};

const numOf = (v: any): number | null => {
  const m = String(v ?? "").match(/^(\d+)$/);
  return m ? Number(m[1]) : null;
};

/**
 * Find purely numeric receipt-no gaps in a sequence.
 * Given a list of receipts, returns the missing receipt numbers between
 * min(nos) and max(nos). Non-numeric receipt numbers are ignored.
 */
export function findReceiptGaps(receipts: ReceiptLike[]): number[] {
  const nos = new Set<number>();
  for (const r of receipts) {
    const n = numOf(r.receipt_no);
    if (n != null) nos.add(n);
  }
  if (nos.size < 2) return [];
  const arr = Array.from(nos).sort((a, b) => a - b);
  const missing: number[] = [];
  for (let n = arr[0] + 1; n < arr[arr.length - 1]; n++) {
    if (!nos.has(n)) missing.push(n);
  }
  return missing;
}

/**
 * Match a list of missing numbers against known excluded receipts (voided /
 * deleted / unapproved) so the reconciliation UI can explain each gap.
 */
export function explainGaps(
  missing: number[],
  excluded: ReceiptLike[],
): Array<{ no: number; reason: string; date?: string | null; amount?: number | null }> {
  const map = new Map<number, ReceiptLike>();
  for (const e of excluded) {
    const n = numOf(e.receipt_no);
    if (n != null) map.set(n, e);
  }
  return missing.map((no) => {
    const hit = map.get(no);
    return {
      no,
      reason: hit?._excluded_reason ?? "unknown",
      date: hit?.receipt_date ?? null,
      amount: hit?.amount ?? null,
    };
  });
}
