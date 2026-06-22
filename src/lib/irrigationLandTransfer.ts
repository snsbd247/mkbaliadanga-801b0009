/**
 * Pure, side-effect-free model of irrigation due re-allocation when a land
 * parcel is transferred to a new owner / sharecropper.
 *
 * Rules (mirror of the DB transfer flow):
 *  - The previous holder's OPEN due for the parcel is closed (set to 0) — already
 *    PAID amounts are never touched, only the outstanding portion is released.
 *  - The new holder picks up a fresh due for the same billable area in the new
 *    season, derived once from `payable` (never carried-over/doubled).
 *  - Total due across both holders after transfer equals the new holder's fresh
 *    due (the old open due is closed, not summed).
 */

export interface TransferHolderDue {
  farmer_id: string;
  payable: number;
  paid: number;
}

export interface TransferResult {
  /** Previous holder after closing their open due. */
  previous: { farmer_id: string; payable: number; paid: number; due: number; closed: number };
  /** New holder with a freshly-derived due. */
  next: { farmer_id: string; payable: number; paid: number; due: number };
  /** Total outstanding due after the transfer (previous closed + next fresh). */
  totalDue: number;
}

const num = (v: unknown): number => {
  const x = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(x) ? x : 0;
};

export function recalcAfterTransfer(opts: {
  previous: TransferHolderDue;
  /** Fresh payable charged to the new holder for the new season. */
  newPayable: number;
  newFarmerId: string;
  /** Any amount already collected from the new holder (usually 0). */
  newPaid?: number;
}): TransferResult {
  const prevPayable = num(opts.previous.payable);
  const prevPaid = Math.min(num(opts.previous.paid), prevPayable);
  const openDue = Math.max(prevPayable - prevPaid, 0);

  const nextPayable = Math.max(num(opts.newPayable), 0);
  const nextPaid = Math.min(num(opts.newPaid), nextPayable);
  const nextDue = Math.max(nextPayable - nextPaid, 0);

  return {
    previous: {
      farmer_id: opts.previous.farmer_id,
      payable: prevPayable,
      paid: prevPaid,
      due: 0, // closed on transfer
      closed: openDue,
    },
    next: {
      farmer_id: opts.newFarmerId,
      payable: nextPayable,
      paid: nextPaid,
      due: nextDue,
    },
    totalDue: nextDue,
  };
}
