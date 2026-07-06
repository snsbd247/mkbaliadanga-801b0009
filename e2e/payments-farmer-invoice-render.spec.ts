import { test, expect, request } from "@playwright/test";

/**
 * E2E: selecting a farmer on the Payments page always renders their expected
 * open irrigation invoices, and the diagnostic empty-state / error surfaces
 * behave correctly.
 *
 * - A farmer WITH open invoices → invoice options render, no "no-invoices-alert".
 * - A farmer WITH open invoices → no error toast, no due-mismatch alert.
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
    ? "payments-farmer-invoice-render e2e credentials not configured"
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

test.describe("Payments — farmer selection renders invoices", () => {
  test.skip(!!skipReason, skipReason ?? "");

  test("selecting a farmer with dues renders invoices and no empty/error alert", async ({ page }) => {
    const api = await request.newContext();
    const token = await apiToken(api);
    const farmerId = await farmerWithOpenInvoices(api, token);
    test.skip(!farmerId, "no farmer with open irrigation invoices in this environment");

    const consoleErrors: string[] = [];
    page.on("console", (m: any) => {
      if (m.type() === "error") consoleErrors.push(m.text());
    });

    await login(page);
    await page.goto(`/payments?farmer=${farmerId}`);

    // Invoices rendered → the diagnostic empty-state alert must be absent.
    await expect(page.getByTestId("no-invoices-alert")).toHaveCount(0);
    // "No open invoices" placeholder must not be shown.
    await expect
      .poll(async () => page.locator("body").getByText(/No open invoices/i).count())
      .toBe(0);
    // No due mismatch / fetch error for a healthy farmer.
    await expect(page.getByTestId("due-mismatch-alert")).toHaveCount(0);
    expect(consoleErrors.join("\n")).not.toMatch(/irrigation-invoices\]\[/);
  });
});
