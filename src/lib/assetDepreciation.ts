/** Pure depreciation helpers — easy to unit-test. */

export type DepreciationMethod = "straight_line" | "wdv";

export interface DepreciationInput {
  method: DepreciationMethod;
  cost: number;            // original purchase price
  salvage: number;         // residual at end of life
  usefulLifeMonths: number;// for straight-line
  wdvRatePct: number;      // for WDV (percent per year, e.g. 15)
  openingBookValue: number;// current carrying value at start of period
  accumulated: number;     // total depreciation already booked
}

export interface DepreciationPeriod {
  depreciation: number;
  closingBookValue: number;
  accumulated: number;
}

/** Compute depreciation for a single month. Never depreciates below salvage. */
export function calcMonthlyDepreciation(i: DepreciationInput): DepreciationPeriod {
  const cost = Math.max(0, Number(i.cost) || 0);
  const salvage = Math.max(0, Number(i.salvage) || 0);
  const opening = Math.max(0, Number(i.openingBookValue) || 0);
  const accum = Math.max(0, Number(i.accumulated) || 0);

  // No more depreciation if already at/below salvage
  const remaining = Math.max(0, opening - salvage);
  if (remaining <= 0) {
    return { depreciation: 0, closingBookValue: opening, accumulated: accum };
  }

  let dep = 0;
  if (i.method === "straight_line") {
    const life = Math.max(1, Math.floor(i.usefulLifeMonths || 1));
    dep = (cost - salvage) / life;
  } else {
    // WDV: monthly = annual_rate / 12 applied on opening book value
    const annual = Math.max(0, Number(i.wdvRatePct) || 0) / 100;
    dep = opening * (annual / 12);
  }
  dep = Math.min(dep, remaining);
  dep = Number(dep.toFixed(2));
  const closing = Number((opening - dep).toFixed(2));
  return {
    depreciation: dep,
    closingBookValue: closing,
    accumulated: Number((accum + dep).toFixed(2)),
  };
}

/** First day of a given year-month (UTC-safe). */
export function periodMonth(year: number, month1to12: number): string {
  const m = String(month1to12).padStart(2, "0");
  return `${year}-${m}-01`;
}

/** Generate full schedule preview from start to end month (inclusive). */
export function generateSchedule(
  cfg: Omit<DepreciationInput, "openingBookValue" | "accumulated">,
  startISO: string,
  months: number
): Array<{ period: string } & DepreciationPeriod> {
  const out: Array<{ period: string } & DepreciationPeriod> = [];
  let opening = cfg.cost;
  let accum = 0;
  const start = new Date(startISO);
  for (let k = 0; k < months; k++) {
    const d = new Date(start.getFullYear(), start.getMonth() + k, 1);
    const r = calcMonthlyDepreciation({
      ...cfg,
      openingBookValue: opening,
      accumulated: accum,
    });
    out.push({
      period: periodMonth(d.getFullYear(), d.getMonth() + 1),
      ...r,
    });
    opening = r.closingBookValue;
    accum = r.accumulated;
    if (opening <= cfg.salvage) break;
  }
  return out;
}
