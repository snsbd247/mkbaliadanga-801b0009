import { test, expect, request } from "@playwright/test";

/**
 * E2E: setting serial-start to exactly 4641 survives a reload and the next
 * minted receipt is 4642.
 *
 * Required env (super admin, since setting the serial is restricted):
 *   E2E_BASE_URL, VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY,
 *   E2E_SUPER_ADMIN_EMAIL, E2E_PASSWORD
 */

const BASE = process.env.E2E_BASE_URL ?? "";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
const EMAIL = process.env.E2E_SUPER_ADMIN_EMAIL ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";

const skipReason =
  !BASE || !SUPABASE_URL || !ANON || !EMAIL || !PASSWORD
    ? "receipt-serial-4641-reload e2e credentials not configured (needs super admin)"
    : null;

async function apiToken(api: any) {
  const res = await api.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: ANON, "Content-Type": "application/json" },
    data: { email: EMAIL, password: PASSWORD },
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
  return Number((await res.json())?.[0]?.last_no ?? 0) || 0;
}

async function login(page: any) {
  await page.goto("/auth");
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/admin|dashboard/i, { timeout: 15_000 });
}

test.describe("Receipt serial — 4641 persists on reload, next is 4642", () => {
  test.skip(!!skipReason, skipReason ?? "");

  test("save 4641 -> reload keeps 4641 -> next receipt is 4642", async ({ page }) => {
    const api = await request.newContext();
    const token = await apiToken(api);
    // 4641 must be >= current last issued serial, otherwise the guard rejects it.
    const last = await serialLast(api, token);
    test.skip(last > 4641, `current serial (${last}) already past 4641 in this environment`);

    await login(page);
    await page.goto("/admin/receipt-template");

    const input = page.getByTestId("serial-start-input");
    await expect(input).toBeVisible();
    await input.fill("4641");
    await page.getByRole("button", { name: /save/i }).click();

    await expect(page.getByText(/পরবর্তী রিসিপ্ট হবে 4642/)).toBeVisible({ timeout: 15_000 });

    // Reload — the persisted value must still be 4641.
    await page.reload();
    await expect(page.getByTestId("serial-start-input")).toHaveValue("4641");

    // The next minted serial must be exactly 4642.
    const mint = await api.post(`${SUPABASE_URL}/rest/v1/rpc/next_unified_receipt_no`, {
      headers: { apikey: ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      data: { p_office_id: null },
    });
    expect(mint.ok()).toBeTruthy();
    expect(Number(await mint.json())).toBe(4642);
  });
});
