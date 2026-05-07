import { test, expect } from "@playwright/test";

/**
 * Verifies that Ctrl/Cmd+K focuses the global header MenuSearch input.
 * Required env: E2E_BASE_URL, E2E_COMMITTEE_EMAIL (or E2E_STAFF_EMAIL), E2E_PASSWORD
 */
const EMAIL = process.env.E2E_COMMITTEE_EMAIL ?? process.env.E2E_STAFF_EMAIL ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";
const skipReason = (!EMAIL || !PASSWORD) ? "E2E credentials not configured" : null;

test.describe("Menu Search Ctrl+K shortcut", () => {
  test.skip(!!skipReason, skipReason ?? "");

  test.beforeEach(async ({ page }) => {
    await page.goto("/auth");
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/admin|dashboard/i, { timeout: 15_000 });
  });

  test("Ctrl+K focuses the header menu search input", async ({ page }) => {
    await page.goto("/admin");
    const search = page.getByRole("textbox", { name: /search.*menu|মেনু/i }).first();
    await expect(search).toBeVisible();

    // Ensure focus is elsewhere
    await page.locator("body").click();
    await expect(search).not.toBeFocused();

    await page.keyboard.press("Control+K");
    await expect(search).toBeFocused();
  });

  test("Cmd+K focuses the header menu search input (mac)", async ({ page }) => {
    await page.goto("/admin");
    const search = page.getByRole("textbox", { name: /search.*menu|মেনু/i }).first();
    await page.locator("body").click();
    await page.keyboard.press("Meta+K");
    await expect(search).toBeFocused();
  });
});
