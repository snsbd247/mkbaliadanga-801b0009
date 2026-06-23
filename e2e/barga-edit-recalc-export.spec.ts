import { test, expect } from "@playwright/test";
import { buildBargaReport, bargaReportToExportRows } from "../src/lib/irrigationBargaReport";
import { filterBargaParcelsByOffice } from "../src/lib/irrigationBargaAudit";

/**
 * Regression: editing a Barga split must immediately recompute dashboard /
 * FarmerDetail totals (no stale data), AND re-running PDF/Excel exports after
 * the edit must still match the UI numbers for the same filters.
 */

const settings = { delay_fee_enabled: false } as any;

function parcel(area: number, scArea: number) {
  return {
    land_id: "L1",
    office_id: "OFF1",
    owner_farmer_id: "OWNER1",
    parcel_area: area,
    rate_per_shotok: 10,
    due_date: "2026-06-30",
    settings,
    relations: [{ sharecropper_farmer_id: "SC1", area_decimal: scArea }],
    paid_amount: 0,
    farmer_names: { OWNER1: "Owner One", SC1: "Cropper One" },
  } as any;
}

test("editing a Barga split recalculates totals immediately", () => {
  const before = buildBargaReport([parcel(100, 40)]);
  const after = buildBargaReport([parcel(120, 50)]);
  // Total payable tracks the new parcel area — no stale value.
  expect(after.totals.payable_amount).toBeCloseTo(120 * 10, 2);
  expect(after.totals.payable_amount).not.toBeCloseTo(before.totals.payable_amount, 2);
});

test("exports match UI after a Barga edit for the same office filter", () => {
  const edited = filterBargaParcelsByOffice([parcel(120, 50)], "OFF1");
  const report = buildBargaReport(edited);
  const rows = bargaReportToExportRows(report);

  expect(rows.length).toBe(report.rows.length);
  report.rows.forEach((ui, i) => {
    expect(Number(rows[i].due_amount)).toBeCloseTo(ui.due_amount, 2);
    expect(Number(rows[i].payable_amount)).toBeCloseTo(ui.payable_amount, 2);
  });

  const sumDue = report.rows.reduce((s, r) => s + r.due_amount, 0);
  expect(sumDue).toBeCloseTo(report.totals.due_amount, 2);
});

test("office filter hides parcels from other offices", () => {
  const mixed = [parcel(100, 40), { ...parcel(100, 40), office_id: "OFF2" }];
  const onlyOff1 = filterBargaParcelsByOffice(mixed, "OFF1");
  expect(onlyOff1.length).toBe(1);
  expect(filterBargaParcelsByOffice(mixed, "*").length).toBe(2);
});
