/**
 * Pure mirror of the Postgres `next_serial_receipt_no()` semantics.
 *
 * Admin sets `receipt_serial_start` = N, meaning N is the LAST number they
 * consider already used. The next issued receipt is therefore N + 1.
 * Raising the start jumps the counter up; it never goes backwards (no
 * duplicates), so the effective next number is:
 *
 *   max(counterLastNo + 1, serialStart + 1)
 */
export function computeNextSerial(serialStart: number, counterLastNo: number): number {
  const start = Math.floor(Number(serialStart) || 0);
  const last = Math.floor(Number(counterLastNo) || 0);
  return Math.max(last + 1, start + 1);
}
