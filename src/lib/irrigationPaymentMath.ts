/**
 * Pure math helpers for the irrigation payment panel.
 *
 * These are extracted so the rounding/tolerance rules can be unit tested in
 * isolation. The core bug they guard against: a total due of e.g. 1288 must
 * never be reported as "exceeded" when the operator collects exactly 1288
 * (floating point can produce 1288.0000001 style drift).
 */

/** Amounts within this many taka are treated as equal. */
export const TAKA_TOLERANCE = 0.5;

export interface DueInvoice {
  id: string;
  due_date: string | Date;
  due_amount: number;
}

/** Sum of due for the given (already selected) invoices. */
export function sumDue(invoices: Array<{ due_amount: number }>): number {
  return invoices.reduce((s, i) => s + Number(i.due_amount || 0), 0);
}

/**
 * True only when `collected` is meaningfully larger than `dueTotal`.
 * Uses TAKA_TOLERANCE so paying the exact due (incl. fp drift) never trips it.
 */
export function exceedsDue(collected: number, dueTotal: number): boolean {
  return Number(collected || 0) > Number(dueTotal || 0) + TAKA_TOLERANCE;
}

/** True when a remaining shortfall is meaningful (beyond rounding noise). */
export function hasShortfall(shortfall: number): boolean {
  return Number(shortfall || 0) > TAKA_TOLERANCE;
}

/**
 * Allocate `collected` across invoices oldest-due first. Returns per-invoice
 * take amounts plus the covered invoice ids (for receipt/PDF detail) and any
 * unallocated remainder.
 */
export function allocateOldestFirst(
  invoices: DueInvoice[],
  collected: number,
): { takes: Record<string, number>; covered: string[]; remaining: number } {
  const takes: Record<string, number> = {};
  const covered: string[] = [];
  let remaining = Math.max(0, Number(collected) || 0);
  const sorted = [...invoices].sort(
    (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime(),
  );
  for (const inv of sorted) {
    if (remaining <= TAKA_TOLERANCE) break;
    const take = Math.min(remaining, Math.max(0, Number(inv.due_amount) || 0));
    if (take > 0) {
      takes[inv.id] = +take.toFixed(2);
      covered.push(inv.id);
      remaining = +(remaining - take).toFixed(2);
    }
  }
  return { takes, covered, remaining: +Math.max(0, remaining).toFixed(2) };
}
