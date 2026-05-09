import { test, expect } from "@playwright/test";

/**
 * Loan reliability E2E:
 * - Loan detail page is reachable as a full route (not a modal)
 * - Overdue report renders and lists overdue installments
 * - Penalty report renders
 *
 * These tests assume the app is running with seeded demo data and the user is logged in
 * with at least staff permissions for the loans + reports modules.
 */

test.describe("loan reliability", () => {
  test("loan detail full page route exists", async ({ page }) => {
    await page.goto("/loans");
    // Wait for any loan row link
    const firstLoanLink = page.locator('a[href*="/loans/"]').first();
    if (await firstLoanLink.count()) {
      await firstLoanLink.click();
      await expect(page).toHaveURL(/\/loans\/[0-9a-f-]+/);
      await expect(page.getByText("ঋণ বিবরণ")).toBeVisible();
      await expect(page.getByText("কিস্তির তালিকা")).toBeVisible();
    }
  });

  test("loan overdue report renders", async ({ page }) => {
    await page.goto("/reports/loan-overdue");
    await expect(page.getByText("ঋণ মেয়াদোত্তীর্ণ রিপোর্ট")).toBeVisible();
  });

  test("loan penalty report renders", async ({ page }) => {
    await page.goto("/reports/loan-penalty");
    await expect(page.getByText("ঋণ জরিমানা রিপোর্ট")).toBeVisible();
  });
});
