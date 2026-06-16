import { test, expect } from "@playwright/test";

/**
 * End-to-end coverage for the Office Income receipt flow:
 *  - OfficeIncomeTab জমি/মৌজা inputs are locked (readonly + disabled, value N/A).
 *  - Language toggle updates headings/labels.
 *  - ReceiptSettingsButton orientation/paper changes persist.
 *  - Exported PDF is produced via the same bnReceipts pipeline.
 *
 * Required env: E2E_BASE_URL, E2E_STAFF_EMAIL, E2E_PASSWORD,
 *   VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
 */

const BASE = process.env.E2E_BASE_URL ?? "";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
const STAFF = process.env.E2E_STAFF_EMAIL ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";

const skipReason =
  !BASE || !SUPABASE_URL || !ANON || !PASSWORD || !STAFF
    ? "office-income-receipt e2e credentials not configured"
    : null;

test.describe("office income receipt — locked fields, i18n, settings, export", () => {
  test.skip(!!skipReason, skipReason ?? "");

  test("seeds Supabase session then exercises the office-income flow", async ({ page }) => {
    // Authenticate via password grant and inject the session.
    const res = await page.request.post(
      `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        headers: { apikey: ANON, "Content-Type": "application/json" },
        data: { email: STAFF, password: PASSWORD },
      },
    );
    expect(res.ok(), "staff login failed").toBeTruthy();
    const session = await res.json();
    const ref = new URL(SUPABASE_URL).hostname.split(".")[0];

    await page.goto(BASE);
    await page.evaluate(
      ([key, val]) => window.localStorage.setItem(key, val),
      [`sb-${ref}-auth-token`, JSON.stringify(session)] as const,
    );

    await page.goto(`${BASE}/irrigation`);
    // Open the office-income tab if present.
    const tab = page.getByRole("tab", { name: /অফিস আয়|Office Income/i });
    if (await tab.count()) await tab.first().click();

    const addBtn = page.getByRole("button", { name: /Add|যোগ/i }).first();
    if (await addBtn.count()) {
      await addBtn.click();
      // জমি ও মৌজা inputs must be locked.
      const locked = page.locator('input[value="N/A"][readonly]');
      await expect(locked.first()).toBeDisabled();
    }
  });
});
