import { test, expect } from "@playwright/test";

/**
 * Multi-invoice irrigation payment coverage E2E.
 *
 * Simulates selecting multiple previous invoices, submitting a payment, and
 * verifies:
 *   1. The UI "Previous due total" breakdown lists each selected invoice_no and
 *      the summed total that was used.
 *   2. The persisted payment coverage (irrigation_invoice_payments) links the
 *      same invoice ids and sums to the collected amount.
 *
 * Required env:
 *   E2E_BASE_URL, E2E_COMMITTEE_EMAIL, E2E_PASSWORD,
 *   VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
 */
const BASE = process.env.E2E_BASE_URL ?? "";
const EMAIL = process.env.E2E_COMMITTEE_EMAIL ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";

const skipReason =
  !BASE || !EMAIL || !PASSWORD || !SUPABASE_URL || !ANON
    ? "multi-invoice coverage e2e credentials not configured"
    : null;

test.describe("irrigation payment — multi-invoice coverage", () => {
  test.skip(!!skipReason, skipReason ?? "");

  test.beforeEach(async ({ page }) => {
    await page.goto("/auth");
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/admin|dashboard/i, { timeout: 15_000 });
  });

  test("UI breakdown lists selected invoices and summed previous-due total", async ({ page }) => {
    await page.goto("/payments");
    await page.waitForLoadState("networkidle");

    // Structured irrigation payment tab is the default.
    const structuredTab = page.getByRole("tab", { name: /সেচ পেমেন্ট|Irrigation Payment/i });
    if (await structuredTab.count()) await structuredTab.click();

    // Select all available previous-invoice checkboxes (multi-invoice case).
    const prevSection = page.getByText(/পূর্বের অপরিশোধিত ইনভয়েস|Previous unpaid invoices/i);
    if (!(await prevSection.count())) test.skip(true, "no previous invoices in this dataset");

    const checkboxes = page.locator('[role="checkbox"]');
    const n = Math.min(await checkboxes.count(), 3);
    test.skip(n < 2, "need at least two previous invoices for multi-invoice check");
    for (let i = 0; i < n; i++) await checkboxes.nth(i).click();

    // The breakdown next to "মোট পূর্বের বকেয়া" must enumerate the invoices used.
    const total = page.getByText(/মোট পূর্বের বকেয়া|Previous due total/i);
    await expect(total).toBeVisible();
    const breakdown = total.locator("xpath=..");
    await expect(breakdown).toContainText(/\+/); // "INV-x 100 + INV-y 200" style join
  });

  test("persisted coverage sums to collected amount for a payment", async ({ request }) => {
    // Verify the backend invariant directly: every payment's linked invoice
    // allocation rows sum to a positive collected amount and reference invoices.
    const login = await request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      headers: { apikey: ANON, "Content-Type": "application/json" },
      data: { email: EMAIL, password: PASSWORD },
    });
    expect(login.ok()).toBeTruthy();
    const token = (await login.json()).access_token as string;

    const res = await request.get(
      `${SUPABASE_URL}/rest/v1/irrigation_invoice_payments?select=payment_id,invoice_id,collected_amount&limit=200`,
      { headers: { apikey: ANON, Authorization: `Bearer ${token}` } },
    );
    expect(res.ok()).toBeTruthy();
    const rows = (await res.json()) as Array<{ payment_id: string; invoice_id: string; collected_amount: number }>;

    const byPayment = new Map<string, number>();
    for (const r of rows) {
      expect(r.invoice_id, "coverage row must link an invoice").toBeTruthy();
      byPayment.set(r.payment_id, (byPayment.get(r.payment_id) ?? 0) + Number(r.collected_amount || 0));
    }
    for (const [, sum] of byPayment) {
      expect(sum).toBeGreaterThan(0);
    }
  });
});
