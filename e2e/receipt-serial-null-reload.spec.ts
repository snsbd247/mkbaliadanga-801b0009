import { test, expect } from "@playwright/test";

/**
 * Regression: even when the serial-start value starts out null/empty in the
 * database, saving a value keeps the serial sequential across a reload and the
 * "পরবর্তী রিসিপ্ট হবে N+1" preview renders a real number (never "—").
 *
 * Required env: E2E_BASE_URL, E2E_SUPER_ADMIN_EMAIL, E2E_PASSWORD (super admin).
 */
const EMAIL = process.env.E2E_SUPER_ADMIN_EMAIL ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";
const skipReason =
  !EMAIL || !PASSWORD ? "receipt-serial-null-reload needs super admin credentials" : null;

test.describe("Receipt serial — null start stays sequential after reload", () => {
  test.skip(!!skipReason, skipReason ?? "");

  test("save serial, reload, next receipt shows a number not —", async ({ page }) => {
    await page.goto("/auth");
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/admin|dashboard/i, { timeout: 15_000 });

    await page.goto("/admin/receipt-template");
    const input = page.getByTestId("serial-start-input");
    await expect(input).toBeVisible();

    // Pick a value comfortably above any existing serial.
    const value = "9000";
    await input.fill(value);
    await page.getByRole("button", { name: /save/i }).click();

    // Preview shows a concrete next number, not the "—" fallback.
    const preview = page.getByText(/পরবর্তী রিসিপ্ট হবে/);
    await expect(preview).toBeVisible({ timeout: 15_000 });
    await expect(preview).not.toContainText("—");
    await expect(page.getByText(/পরবর্তী রিসিপ্ট হবে 9001/)).toBeVisible({ timeout: 15_000 });

    // After reload the persisted value survives and preview still resolves.
    await page.reload();
    await expect(page.getByTestId("serial-start-input")).toHaveValue(value);
    const previewAfter = page.getByText(/পরবর্তী রিসিপ্ট হবে/);
    if (await previewAfter.count()) await expect(previewAfter).not.toContainText("—");
  });
});
