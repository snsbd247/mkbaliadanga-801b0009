import { test, expect } from "@playwright/test";

/**
 * Farmer Merge screen e2e.
 *
 * Verifies that:
 *  1. The screen calls the `merge_farmers` RPC with the correct source/target IDs.
 *  2. A backend validation error (blocked merge) is surfaced to the user.
 *
 * The RPC endpoint is intercepted so the test never mutates real data. Two real
 * farmers still need to be selectable via search, so provide search terms that
 * each resolve to at least one farmer.
 *
 * Requires E2E_EMAIL / E2E_PASSWORD / E2E_MERGE_SOURCE_Q / E2E_MERGE_TARGET_Q.
 */
test.describe("Farmer Merge", () => {
  test.skip(
    !process.env.E2E_EMAIL ||
      !process.env.E2E_PASSWORD ||
      !process.env.E2E_MERGE_SOURCE_Q ||
      !process.env.E2E_MERGE_TARGET_Q,
    "Set E2E_EMAIL/E2E_PASSWORD/E2E_MERGE_SOURCE_Q/E2E_MERGE_TARGET_Q to run",
  );

  test.beforeEach(async ({ page }) => {
    await page.goto("/auth");
    await page.getByLabel(/email/i).fill(process.env.E2E_EMAIL!);
    await page.getByLabel(/password/i).fill(process.env.E2E_PASSWORD!);
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    await page.waitForURL(/\/(dashboard|admin|farmers)/);
  });

  async function pickFarmer(page: import("@playwright/test").Page, index: number, query: string) {
    const combos = page.getByRole("combobox");
    await combos.nth(index).click();
    await page.getByPlaceholder(/search/i).last().fill(query);
    // First matching option in the listbox.
    await page.getByRole("option").first().click();
  }

  test("calls merge_farmers with correct IDs on confirm", async ({ page }) => {
    let capturedBody: any = null;
    await page.route("**/rest/v1/rpc/merge_farmers", async (route) => {
      capturedBody = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, moved_counts: { lands: 1, irrigation: 2, savings: 3, loans: 0, payments: 4 } }),
      });
    });

    await page.goto("/admin/farmer-merge");
    await pickFarmer(page, 0, process.env.E2E_MERGE_SOURCE_Q!);
    await pickFarmer(page, 1, process.env.E2E_MERGE_TARGET_Q!);

    await page.getByRole("button", { name: /Merge farmers|একত্রিত/i }).click();
    await page.getByRole("button", { name: /Confirm|নিশ্চিত/i }).click();

    await expect(page.getByText(/merged successfully|সফলভাবে একত্রিত/i)).toBeVisible({ timeout: 8_000 });
    expect(capturedBody).toBeTruthy();
    expect(capturedBody._source).toBeTruthy();
    expect(capturedBody._target).toBeTruthy();
    expect(capturedBody._source).not.toEqual(capturedBody._target);
  });

  test("shows backend validation error when merge is blocked", async ({ page }) => {
    await page.route("**/rest/v1/rpc/merge_farmers", async (route) => {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ message: "Only administrators can merge farmers" }),
      });
    });

    await page.goto("/admin/farmer-merge");
    await pickFarmer(page, 0, process.env.E2E_MERGE_SOURCE_Q!);
    await pickFarmer(page, 1, process.env.E2E_MERGE_TARGET_Q!);

    await page.getByRole("button", { name: /Merge farmers|একত্রিত/i }).click();
    await page.getByRole("button", { name: /Confirm|নিশ্চিত/i }).click();

    await expect(page.getByText(/Only administrators can merge farmers/i)).toBeVisible({ timeout: 8_000 });
  });
});
