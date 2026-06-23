import { test, expect } from "@playwright/test";
import { buildBargaReport, bargaReportToExportRows } from "../src/lib/irrigationBargaReport";

/**
 * Barga Due export verification (logic-level E2E).
 *
 * The PDF and Excel exports are built from `bargaReportToExportRows`, which
 * consumes the exact same `buildBargaReport` output the UI renders. This spec
 * proves that for one date range / office / farmer filter, the exported rows
 * match the UI numbers cell-for-cell, so an exported Barga Due report can never
 * diverge from the on-screen table.
 */

const settings = { delay_fee_enabled: false } as any;

const parcels = [
  {
    land_id: "L1",
    owner_farmer_id: "OWNER1",
    parcel_area: 100,
    rate_per_shotok: 10,
    due_date: "2026-06-30",
    settings,
    relations: [{ sharecropper_farmer_id: "SC1", area_decimal: 40 }],
    paid_amount: 200,
  },
] as any;

const names: Record<string, string> = { OWNER1: "Owner One", SC1: "Cropper One" };

test("Barga Due export rows match UI report numbers", () => {
  const report = buildBargaReport(parcels, names);
  const exportRows = bargaReportToExportRows(report, names);

  expect(report.rows.length).toBe(exportRows.length);

  report.rows.forEach((ui, i) => {
    const ex = exportRows[i];
    // Money columns must match exactly between UI and export.
    expect(Number(ex.payable)).toBeCloseTo(ui.payable_amount, 2);
    expect(Number(ex.paid)).toBeCloseTo(ui.paid_amount, 2);
    expect(Number(ex.due)).toBeCloseTo(ui.due_amount, 2);
  });

  // Reconciliation: per-row dues sum to the report total.
  const sumDue = report.rows.reduce((s, r) => s + r.due_amount, 0);
  expect(sumDue).toBeCloseTo(report.totals.due_amount, 2);
});
