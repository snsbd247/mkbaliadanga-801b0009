/**
 * Pure mirror of the Postgres `next_serial_receipt_no()` semantics.
 *
 * Admin sets `receipt_serial_start` = N, meaning N is the LAST number they
 * consider already used. The next issued receipt is therefore N + 1.
 * Raising the start jumps the next number up. Deleted/voided payment rows are
 * ignored, so a phantom counter drift cannot skip a number. The effective next
 * number is:
 *
 *   max(serialStart, maxActiveReceiptNo) + 1
 */
export function computeNextSerial(serialStart: number, maxActiveReceiptNo: number): number {
  const start = Math.floor(Number(serialStart) || 0);
  const activeMax = Math.floor(Number(maxActiveReceiptNo) || 0);
  return Math.max(start, activeMax) + 1;
}
