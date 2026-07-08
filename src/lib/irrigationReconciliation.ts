/**
 * Pure irrigation hāl (হাল) / penalty (জরিমানা) reconciliation helpers.
 *
 * These mirror the exact classification & totals used by the payment panel
 * (src/components/payments/IrrigationPaymentPanel.tsx) when generating a
 * receipt, so the admin reconciliation report and the receipt agree.
 *
 * Rules:
 *  - An invoice is "hal" (current) when its season equals the current season,
 *    otherwise it is "due" (বকেয়া / arrears).
 *  - charge  = max(0, due_amount − original delay_fee)  (penalty excluded)
 *  - penalty = delay-fee override if provided, else the stored delay_fee
 */

export interface ReconInvoice {
  id: string;
  invoice_no?: string | null;
  season_id: string;
  due_date?: string | null;
  due_amount?: number | null;
  delay_fee?: number | null;
  seasons?: { name?: string | null; year?: number | null } | null;
}

export type Classification = "hal" | "due";

export interface ReconRow {
  id: string;
  invoice_no: string;
  season: string;
  season_id: string;
  classification: Classification;
  charge: number;
  penalty: number;
}

export interface ReconResult {
  rows: ReconRow[];
  halCharge: number;
  halPenalty: number;
  dueCharge: number;
  duePenalty: number;
  /** hāl charge + hāl penalty + due charge + due penalty */
  grandTotal: number;
}

const num = (v: unknown): number => {
  const x = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(x) ? x : 0;
};

/**
 * Determine which season is treated as "current" (হাল) for a farmer's set of
 * invoices. Prefers the globally active season when present among the invoices;
 * otherwise picks the newest season (by year, then latest due date).
 */
export function pickCurrentSeasonId(
  invoices: ReconInvoice[],
  activeSeasonId?: string | null,
): string | null {
  if (activeSeasonId && invoices.some((i) => i.season_id === activeSeasonId)) return activeSeasonId;
  let best: string | null = null;
  let bestYear = -Infinity;
  let bestDate = "";
  for (const i of invoices) {
    const y = num(i.seasons?.year);
    const d = i.due_date ?? "";
    if (y > bestYear || (y === bestYear && d > bestDate)) {
      bestYear = y;
      bestDate = d;
      best = i.season_id;
    }
  }
  return best;
}

const seasonLabel = (i: ReconInvoice): string =>
  `${i.seasons?.name ?? "—"} ${i.seasons?.year ?? ""}`.trim();

/**
 * Reconcile a farmer's invoices into hāl vs due charge/penalty totals.
 * @param delayOverrides optional map of invoice_id → overridden penalty.
 */
export function reconcileFarmerInvoices(
  invoices: ReconInvoice[],
  currentSeasonId: string | null,
  delayOverrides: Record<string, number> = {},
): ReconResult {
  const rows: ReconRow[] = invoices.map((inv) => {
    const isHal = !!currentSeasonId && inv.season_id === currentSeasonId;
    const original = num(inv.delay_fee);
    const penalty = inv.id in delayOverrides ? num(delayOverrides[inv.id]) : original;
    return {
      id: inv.id,
      invoice_no: inv.invoice_no ?? inv.id.slice(0, 8),
      season: seasonLabel(inv),
      season_id: inv.season_id,
      classification: isHal ? "hal" : "due",
      charge: Math.max(0, num(inv.due_amount) - original),
      penalty,
    };
  });
  const sum = (cls: Classification, key: "charge" | "penalty") =>
    rows.filter((r) => r.classification === cls).reduce((s, r) => s + r[key], 0);
  const halCharge = sum("hal", "charge");
  const halPenalty = sum("hal", "penalty");
  const dueCharge = sum("due", "charge");
  const duePenalty = sum("due", "penalty");
  return {
    rows,
    halCharge,
    halPenalty,
    dueCharge,
    duePenalty,
    grandTotal: halCharge + halPenalty + dueCharge + duePenalty,
  };
}
