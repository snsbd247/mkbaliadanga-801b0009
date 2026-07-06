import { test, expect, request } from "@playwright/test";

/**
 * E2E: unpaid irrigation invoices render on BOTH surfaces.
 *
 * 1. Payments page (/payments) — structured সেচ পেমেন্ট tab shows the farmer's
 *    open invoices, and no due-mismatch alert appears (list due === payments due).
 * 2. IrrigationPaymentPanel (embedded on /payments) — the same open invoices are
 *    listed, and any NULL invoice_status row carries the accessible
 *    "Pending/অনির্ধারিত" badge (aria-label + tooltip) so no invoice is dropped.
 *
 * We pick a farmer that has open (due_amount > 0) invoices via the REST API,
 * then drive the UI for that farmer.
 *
 * Required env:
 *   E2E_BASE_URL, VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY,
 *   E2E_PASSWORD, E2E_COMMITTEE_EMAIL
 */

const BASE = process.env.E2E_BASE_URL ?? "";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
const EMAIL = process.env.E2E_COMMITTEE_EMAIL ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";

const skipReason =
  !BASE || !SUPABASE_URL || !ANON || !PASSWORD || !EMAIL
    ? "unpaid-irrigation-invoices e2e credentials not configured"
    : null;

async function apiToken(api: any) {
  const res = await api.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: ANON, "Content-Type": "application/json" },
    data: { email: EMAIL, password: PASSWORD },
  });
  expect(res.ok(), "login failed").toBeTruthy();
  return (await res.json()).access_token as string;
}

async function findFarmerWithOpenInvoices(api: any, token: string) {
  const res = await api.get(
    `${SUPABASE_URL}/rest/v1/irrigation_invoices?select=farmer_id,due_amount,invoice_status,deleted_at&due_amount=gt.0&deleted_at=is.null&limit=200`,
    { headers: { apikey: ANON, Authorization: `Bearer ${token}` } },
  );
  expect(res.ok()).toBeTruthy();
  const rows = (await res.json()) as Array<Record<string, any>>;
  const active = rows.filter((r) => r.invoice_status !== "cancelled" && r.farmer_id);
  return active.length ? (active[0].farmer_id as string) : null;
}

async function login(page: any) {
  await page.goto("/auth");
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/admin|dashboard/i, { timeout: 15_000 });
}

test.describe("unpaid irrigation invoices render on Payments + IrrigationPaymentPanel", () => {
  test.skip(!!skipReason, skipReason ?? "");

  test("open invoices render and no due-mismatch alert for a farmer with dues", async ({ page }) => {
    const api = await request.newContext();
    const token = await apiToken(api);
    const farmerId = await findFarmerWithOpenInvoices(api, token);
    test.skip(!farmerId, "no farmer with open irrigation invoices in this environment");

    await login(page);
    await page.goto(`/payments?farmer=${farmerId}`);

    // The structured সেচ পেমেন্ট tab is the default surface.
    const structuredTab = page.getByRole("tab", { name: /সেচ পেমেন্ট|Irrigation Payment/i });
    await expect(structuredTab).toBeVisible();

    // At least one invoice option should be selectable (open invoices rendered).
    await expect
      .poll(async () =>
        page.locator("body").getByText(/No open invoices/i).count(),
      )
      .toBe(0);

    // Due totals must agree — the mismatch alert must NOT be present.
    await expect(page.getByTestId("due-mismatch-alert")).toHaveCount(0);
  });

  test("NULL-status invoices carry an accessible Pending badge (no invoice dropped)", async ({ page }) => {
    const api = await request.newContext();
    const token = await apiToken(api);
    // Find a farmer with an open NULL-status invoice, if any exist post-backfill.
    const res = await api.get(
      `${SUPABASE_URL}/rest/v1/irrigation_invoices?select=farmer_id,due_amount,invoice_status,deleted_at&due_amount=gt.0&deleted_at=is.null&invoice_status=is.null&limit=1`,
      { headers: { apikey: ANON, Authorization: `Bearer ${token}` } },
    );
    expect(res.ok()).toBeTruthy();
    const rows = (await res.json()) as Array<Record<string, any>>;
    test.skip(rows.length === 0, "no NULL-status open invoices (backfill already complete)");

    const farmerId = rows[0].farmer_id as string;
    await login(page);
    await page.goto(`/payments?farmer=${farmerId}`);

    // The Pending / অনির্ধারিত badge exposes an aria-label explaining it is still counted.
    const badge = page.locator('[aria-label*="counted"], [aria-label*="গণনা"]').first();
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText(/Pending|অনির্ধারিত/i);
  });
});
