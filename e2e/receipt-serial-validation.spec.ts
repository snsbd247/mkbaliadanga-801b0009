import { test, expect } from "@playwright/test";

/**
 * E2E: the admin "শুরুর ক্রমিক নম্বর" (receipt start serial) field shows the
 * correct bilingual (Bangla + English) validation errors for non-numeric,
 * negative and empty input, and disables Save while invalid. Conflicting-range
 * rejection is enforced server-side (see receipt-serial-conflict handling in
 * admin_set_receipt_serial_start) and surfaced as a toast.
 *
 * Required env:
 *   E2E_BASE_URL, E2E_SUPERADMIN_EMAIL (or E2E_COMMITTEE_EMAIL), E2E_PASSWORD,
 *   VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
 */

const BASE = process.env.E2E_BASE_URL ?? "";
const EMAIL = process.env.E2E_SUPERADMIN_EMAIL ?? process.env.E2E_COMMITTEE_EMAIL ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";

const skipReason =
  !BASE || !EMAIL || !PASSWORD || !SUPABASE_URL || !ANON
    ? "receipt-serial-validation e2e credentials not configured"
    : null;

async function login(page: any) {
  await page.goto(`${BASE}/auth`);
  await page.getByLabel(/email|ইমেইল|username|ইউজার/i).first().fill(EMAIL);
  await page.getByLabel(/password|পাসওয়ার্ড/i).first().fill(PASSWORD);
  await page.getByRole("button", { name: /sign in|login|লগ ?ইন|প্রবেশ/i }).first().click();
  await page.waitForLoadState("networkidle");
}

test.describe("receipt start serial validation", () => {
  test.skip(!!skipReason, skipReason ?? "");

  test("shows bilingual errors and blocks save for invalid values", async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/admin/receipt-template`);

    const input = page.getByTestId("serial-start-input");
    const error = page.getByTestId("serial-start-error");
    const save = page.getByRole("button", { name: /save/i });

    // Empty
    await input.fill("");
    await expect(error).toContainText("শুরুর ক্রমিক নম্বর");
    await expect(error).toContainText("required");
    await expect(save).toBeDisabled();

    // Non-numeric
    await input.fill("abc12");
    await expect(error).toContainText("ধনাত্মক পূর্ণসংখ্যা");
    await expect(error).toContainText("positive whole numbers");
    await expect(save).toBeDisabled();

    // Negative
    await input.fill("-5");
    await expect(error).toContainText("ঋণাত্মক");
    await expect(error).toContainText("negative");
    await expect(save).toBeDisabled();

    // Valid value clears the error and re-enables save
    await input.fill("999999");
    await expect(page.getByTestId("serial-start-error")).toHaveCount(0);
    await expect(save).toBeEnabled();
  });
});
