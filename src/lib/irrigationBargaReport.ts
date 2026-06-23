/**
 * Barga Due report builder — single source of truth for the Barga Due report
 * UI table AND its PDF / Excel exports, so all three render identical numbers.
 *
 * The caller is responsible for fetching the candidate parcels (already
 * filtered by date range / office / farmer) and supplying paid amounts. This
 * module turns each parcel into per-farmer Barga due rows via `computeBargaDue`
 * and produces a reconciled grand total.
 */
import {
  computeBargaDue,
  type BargaDueInput,
  type BargaDueRow,
} from "./irrigationBargaDue";

export interface BargaReportParcel extends BargaDueInput {
  land_id: string;
  /** Optional pre-resolved farmer display names keyed by farmer id. */
  farmer_names?: Record<string, string>;
}

export interface BargaReportRow extends BargaDueRow {
  land_id: string;
  billed_farmer_name: string;
  owner_farmer_name: string;
}

export interface BargaReportTotals {
  payable_amount: number;
  paid_amount: number;
  due_amount: number;
  rowCount: number;
}

export interface BargaReport {
  rows: BargaReportRow[];
  totals: BargaReportTotals;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

export function buildBargaReport(parcels: BargaReportParcel[]): BargaReport {
  const rows: BargaReportRow[] = [];
  for (const p of parcels) {
    const names = p.farmer_names ?? {};
    for (const d of computeBargaDue(p)) {
      rows.push({
        ...d,
        land_id: p.land_id,
        billed_farmer_name: names[d.billed_farmer_id] ?? d.billed_farmer_id,
        owner_farmer_name: names[d.owner_farmer_id] ?? d.owner_farmer_id,
      });
    }
  }
  const totals = rows.reduce<BargaReportTotals>(
    (t, r) => ({
      payable_amount: r2(t.payable_amount + r.payable_amount),
      paid_amount: r2(t.paid_amount + r.paid_amount),
      due_amount: r2(t.due_amount + r.due_amount),
      rowCount: t.rowCount + 1,
    }),
    { payable_amount: 0, paid_amount: 0, due_amount: 0, rowCount: 0 },
  );
  return { rows, totals };
}

/** Flat rows ready for CSV/Excel export (headers + data share one shape). */
export function bargaReportToExportRows(
  report: BargaReport,
): Array<Record<string, string | number>> {
  return report.rows.map((r) => ({
    land_id: r.land_id,
    billed_farmer: r.billed_farmer_name,
    owner_farmer: r.owner_farmer_name,
    is_borga: r.is_borga ? "হ্যাঁ" : "না",
    billed_area: r.billed_area,
    payable_amount: r.payable_amount,
    paid_amount: r.paid_amount,
    due_amount: r.due_amount,
  }));
}
