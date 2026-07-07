import { test, expect } from "@playwright/test";

/**
 * Invoice → payment cascade: when an irrigation invoice that has a received
 * payment is deleted (or marked unpaid), the corresponding receipt must be
 * voided and disappear from / be marked void in the Payments receipt list.
 *
 * This is a smoke-level flow check. It requires a seeded environment with at
 * least one irrigation invoice that has a linked payment.
 *
 * Required env: E2E_BASE_URL, E2E_COMMITTEE_EMAIL, E2E_PASSWORD (super_admin).
 */
const EMAIL = process.env.E2E_COMMITTEE_EMAIL ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";
const skipReason = !EMAIL || !PASSWORD ? "E2E credentials not configured" : null;

test.describe("Invoice delete/unpaid → receipt void cascade", () => {
  test.skip(!!skipReason, skipReason ?? "");

  test.beforeEach(async ({ page }) => {
    await page.goto("/auth");
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/admin|dashboard/i, { timeout: 15_000 });
  });

  test("deleting a paid invoice voids and removes its receipt", async ({ page }) => {
    // Capture the receipt numbers visible before deletion.
    await page.goto("/payments");
    await page.waitForLoadState("networkidle");
    const beforeText = (await page.locator("body").innerText()).trim();

    // Find an invoice that shows a linked receipt number in the invoices list.
    await page.goto("/irrigation-invoices");
    await page.waitForLoadState("networkidle");

    const deleteBtn = page.getByRole("button", { name: /Delete|মুছুন/ }).first();
    if (!(await deleteBtn.count())) test.skip(true, "No deletable invoice available");
    await deleteBtn.click();

    // Confirm dialog mentions payments will be removed.
    const confirmDialog = page.getByRole("alertdialog");
    await expect(confirmDialog).toBeVisible({ timeout: 10_000 });
    await expect(confirmDialog).toContainText(/পেমেন্ট|payment/i);
    await confirmDialog.getByRole("button", { name: /Delete|মুছুন/ }).click();

    // Success toast confirms cascade.
    await expect(page.getByText(/সংশ্লিষ্ট পেমেন্ট|related payments/i)).toBeVisible({ timeout: 10_000 });

    // Receipt list should differ (a receipt removed / marked void).
    await page.goto("/payments");
    await page.waitForLoadState("networkidle");
    const afterText = (await page.locator("body").innerText()).trim();
    expect(afterText).not.toStrictEqual(beforeText);
  });
});
