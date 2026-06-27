// Pure money math for Historical (পুরাতন) receipt entry.
// Mirrors the server logic in supabase/functions/historical-receipt-entry so the
// UI preview and tests stay in sync with what the backend stores.
export type HistoricalStatus = "paid" | "partial_paid" | "generated";

export function round2(v: number): number {
  return Math.round((Number.isFinite(v) ? v : 0) * 100) / 100;
}

export interface HistoricalAmounts {
  payable: number;
  due: number;
  paid: number;
  status: HistoricalStatus;
}

/** Collected = Total Charge − Due (never negative). Status derives from collected/due. */
export function computeHistoricalAmounts(totalCharge: number, dueAmount: number): HistoricalAmounts {
  const payable = round2(Math.max(totalCharge || 0, 0));
  const due = round2(Math.max(dueAmount || 0, 0));
  const paid = round2(Math.max(payable - due, 0));
  const status: HistoricalStatus = due <= 0 ? "paid" : paid > 0 ? "partial_paid" : "generated";
  return { payable, due, paid, status };
}

/** Borga when the cultivator differs from the land owner. */
export function isBorgaEntry(farmerId: string, ownerFarmerId: string): boolean {
  return String(farmerId) !== String(ownerFarmerId);
}
