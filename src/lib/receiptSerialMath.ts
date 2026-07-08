/**
 * Pure mirror of the Postgres `next_serial_receipt_no()` semantics.
 *
 * Admin sets `receipt_serial_start` = N, meaning N is the EXACT next receipt
 * number to issue. Entering 4641 makes the next receipt 4641 (not 4642).
 * Deleted/voided payment rows are ignored, and the value can never collide
 * with a receipt that is already active. The effective next number is:
 *
 *   max(serialStart, maxActiveReceiptNo + 1)
 */
export function computeNextSerial(serialStart: number, maxActiveReceiptNo: number): number {
  const start = Math.floor(Number(serialStart) || 0);
  const activeMax = Math.floor(Number(maxActiveReceiptNo) || 0);
  return Math.max(start, activeMax + 1);
}

