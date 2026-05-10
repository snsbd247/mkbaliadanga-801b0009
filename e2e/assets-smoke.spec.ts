import { test, expect } from "@playwright/test";

/**
 * Asset Lifecycle smoke test.
 * Required env: E2E_BASE_URL, E2E_COMMITTEE_EMAIL, E2E_PASSWORD (admin/super_admin).
 */
const EMAIL = process.env.E2E_COMMITTEE_EMAIL ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";
const skipReason = !EMAIL || !PASSWORD ? "E2E credentials not configured" : null;

test.describe("assets module smoke", () => {
  test.skip(!!skipReason, skipReason ?? "");

  test.beforeEach(async ({ page }) => {
    await page.goto("/auth");
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/admin|dashboard/i, { timeout: 15_000 });
    await page.evaluate(() => localStorage.setItem("lang", "en"));
  });

  test("dashboard, items, reports load and render core labels", async ({ page }) => {
    await page.goto("/assets/dashboard");
    await expect(page.getByText(/Asset Dashboard/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Total Valuation/i)).toBeVisible();

    await page.goto("/assets/items");
    await expect(page.getByText(/Asset Items/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /New asset/i })).toBeVisible();

    await page.goto("/assets/reports");
    await expect(page.getByText(/Asset Reports/i)).toBeVisible({ timeout: 10_000 });
    for (const tab of ["Register", "Stock", "Movement", "Maintenance", "Disposal", "Audit"]) {
      await expect(page.getByRole("tab", { name: new RegExp(tab, "i") })).toBeVisible();
    }
  });

  test("disposal tab shows P/L summary cards", async ({ page }) => {
    await page.goto("/assets/reports");
    await page.getByRole("tab", { name: /Disposal/i }).click();
    await expect(page.getByText(/Sale Total/i)).toBeVisible();
    await expect(page.getByText(/Book Value/i)).toBeVisible();
    await expect(page.getByText(/Net Gain\/Loss/i)).toBeVisible();
  });
});
