/** Pure helpers for the Asset module — easy to unit-test without DB. */

export type DisposalMethod = "scrap_sale" | "write_off" | "donation" | "lost";

/** Net gain/loss = sale_amount − book_value. Positive = gain, negative = loss. */
export function calcDisposalGainLoss(saleAmount: number | null | undefined, bookValue: number | null | undefined): number {
  const s = Number(saleAmount || 0);
  const b = Number(bookValue || 0);
  return Number((s - b).toFixed(2));
}

/** Apply a delta to current stock with a non-negative floor. */
export function applyStockDelta(current: number | null | undefined, delta: number): number {
  const next = Number(current || 0) + Number(delta || 0);
  return next < 0 ? 0 : next;
}

/** Resolve next asset status from an action. */
export function nextStatusForAction(
  action: "purchase" | "transfer" | "install" | "repair_start" | "repair_end" | "damage" | "dispose"
): "in_stock" | "transferred" | "installed" | "maintenance" | "damaged" | "disposed" {
  switch (action) {
    case "purchase": return "in_stock";
    case "transfer": return "transferred";
    case "install": return "installed";
    case "repair_start": return "maintenance";
    case "repair_end": return "in_stock";
    case "damage": return "damaged";
    case "dispose": return "disposed";
  }
}
