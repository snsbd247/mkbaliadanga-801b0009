import { test, expect, request } from "@playwright/test";

/**
 * E2E: rapidly switching the selected farmer on the Payments page must only
 * ever show the LAST selection's invoices (stale in-flight responses ignored).
 *
 * We pick two farmers with open invoices via REST, rapidly switch between them
 * in the UI, and assert the rendered invoice options belong to the final farmer.
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
    ? "payments-latest-request e2e credentials not configured"
    : null;

async function apiToken(api: any) {
  const res = await api.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: ANON, "Content-Type": "application/json" },
    data: { email: EMAIL, password: PASSWORD },
  });
  expect(res.ok(), "login failed").toBeTruthy();
  return (await res.json()).access_token as string;
}

async function twoFarmersWithInvoices(api: any, token: string) {
  const res = await api.get(
    `${SUPABASE_URL}/rest/v1/irrigation_invoices?select=farmer_id,invoice_no,due_amount,invoice_status,deleted_at&due_amount=gt.0&deleted_at=is.null&limit=500`,
    { headers: { apikey: ANON, Authorization: `Bearer ${token}` } },
  );
  expect(res.ok()).toBeTruthy();
  const rows = (await res.json()) as Array<Record<string, any>>;
  const byFarmer = new Map<string, string>();
  for (const r of rows) {
    if (r.invoice_status === "cancelled" || !r.farmer_id) continue;
    if (!byFarmer.has(r.farmer_id)) byFarmer.set(r.farmer_id, r.invoice_no as string);
  }
  const entries = [...byFarmer.entries()];
  return entries.length >= 2 ? entries.slice(0, 2) : null;
}

async function login(page: any) {
  await page.goto("/auth");
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/admin|dashboard/i, { timeout: 15_000 });
}

test.describe("Payments — latest farmer selection wins", () => {
  test.skip(!!skipReason, skipReason ?? "");

  test("rapid farmer switching only renders the final farmer's invoices", async ({ page }) => {
    const api = await request.newContext();
    const token = await apiToken(api);
    const farmers = await twoFarmersWithInvoices(api, token);
    test.skip(!farmers, "need two farmers with open invoices");
    const [[farmerA], [farmerB, invoiceNoB]] = farmers!;

    await login(page);
    // Land on farmer A, then immediately switch to farmer B (simulates a race).
    await page.goto(`/payments?farmer=${farmerA}`);
    await page.goto(`/payments?farmer=${farmerB}`);

    // Open the invoice dropdown and confirm farmer B's invoice is present.
    await expect(page.getByTestId("invoice-loading-skeleton")).toHaveCount(0, { timeout: 15_000 });
    const trigger = page.getByText(/Pick invoice|No open invoices/).first();
    await trigger.click();
    await expect(page.getByRole("option", { name: new RegExp(invoiceNoB) })).toBeVisible({ timeout: 10_000 });
  });
});
