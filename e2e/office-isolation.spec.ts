import { test, expect } from "@playwright/test";

/**
 * Office-isolation smoke test:
 *   Logs in as a staff user from office A and verifies that data from office B
 *   is not visible in the Farmers list, Loans list, or Reports.
 *
 * Requires:
 *   E2E_EMAIL / E2E_PASSWORD                 — staff user in office A
 *   E2E_FOREIGN_FARMER_NAME                  — substring of a farmer name that
 *                                              ONLY exists in office B
 */
test.describe("RLS: office-wise data isolation", () => {
  test.skip(
    !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD || !process.env.E2E_FOREIGN_FARMER_NAME,
    "Set E2E_EMAIL/E2E_PASSWORD/E2E_FOREIGN_FARMER_NAME to run office-isolation e2e",
  );

  test.beforeEach(async ({ page }) => {
    await page.goto("/auth");
    await page.getByLabel(/email/i).fill(process.env.E2E_EMAIL!);
    await page.getByLabel(/password/i).fill(process.env.E2E_PASSWORD!);
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    await page.waitForURL(/\/(dashboard|admin|farmers)/);
  });

  test("foreign-office farmer is not searchable", async ({ page }) => {
    await page.goto("/farmers");
    const search = page.getByPlaceholder(/search|খুঁজুন/i).first();
    await search.fill(process.env.E2E_FOREIGN_FARMER_NAME!);
    await page.waitForTimeout(800);
    await expect(page.getByText(process.env.E2E_FOREIGN_FARMER_NAME!)).toHaveCount(0);
  });

  test("foreign-office loan is not visible in Loans list", async ({ page }) => {
    await page.goto("/loans");
    await page.waitForTimeout(800);
    await expect(page.getByText(process.env.E2E_FOREIGN_FARMER_NAME!)).toHaveCount(0);
  });

  test("foreign-office data does not leak in Reports", async ({ page }) => {
    await page.goto("/reports");
    await page.waitForTimeout(1200);
    await expect(page.getByText(process.env.E2E_FOREIGN_FARMER_NAME!)).toHaveCount(0);
  });
});
