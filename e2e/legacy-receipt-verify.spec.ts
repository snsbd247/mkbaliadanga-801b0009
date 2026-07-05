import { test, expect } from "@playwright/test";

/**
 * Legacy সেচ receipt QR verification.
 * Scanning a printed QR routes to /verify/legacy-{receiptNo}, which must call
 * the public Laravel route GET /api/legacy-irrigation/verify/{receiptNo} and
 * render the receipt data instead of an error.
 *
 * Optional env: E2E_LEGACY_RECEIPT_NO (defaults to 1677).
 */
const RECEIPT_NO = process.env.E2E_LEGACY_RECEIPT_NO ?? "1677";

test.describe("Legacy receipt QR verification", () => {
  test("loads receipt data for a valid legacy token", async ({ page }) => {
    // Stub the public backend route so the test does not depend on live data.
    await page.route(`**/api/legacy-irrigation/verify/${RECEIPT_NO}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          company: { name_bn: "মোহাম্মদ খানী", name: "Mohammad Khani" },
          office: "প্রধান কার্যালয়",
          receipt: {
            receipt_no: RECEIPT_NO,
            date: new Date().toISOString(),
            kind: "irrigation",
            status: "approved",
            amount: 1500,
            method: null,
            note: "মৌসুম: 2024",
          },
          farmer: { name: "করিম মিয়া", member_no: "L-1677", village: "বালিয়াডাঙ্গা", mobile_masked: "017*****88" },
        }),
      })
    );

    await page.goto(`/verify/legacy-${RECEIPT_NO}`);

    await expect(page.getByText(RECEIPT_NO, { exact: false })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("করিম মিয়া")).toBeVisible();
    // The error state must NOT be shown.
    await expect(page.getByText(/যাচাই ব্যর্থ|Verification failed/)).toHaveCount(0);
  });

  test("shows a helpful error with token + retry for an unknown legacy token", async ({ page }) => {
    await page.route("**/api/legacy-irrigation/verify/**", (route) =>
      route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "Legacy receipt not found: 999999" }),
      })
    );

    await page.goto("/verify/legacy-999999");

    await expect(page.getByText(/legacy-999999/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: /আবার চেষ্টা|Try again/ })).toBeVisible();
  });
});
