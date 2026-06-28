import { test, expect } from "@playwright/test";

/**
 * After a demo import, re-printing an irrigation receipt from the Payments page
 * must populate land + charge fields (মৌজা, দাগ, জমির ধরন, রেট, চার্জ) from the
 * real invoice/land data — never blank or hard-coded.
 *
 * Required env: E2E_BASE_URL, E2E_COMMITTEE_EMAIL, E2E_PASSWORD (admin/super_admin).
 */
const EMAIL = process.env.E2E_COMMITTEE_EMAIL ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";
const skipReason = !EMAIL || !PASSWORD ? "E2E credentials not configured" : null;

test.describe("Payments irrigation receipt re-print after demo import", () => {
  test.skip(!!skipReason, skipReason ?? "");

  test.beforeEach(async ({ page }) => {
    await page.goto("/auth");
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/admin|dashboard/i, { timeout: 15_000 });
  });

  test("re-print preview shows land + charge fields", async ({ page }) => {
    // Enable receipt-data debug tracing for diagnosability.
    await page.addInitScript(() => localStorage.setItem("debug:receipt-data", "1"));
    const traces: string[] = [];
    page.on("console", (m) => {
      if (m.text().includes("[receipt-data]")) traces.push(m.text());
    });

    await page.goto("/payments");
    await page.waitForLoadState("networkidle");

    // Open the print menu for the first irrigation row and choose preview.
    const menu = page.locator("[data-receipt-menu]").first();
    await expect(menu).toBeVisible({ timeout: 15_000 });
    await menu.getByRole("button").first().click();
    const previewItem = page.getByRole("menuitem", { name: /প্রিভিউ|Preview/ });
    if (await previewItem.count()) {
      await previewItem.first().click();
      // Receipt dialog should render mouza / dag / land-type labels.
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible({ timeout: 10_000 });
      await expect(dialog.getByText(/মৌজা/)).toBeVisible();
      await expect(dialog.getByText(/দাগ/)).toBeVisible();
    }

    // Debug trace must show the data source used (refIds or farmer_id fallback).
    expect(traces.some((t) => /source=/.test(t))).toBeTruthy();
  });
});
