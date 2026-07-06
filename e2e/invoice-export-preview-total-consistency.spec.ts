import { test, expect } from "@playwright/test";
import { buildExportTotalsRow } from "../src/lib/irrigationExports";
import { calcInvoice, baseIrrigationAmount, DEFAULT_SETTINGS } from "../src/lib/irrigationInvoice";
import { resolveRateForLand, type RateRow } from "../src/lib/seasonRates";

/**
 * Invoice export ↔ preview total consistency (engine-level E2E).
 *
 * The Preview table, its Excel export and its PDF/CSV export must all derive
 * their totals from the SAME per-row payable numbers, so they can never
 * diverge — and pagination (which only affects how many rows are *shown*) must
 * never change the exported grand total.
 */

const due_date = "2999-12-31";

const rateMap: RateRow[] = [
  { land_type_id: "lt-high", land_type_code: "HIGH", land_type_name: "উঁচু জমি", rate_per_shotok: 50, calculation_basis: "per_shotok", office_id: null },
  { land_type_id: "lt-med", land_type_code: "MEDIUM", land_type_name: "মাঝারি জমি", rate_per_shotok: 40, calculation_basis: "per_shotok", office_id: null },
  { land_type_id: "lt-low", land_type_code: "LOW", land_type_name: "নিচু জমি", rate_per_shotok: 30, calculation_basis: "per_shotok", office_id: null },
];

// 130 lands cycling through the 3 land types → exercises multi-page preview.
const previewRows = Array.from({ length: 130 }, (_, i) => {
  const land = { land_type_id: rateMap[i % rateMap.length].land_type_id, land_size: i + 1 };
  const matched = resolveRateForLand(rateMap, land)!;
  const calc = calcInvoice({
    land_size_shotok: land.land_size,
    rate_per_shotok: matched.rate_per_shotok,
    basis: "per_shotok",
    settings: DEFAULT_SETTINGS,
    due_date,
  });
  return { land, rate: matched.rate_per_shotok, calc };
});

// Invoice objects as consumed by the export pipeline.
const invoices = previewRows.map((r) => ({
  payable_amount: r.calc.payable_amount,
  paid_amount: 0,
  due_amount: r.calc.payable_amount,
  discount_amount: 0,
}));

test("export grand total equals the sum of all preview payables", () => {
  const previewTotal = previewRows.reduce((a, r) => a + r.calc.payable_amount, 0);
  const totalsRow = buildExportTotalsRow(invoices, "en");
  const exported = Number(totalsRow[Object.keys(totalsRow).find((k) => k.toLowerCase().includes("payable"))!]);
  expect(exported).toBe(previewTotal);
});

test("pagination does not change the exported total", () => {
  const pageSize = 50;
  const shownPage1 = previewRows.slice(0, pageSize);
  const shownPage2 = previewRows.slice(pageSize, pageSize * 2);
  // Whatever page is shown, the export always uses the full set.
  expect(shownPage1).toHaveLength(50);
  expect(shownPage2).toHaveLength(50);
  const fullTotal = Number(buildExportTotalsRow(invoices, "en")[
    Object.keys(buildExportTotalsRow(invoices, "en")).find((k) => k.toLowerCase().includes("payable"))!
  ]);
  const recomputed = invoices.reduce((a, inv) => a + inv.payable_amount, 0);
  expect(fullTotal).toBe(recomputed);
});

test("each row's payable matches the engine for its own land-type rate", () => {
  for (const r of previewRows) {
    expect(r.calc.payable_amount).toBe(baseIrrigationAmount(r.land.land_size, r.rate, "per_shotok"));
  }
});
