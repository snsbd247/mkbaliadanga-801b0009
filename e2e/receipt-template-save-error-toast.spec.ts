import { test, expect } from "@playwright/test";

/**
 * E2E: when saving the Receipt Template serial fails (RPC unreachable), the
 * admin sees a clear error toast AND an actionable "what to do" message
 * ("কয়েক সেকেন্ড পর আবার চেষ্টা করুন, অথবা অ্যাপটি নতুন করে publish/deploy করুন।").
 *
 * We force the failure deterministically by aborting the serial-check RPC so
 * the pre-flight probe fails regardless of backend state.
 *
 * Required env: E2E_BASE_URL, E2E_SUPER_ADMIN_EMAIL, E2E_PASSWORD
 */

const BASE = process.env.E2E_BASE_URL ?? "";
const EMAIL = process.env.E2E_SUPER_ADMIN_EMAIL ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";

const skipReason =
  !BASE || !EMAIL || !PASSWORD
    ? "receipt-template-save-error-toast e2e credentials not configured (needs super admin)"
    : null;

async function login(page: any) {
  await page.goto("/auth");
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/admin|dashboard/i, { timeout: 15_000 });
}

test.describe("Receipt Template — save failure shows error toast + guidance", () => {
  test.skip(!!skipReason, skipReason ?? "");

  test("aborting the serial RPC surfaces an actionable error toast", async ({ page }) => {
    await login(page);

    // Force the serial-check / set RPCs to fail so the pre-flight probe errors.
    await page.route(/\/rest\/v1\/rpc\/(check_receipt_serial|admin_set_receipt_serial_start|next_serial_receipt_no)/, (route: any) =>
      route.abort(),
    );

    await page.goto("/admin/receipt-template");
    const input = page.getByTestId("serial-start-input");
    await expect(input).toBeVisible();

    // Change to a value that differs from the saved one so a serial change is triggered.
    await input.fill("4641");
    await page.getByRole("button", { name: /save/i }).click();

    // The guidance description must be present and tell the user what to do.
    await expect(
      page.getByText(/আবার চেষ্টা করুন|publish\/deploy/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});
