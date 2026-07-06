import { test, expect, request } from "@playwright/test";

/**
 * E2E: the invoice details modal shows a read-only empty-state when the selected
 * invoice has no transactions.
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
    ? "invoice-details-empty-state e2e credentials not configured"
    : null;

async function apiToken(api: any) {
  const res = await api.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: ANON, "Content-Type": "application/json" },
    data: { email: EMAIL, password: PASSWORD },
  });
  expect(res.ok(), "login failed").toBeTruthy();
  return (await res.json()).access_token as string;
}

async function farmerWithInvoiceNoPayments(api: any, token: string) {
  const res = await api.get(
    `${SUPABASE_URL}/rest/v1/irrigation_invoices?select=id,farmer_id,paid_amount,due_amount,invoice_status,deleted_at&due_amount=gt.0&deleted_at=is.null&paid_amount=eq.0&limit=50`,
    { headers: { apikey: ANON, Authorization: `Bearer ${token}` } },
  );
  expect(res.ok()).toBeTruthy();
  const rows = (await res.json()) as Array<Record<string, any>>;
  const row = rows.find((r) => r.invoice_status !== "cancelled" && r.farmer_id);
  return row ? (row.farmer_id as string) : null;
}

async function login(page: any) {
  await page.goto("/auth");
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/admin|dashboard/i, { timeout: 15_000 });
}

test.describe("Payments — invoice details empty-state", () => {
  test.skip(!!skipReason, skipReason ?? "");

  test("shows read-only empty-state when the invoice has no transactions", async ({ page }) => {
    const api = await request.newContext();
    const token = await apiToken(api);
    const farmerId = await farmerWithInvoiceNoPayments(api, token);
    test.skip(!farmerId, "no unpaid invoice without payments available");

    await login(page);
    await page.goto(`/payments?farmer=${farmerId}`);
    await expect(page.getByTestId("invoice-loading-skeleton")).toHaveCount(0, { timeout: 15_000 });

    // Pick the first invoice, then open details.
    await page.getByText(/Pick invoice/).first().click();
    await page.getByRole("option").first().click();
    await page.getByRole("button", { name: /View details|বিস্তারিত/ }).click();

    const modal = page.getByTestId("invoice-details-modal");
    await expect(modal).toBeVisible();
    await expect(page.getByTestId("invoice-no-transactions")).toBeVisible();
  });
});
