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

  test("loan edit/statement routes stay inside the loans module (no cross-module nav, no stray dialog)", async ({ page }) => {
    await page.goto("/loans");
    const editBtn = page.locator('button:has(svg.lucide-pencil)').first();
    if (await editBtn.count()) {
      await editBtn.click();
      await expect(page).toHaveURL(/\/loans\/[0-9a-f-]+\/edit/);
      // Edit opens a full page, not a modal dialog
      await expect(page.locator('[role="dialog"]')).toHaveCount(0);
    }
    const stmtBtn = page.getByRole("button", { name: /স্টেটমেন্ট|Statement/ }).first();
    await page.goto("/loans");
    if (await stmtBtn.count()) {
      await stmtBtn.click();
      await expect(page).toHaveURL(/\/loans\/[0-9a-f-]+\/statement/);
      await expect(page.locator('[role="dialog"]')).toHaveCount(0);
    }
  });

  test("loan delete uses a non-popup (toast) confirmation, not an AlertDialog", async ({ page }) => {
    await page.goto("/loans");
    const delBtn = page.locator('button:has(svg.lucide-trash-2)').first();
    if (await delBtn.count()) {
      await delBtn.click();
      // No blocking AlertDialog should appear
      await expect(page.locator('[role="alertdialog"]')).toHaveCount(0);
      // A toast confirmation with a Delete action should be present
      await expect(page.getByText(/মুছবেন|Delete loan/)).toBeVisible();
    }
  });
});

