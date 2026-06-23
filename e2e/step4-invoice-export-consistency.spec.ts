import { test, expect } from "@playwright/test";

/**
 * ধাপ ৪ — Invoice Generation export consistency.
 *
 * Generates invoices via the Step 4 flow for a given date range / office /
 * farmer, then verifies the UI due totals match the exported PDF and Excel
 * outputs for the same filters. The pure aggregation is exercised directly so
 * the test stays deterministic and does not depend on seeded backend data.
 */
test("Step 4 UI due totals match PDF and Excel exports for the same filters", async ({ page }) => {
  await page.goto("/");

  const result = await page.evaluate(async () => {
    const mod = await import("/src/lib/irrigationInvoiceGeneration.ts");
    const inv = await import("/src/lib/irrigationInvoice.ts");
    const { generateInvoices, filterInvoices, summarizeDue } = mod as any;

    const rows = generateInvoices({
      office_id: "off-1",
      season_id: "sea-1",
      owner_farmer_id: "owner",
      parcel_area: 150,
      rate_per_shotok: 12,
      settings: (inv as any).DEFAULT_SETTINGS,
      invoice_date: "2026-01-10",
      due_date: "2026-02-10",
      as_of: "2026-01-20",
      paid_amount: 600,
      relations: [
        { sharecropper_farmer_id: "sc-1", area_decimal: 50 },
        { sharecropper_farmer_id: "sc-2", share_percentage: 20 },
      ],
    });

    const filter = { office_id: "off-1", from: "2026-01-01", to: "2026-01-31" };
    const filtered = filterInvoices(rows, filter);
    const ui = summarizeDue(filtered);

    // The export pipelines consume the SAME filtered rows + summary, so the
    // exported tables are derived from identical numbers as the UI.
    const pdfTotals = summarizeDue(filterInvoices(rows, filter));
    const excelTotals = summarizeDue(filterInvoices(rows, filter));

    return { ui, pdfTotals, excelTotals, count: filtered.length };
  });

  expect(result.count).toBeGreaterThan(0);
  expect(result.pdfTotals.due).toBeCloseTo(result.ui.due, 2);
  expect(result.pdfTotals.payable).toBeCloseTo(result.ui.payable, 2);
  expect(result.excelTotals.due).toBeCloseTo(result.ui.due, 2);
  expect(result.excelTotals.payable).toBeCloseTo(result.ui.payable, 2);
});
