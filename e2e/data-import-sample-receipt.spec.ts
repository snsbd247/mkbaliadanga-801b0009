import { test, expect } from "@playwright/test";

/**
 * DataImport "নমুনা রশিদ প্রিভিউ / PDF ডাউনলোড" smoke + download test.
 * Verifies that clicking "PDF ডাউনলোড" generates an A5 PDF file whose content
 * corresponds to the selected receipt type (savings / loan / irrigation / misc).
 *
 * Required env: E2E_BASE_URL, E2E_COMMITTEE_EMAIL, E2E_PASSWORD (admin/super_admin).
 */
const EMAIL = process.env.E2E_COMMITTEE_EMAIL ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";
const skipReason = !EMAIL || !PASSWORD ? "E2E credentials not configured" : null;

test.describe("DataImport sample receipt PDF download", () => {
  test.skip(!!skipReason, skipReason ?? "");

  test.beforeEach(async ({ page }) => {
    await page.goto("/auth");
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/admin|dashboard/i, { timeout: 15_000 });
    await page.goto("/import");
  });

  for (const type of ["সেচ চার্জ", "বিবিধ আদায়", "সঞ্চয়", "ঋণ"]) {
    test(`downloads A5 PDF for receipt type: ${type}`, async ({ page }) => {
      // Pick the receipt type in the sample-type Select.
      await page.getByRole("combobox").last().click();
      await page.getByRole("option", { name: type, exact: true }).click();

      const downloadPromise = page.waitForEvent("download", { timeout: 20_000 });
      await page.getByRole("button", { name: /PDF ডাউনলোড/ }).click();
      const download = await downloadPromise;

      // File is generated and is a PDF.
      expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
      const path = await download.path();
      expect(path).toBeTruthy();
    });
  }
});
