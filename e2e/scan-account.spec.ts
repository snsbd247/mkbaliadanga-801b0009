import { test, expect } from "@playwright/test";

/**
 * Verifies that /scan?acc=<account_number> resolves to the payment screen for a
 * valid account number scoped to the user's office, and shows a clear error
 * for unknown account numbers (RLS / not-found).
 *
 * Requires E2E_EMAIL / E2E_PASSWORD / E2E_ACCOUNT_NUMBER env vars at runtime.
 */
test.describe("scan?acc account-number flow", () => {
  test.skip(
    !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD || !process.env.E2E_ACCOUNT_NUMBER,
    "Set E2E_EMAIL/E2E_PASSWORD/E2E_ACCOUNT_NUMBER to run scan e2e",
  );

  test.beforeEach(async ({ page }) => {
    await page.goto("/auth");
    await page.getByLabel(/email/i).fill(process.env.E2E_EMAIL!);
    await page.getByLabel(/password/i).fill(process.env.E2E_PASSWORD!);
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    await page.waitForURL(/\/(dashboard|admin|farmers)/);
  });

  test("valid account number redirects to payments", async ({ page }) => {
    await page.goto(`/scan?acc=${process.env.E2E_ACCOUNT_NUMBER}`);
    await page.waitForURL(/\/payments\?farmer=/, { timeout: 10_000 });
    await expect(page).toHaveURL(/\/payments\?farmer=/);
  });

  test("unknown account number shows error and stays on /scan", async ({ page }) => {
    await page.goto(`/scan?acc=0000000000000`);
    // Sonner toast contains the not-found message.
    await expect(page.getByText(/Account number not found/i)).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/scan/);
  });

  test("manual lookup with invalid token shows error", async ({ page }) => {
    await page.goto(`/scan`);
    await page.getByPlaceholder("2401510064476").fill("0000000000000");
    await page.getByRole("button", { name: /Open Payment Screen/i }).click();
    await expect(page.getByText(/Account number not found/i)).toBeVisible({ timeout: 5_000 });
  });

  test("missing acc parameter stays on /scan with no redirect", async ({ page }) => {
    await page.goto(`/scan`);
    await expect(page).toHaveURL(/\/scan$/);
    // Manual input area should be visible
    await expect(page.getByPlaceholder("2401510064476")).toBeVisible();
  });
});
