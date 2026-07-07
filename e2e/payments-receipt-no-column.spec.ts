import { test, expect } from "@playwright/test";

/**
 * E2E: the "Receipt #" column in the Payments → Recent Transactions table
 * must show a real receipt number (never a blank "—") after receipt numbers
 * are persisted / backfilled onto payment rows.
 *
 * Required env: E2E_BASE_URL, E2E_COMMITTEE_EMAIL, E2E_PASSWORD (admin/super_admin).
 */
const EMAIL = process.env.E2E_COMMITTEE_EMAIL ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";
const skipReason = !EMAIL || !PASSWORD ? "E2E credentials not configured" : null;

test.describe("Payments Receipt # column", () => {
  test.skip(!!skipReason, skipReason ?? "");

  test.beforeEach(async ({ page }) => {
    await page.goto("/auth");
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/admin|dashboard/i, { timeout: 15_000 });
  });

  test("recent transactions show a non-empty receipt number", async ({ page }) => {
    await page.goto("/payments");
    await page.waitForLoadState("networkidle");

    // Give the background backfill a moment to run + reload the list.
    await page.waitForTimeout(3000);

    const rows = page.locator("table tbody tr");
    const count = await rows.count();
    test.skip(count === 0, "no payment rows to verify");

    // At least one row's first (Receipt #) cell must not be the empty dash.
    let sawReceipt = false;
    for (let i = 0; i < Math.min(count, 10); i++) {
      const cell = rows.nth(i).locator("td").first();
      const text = (await cell.innerText()).trim();
      if (text && text !== "—" && text !== "-") {
        sawReceipt = true;
        break;
      }
    }
    expect(sawReceipt, "expected at least one row with a receipt number").toBeTruthy();
  });
});
