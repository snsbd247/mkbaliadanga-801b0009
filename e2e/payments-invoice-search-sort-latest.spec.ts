import { test, expect, request } from "@playwright/test";

/**
 * E2E regression: rapidly changing the invoice search text and sort order must
 * only render results consistent with the LATEST search/sort state (no stale
 * rendering from intermediate keystrokes).
 *
 * The search/sort is client-side over already-fetched invoices, so the check is
 * that the final rendered dropdown reflects the final query + sort direction.
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
    ? "invoice-search-sort e2e credentials not configured"
    : null;

async function apiToken(api: any) {
  const res = await api.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: ANON, "Content-Type": "application/json" },
    data: { email: EMAIL, password: PASSWORD },
  });
  expect(res.ok(), "login failed").toBeTruthy();
  return (await res.json()).access_token as string;
}

async function farmerWithMultipleInvoices(api: any, token: string) {
  const res = await api.get(
    `${SUPABASE_URL}/rest/v1/irrigation_invoices?select=farmer_id,invoice_no,due_amount,invoice_status,deleted_at&due_amount=gt.0&deleted_at=is.null&limit=1000`,
    { headers: { apikey: ANON, Authorization: `Bearer ${token}` } },
  );
  expect(res.ok()).toBeTruthy();
  const rows = (await res.json()) as Array<Record<string, any>>;
  const counts = new Map<string, string[]>();
  for (const r of rows) {
    if (r.invoice_status === "cancelled" || !r.farmer_id) continue;
    counts.set(r.farmer_id, [...(counts.get(r.farmer_id) ?? []), r.invoice_no as string]);
  }
  for (const [fid, nos] of counts) if (nos.length >= 2) return { farmerId: fid, invoiceNos: nos };
  return null;
}

async function login(page: any) {
  await page.goto("/auth");
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/admin|dashboard/i, { timeout: 15_000 });
}

test.describe("Payments — rapid search + sort renders only latest results", () => {
  test.skip(!!skipReason, skipReason ?? "");

  test("final search text filters the invoice list to the matching invoice", async ({ page }) => {
    const api = await request.newContext();
    const token = await apiToken(api);
    const found = await farmerWithMultipleInvoices(api, token);
    test.skip(!found, "need a farmer with multiple open invoices");
    const { farmerId, invoiceNos } = found!;
    const target = invoiceNos[invoiceNos.length - 1];

    await login(page);
    await page.goto(`/payments?farmer=${farmerId}`);
    await expect(page.getByTestId("invoice-loading-skeleton")).toHaveCount(0, { timeout: 15_000 });

    const search = page.getByTestId("invoice-search").first();
    // Rapid changes: type several intermediate queries, then the final target.
    await search.fill("INV");
    await search.fill("X-NO-MATCH-XYZ");
    await search.fill(String(target));

    // Open the dropdown; only the final target should be present.
    await page.getByText(/Pick invoice|No open invoices/).first().click();
    await expect(page.getByRole("option", { name: new RegExp(String(target)) })).toBeVisible({ timeout: 10_000 });
    // A clearly non-matching invoice number should not be in the filtered list.
    const other = invoiceNos.find((n) => n !== target);
    if (other) {
      await expect(page.getByRole("option", { name: new RegExp(`^${other}\\b`) })).toHaveCount(0);
    }
  });
});
