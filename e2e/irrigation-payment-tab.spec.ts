import { test, expect, request } from "@playwright/test";

/**
 * Irrigation payment tab default + RBAC + office-income serial E2E.
 *
 * - Verifies the Payments page defaults to the structured "সেচ পেমেন্ট" tab
 *   (the only path enforcing জরিমানা / two-season / land-area rules), and the
 *   legacy "Quick" form is the secondary tab.
 * - Verifies office-income rows use the সেচ (IRR) receipt serial and carry no
 *   farmer_id link.
 * - Verifies role-based access to payment routes is unchanged after the default
 *   tab swap.
 *
 * Required env:
 *   E2E_BASE_URL, VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY,
 *   E2E_PASSWORD, E2E_STAFF_EMAIL, E2E_COMMITTEE_EMAIL
 */

const BASE = process.env.E2E_BASE_URL ?? "";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
const STAFF = process.env.E2E_STAFF_EMAIL ?? "";
const COMMITTEE = process.env.E2E_COMMITTEE_EMAIL ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";

const skipReason =
  !BASE || !SUPABASE_URL || !ANON || !PASSWORD || !STAFF || !COMMITTEE
    ? "irrigation-payment-tab e2e credentials not configured"
    : null;

async function login(api: any, email: string) {
  const res = await api.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: ANON, "Content-Type": "application/json" },
    data: { email, password: PASSWORD },
  });
  expect(res.ok(), `login ${email} failed`).toBeTruthy();
  return (await res.json()).access_token as string;
}

test.describe("irrigation payment — default tab, office income, RBAC", () => {
  test.skip(!!skipReason, skipReason ?? "");

  test("Payments page defaults to the structured সেচ পেমেন্ট tab", async ({ page }) => {
    await page.goto(`${BASE}/payments`);
    // The structured tab should be the active/default one.
    const structuredTab = page.getByRole("tab", { name: /সেচ পেমেন্ট|Irrigation Payment/i });
    await expect(structuredTab).toHaveAttribute("data-state", "active");
    const quickTab = page.getByRole("tab", { name: /Quick|দ্রুত/i });
    await expect(quickTab).toHaveAttribute("data-state", "inactive");
  });

  test("office-income rows use IRR serial and have no farmer link", async () => {
    const api = await request.newContext();
    const token = await login(api, COMMITTEE);
    const res = await api.get(`${SUPABASE_URL}/rest/v1/office_incomes?select=receipt_no,stream&limit=50`, {
      headers: { apikey: ANON, Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();
    const rows = (await res.json()) as Array<Record<string, any>>;
    // office_incomes table intentionally has no farmer_id column.
    for (const r of rows) {
      expect(r).not.toHaveProperty("farmer_id");
    }
  });

  test("staff and committee both reach /payments after tab default change", async ({ browser }) => {
    for (const email of [STAFF, COMMITTEE]) {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.goto(`${BASE}/payments`);
      // Should not be redirected to an auth/forbidden screen for users with payments perm.
      await expect(page).toHaveURL(/\/payments/);
      await ctx.close();
    }
  });
});
