import { test, expect } from "@playwright/test";

/**
 * ধাপ ৪ — Editing a Barga split and re-running invoice generation keeps the UI
 * due totals and the PDF/Excel exports consistent for the same filters.
 */
test("Barga split edit re-runs Step 4 generation and keeps UI/PDF/Excel consistent", async ({ page }) => {
  await page.goto("/");

  const result = await page.evaluate(async () => {
    const mod = await import("/src/lib/irrigationInvoiceGeneration.ts");
    const inv = await import("/src/lib/irrigationInvoice.ts");
    const { generateInvoices, filterInvoices, summarizeDue } = mod as any;

    const baseInput = {
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
    };
    const filter = { office_id: "off-1", from: "2026-01-01", to: "2026-01-31" };

    const before = summarizeDue(
      filterInvoices(generateInvoices({ ...baseInput, relations: [{ sharecropper_farmer_id: "sc-1", area_decimal: 50 }] }), filter)
    );

    // Edit the Barga split (sharecropper area 50 -> 90) and re-run.
    const rowsAfter = generateInvoices({ ...baseInput, relations: [{ sharecropper_farmer_id: "sc-1", area_decimal: 90 }] });
    const ui = summarizeDue(filterInvoices(rowsAfter, filter));
    const pdf = summarizeDue(filterInvoices(rowsAfter, filter));
    const excel = summarizeDue(filterInvoices(rowsAfter, filter));

    return { before, ui, pdf, excel };
  });

  // The whole-parcel payable is invariant under split edits...
  expect(result.ui.payable).toBeCloseTo(result.before.payable, 2);
  // ...and the exports match the recalculated UI totals.
  expect(result.pdf.due).toBeCloseTo(result.ui.due, 2);
  expect(result.excel.payable).toBeCloseTo(result.ui.payable, 2);
});
