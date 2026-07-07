import { test, expect, request } from "@playwright/test";

/**
 * E2E: Receipt Template permission + persistence.
 *
 *  1. super_admin: saving a serial start N makes the UI reflect the saved value
 *     and the next minted receipt equals N + 1.
 *  2. non-super (staff/admin): the page is restricted — the save form is not
 *     shown and a clear localized permission message appears instead.
 *
 * Required env:
 *   E2E_BASE_URL, VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, E2E_PASSWORD,
 *   E2E_SUPER_ADMIN_EMAIL, and (for the restriction case) E2E_STAFF_EMAIL.
 */

const BASE = process.env.E2E_BASE_URL ?? "";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";
const SUPER_EMAIL = process.env.E2E_SUPER_ADMIN_EMAIL ?? "";
const STAFF_EMAIL = process.env.E2E_STAFF_EMAIL ?? "";

const superSkip =
  !BASE || !SUPABASE_URL || !ANON || !PASSWORD || !SUPER_EMAIL
    ? "receipt-template-permission-persistence e2e credentials not configured (needs super admin)"
    : null;

async function login(page: any, email: string) {
  await page.goto("/auth");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/admin|dashboard/i, { timeout: 15_000 });
}

async function apiToken(api: any, email: string) {
  const res = await api.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: ANON, "Content-Type": "application/json" },
    data: { email, password: PASSWORD },
  });
  expect(res.ok(), "login failed").toBeTruthy();
  return (await res.json()).access_token as string;
}

async function serialLast(api: any, token: string): Promise<number> {
  const res = await api.get(
    `${SUPABASE_URL}/rest/v1/receipt_counters?kind=eq.SERIAL&year=eq.0&select=last_no`,
    { headers: { apikey: ANON, Authorization: `Bearer ${token}` } },
  );
  expect(res.ok()).toBeTruthy();
  const rows = await res.json();
  return Number(rows?.[0]?.last_no ?? 0) || 0;
}

test.describe("Receipt Template — permission + persistence", () => {
  test.skip(!!superSkip, superSkip ?? "");

  test("super_admin: save persists serial and next receipt is N+1", async ({ page }) => {
    const api = await request.newContext();
    const token = await apiToken(api, SUPER_EMAIL);
    const start = (await serialLast(api, token)) + 100; // strictly above last issued

    await login(page, SUPER_EMAIL);
    await page.goto("/admin/receipt-template");

    const input = page.getByTestId("serial-start-input");
    await expect(input).toBeVisible();
    await input.fill(String(start));
    await page.getByRole("button", { name: /save/i }).click();

    // Success toast announces the next receipt = N + 1 (bilingual string).
    await expect(page.getByText(new RegExp(`পরবর্তী রিসিপ্ট হবে ${start + 1}`))).toBeVisible({
      timeout: 15_000,
    });

    // Reload and confirm the UI reflects the persisted serial start.
    await page.reload();
    await expect(page.getByTestId("serial-start-input")).toHaveValue(String(start));

    // The next minted serial equals start + 1.
    const mint = await api.post(`${SUPABASE_URL}/rest/v1/rpc/next_unified_receipt_no`, {
      headers: { apikey: ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      data: { p_office_id: null },
    });
    expect(mint.ok()).toBeTruthy();
    expect(Number(await mint.json())).toBe(start + 1);
  });

  test("non-super: page is restricted with a permission message", async ({ page }) => {
    test.skip(!STAFF_EMAIL, "E2E_STAFF_EMAIL not configured");
    await login(page, STAFF_EMAIL);
    await page.goto("/admin/receipt-template");

    // The save form must NOT be reachable for non-super users.
    await expect(page.getByTestId("serial-start-input")).toHaveCount(0);
    await expect(
      page.getByText(/restricted to super administrators|সুপার অ্যাডমিন/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});
