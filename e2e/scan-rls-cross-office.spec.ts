import { test, expect } from "@playwright/test";

/**
 * Verifies that scanning an account_number that belongs to a different office
 * is rejected by RLS — the lookup must NOT redirect to /payments and the user
 * must see the standard "not found in your office" error.
 *
 * Requires:
 *   E2E_EMAIL / E2E_PASSWORD                 — user A (logged in)
 *   E2E_FOREIGN_ACCOUNT_NUMBER               — a real account_number that
 *                                              exists but belongs to a
 *                                              different office than user A
 */
test.describe("RLS: cross-office QR scan is rejected", () => {
  test.skip(
    !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD || !process.env.E2E_FOREIGN_ACCOUNT_NUMBER,
    "Set E2E_EMAIL/E2E_PASSWORD/E2E_FOREIGN_ACCOUNT_NUMBER to run cross-office scan e2e",
  );

  test.beforeEach(async ({ page }) => {
    await page.goto("/auth");
    await page.getByLabel(/email/i).fill(process.env.E2E_EMAIL!);
    await page.getByLabel(/password/i).fill(process.env.E2E_PASSWORD!);
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    await page.waitForURL(/\/(dashboard|admin|farmers)/);
  });

  test("foreign-office account in URL stays on /scan with error", async ({ page }) => {
    await page.goto(`/scan?acc=${process.env.E2E_FOREIGN_ACCOUNT_NUMBER}`);
    await expect(page.getByText(/Account number not found/i)).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/scan/);
  });

  test("manual lookup of foreign-office account is rejected", async ({ page }) => {
    await page.goto(`/scan`);
    await page.getByPlaceholder("2401510064476").fill(process.env.E2E_FOREIGN_ACCOUNT_NUMBER!);
    await page.getByRole("button", { name: /Open Payment Screen/i }).click();
    await expect(page.getByText(/Account number not found/i)).toBeVisible({ timeout: 5_000 });
    await expect(page).not.toHaveURL(/\/payments/);
  });
});
