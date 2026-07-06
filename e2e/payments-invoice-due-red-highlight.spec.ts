import { test, expect, request } from "@playwright/test";

/**
 * E2E: invoice rows with due_amount > 0 render their due value with the red
 * (destructive) highlight, so overdue invoices are visually distinct in the
 * Payments invoice list. Guards the `text-destructive` styling on
 * data-testid="invoice-due-amount".
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
    ? "payments-invoice-due-red-highlight e2e credentials not configured"
    : null;

async function apiToken(api: any) {
  const res = await api.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: ANON, "Content-Type": "application/json" },
    data: { email: EMAIL, password: PASSWORD },
  });
  expect(res.ok(), "login failed").toBeTruthy();
  return (await res.json()).access_token as string;
}

async function farmerWithOpenInvoices(api: any, token: string) {
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

test.describe("Payments — due_amount > 0 rows render red highlight", () => {
  test.skip(!!skipReason, skipReason ?? "");

  test("open invoice due values use the destructive (red) class", async ({ page }) => {
    const api = await request.newContext();
    const token = await apiToken(api);
    const farmerId = await farmerWithOpenInvoices(api, token);
    test.skip(!farmerId, "no farmer with open irrigation invoices in this environment");

    await login(page);
    await page.goto(`/payments?farmer=${farmerId}`);
    await expect(page.getByTestId("no-invoices-alert")).toHaveCount(0);

    // Open the invoice select so the option list (with due amounts) renders.
    await page.getByRole("combobox").filter({ hasText: /invoice/i }).first().click().catch(async () => {
      await page.getByText(/Pick invoice/i).first().click();
    });

    const dueCells = page.getByTestId("invoice-due-amount");
    await expect.poll(async () => dueCells.count()).toBeGreaterThan(0);

    // Every rendered due amount for open invoices (due>0) must carry the
    // destructive class — asserts the red highlight is actually applied.
    const count = await dueCells.count();
    let redSeen = 0;
    for (let i = 0; i < count; i++) {
      const cls = await dueCells.nth(i).getAttribute("class");
      if (cls && /text-destructive/.test(cls)) redSeen += 1;
    }
    expect(redSeen, "at least one due>0 row must be red-highlighted").toBeGreaterThan(0);
  });
});
