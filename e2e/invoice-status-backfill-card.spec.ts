import { test, expect, request } from "@playwright/test";

/**
 * E2E: admin Invoice-status backfill card.
 *
 * Verifies the InvoiceStatusCheckCard on /admin/health shows the count of
 * irrigation invoices with a NULL invoice_status, and that after the backfill
 * migration that count is 0 (card shows the "all invoices have a status" state).
 *
 * The card's null count is exposed via data-testid="invoice-status-null-count"
 * and a data-null-count attribute for a robust assertion. We cross-check the
 * displayed value against a REST count of NULL-status invoices.
 *
 * Required env:
 *   E2E_BASE_URL, VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY,
 *   E2E_PASSWORD, E2E_COMMITTEE_EMAIL  (committee/admin can reach /admin/health)
 */

const BASE = process.env.E2E_BASE_URL ?? "";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
const EMAIL = process.env.E2E_COMMITTEE_EMAIL ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";

const skipReason =
  !BASE || !SUPABASE_URL || !ANON || !PASSWORD || !EMAIL
    ? "invoice-status-check e2e credentials not configured"
    : null;

async function apiToken(api: any) {
  const res = await api.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: ANON, "Content-Type": "application/json" },
    data: { email: EMAIL, password: PASSWORD },
  });
  expect(res.ok(), "login failed").toBeTruthy();
  return (await res.json()).access_token as string;
}

async function nullStatusCount(api: any, token: string): Promise<number> {
  const res = await api.get(
    `${SUPABASE_URL}/rest/v1/irrigation_invoices?select=id&invoice_status=is.null`,
    {
      headers: {
        apikey: ANON,
        Authorization: `Bearer ${token}`,
        Prefer: "count=exact",
        Range: "0-0",
      },
    },
  );
  expect(res.ok()).toBeTruthy();
  await res.text();
  const cr = res.headers()["content-range"] ?? "*/0";
  return Number(cr.split("/")[1] || 0);
}

test.describe("admin invoice-status backfill card", () => {
  test.skip(!!skipReason, skipReason ?? "");

  test("card null count matches REST and is 0 after backfill", async ({ page }) => {
    const api = await request.newContext();
    const token = await apiToken(api);
    const expected = await nullStatusCount(api, token);

    await page.goto("/auth");
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/admin|dashboard/i, { timeout: 15_000 });

    await page.goto("/admin/health");
    const card = page.getByTestId("invoice-status-check-card");
    await expect(card).toBeVisible();

    // Wait for the count row to settle (loading spinner replaced).
    const countRow = page.getByTestId("invoice-status-null-count");
    await expect(countRow).toBeVisible({ timeout: 15_000 });

    const displayed = Number((await countRow.getAttribute("data-null-count")) || 0);
    expect(displayed).toBe(expected);

    // Post-backfill, the count must be 0 and the "all have a status" state shown.
    expect(expected).toBe(0);
    await expect(card).toContainText(/All invoices have a status|সব ইনভয়েসে স্ট্যাটাস আছে/i);
  });
});
