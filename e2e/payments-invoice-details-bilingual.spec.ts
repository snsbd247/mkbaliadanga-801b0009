import { test, expect, request } from "@playwright/test";

/**
 * E2E: the invoice details modal status AND the fetch-error toast are correctly
 * localised in both Bangla and English (driven by the app language toggle).
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
    ? "payments-invoice-details-bilingual e2e credentials not configured"
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

async function setLanguage(page: any, lang: "en" | "bn") {
  // The app persists language in localStorage; set it and reload for a
  // deterministic language regardless of the current toggle state.
  await page.evaluate((l: string) => localStorage.setItem("lang", l), lang);
  await page.reload();
}

test.describe("Payments — invoice details status & error toast are bilingual", () => {
  test.skip(!!skipReason, skipReason ?? "");

  test("details status label renders in both languages", async ({ page }) => {
    const api = await request.newContext();
    const token = await apiToken(api);
    const farmerId = await farmerWithOpenInvoices(api, token);
    test.skip(!farmerId, "no farmer with open irrigation invoices in this environment");

    await login(page);

    for (const [lang, statusLabel] of [["en", "Status"], ["bn", "স্ট্যাটাস"]] as const) {
      await page.goto(`/payments?farmer=${farmerId}`);
      await setLanguage(page, lang);
      await page.goto(`/payments?farmer=${farmerId}`);
      await expect(page.getByTestId("no-invoices-alert")).toHaveCount(0);

      // Select an invoice, then open its details modal.
      await page.getByText(/Pick invoice/i).first().click().catch(() => {});
      await page.getByRole("option").first().click().catch(() => {});
      await page.getByRole("button", { name: /(View details|বিস্তারিত দেখুন)/ }).first().click();

      const modal = page.getByTestId("invoice-details-modal");
      await expect(modal).toBeVisible();
      await expect(modal.getByText(statusLabel, { exact: false })).toBeVisible();
    }
  });

  test("fetch-error toast shows a trace id and Retry in both languages", async ({ page }) => {
    const api = await request.newContext();
    const token = await apiToken(api);
    const farmerId = await farmerWithOpenInvoices(api, token);
    test.skip(!farmerId, "no farmer with open irrigation invoices in this environment");

    await login(page);

    for (const [lang, retryLabel] of [["en", "Retry"], ["bn", "আবার চেষ্টা"]] as const) {
      await page.goto(`/payments?farmer=${farmerId}`);
      await setLanguage(page, lang);

      // Force the invoice query to fail so the localized error toast appears.
      await page.route("**/irrigation_invoices**", (route: any) =>
        route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "forced failure" }) }),
      );
      await page.goto(`/payments?farmer=${farmerId}`);

      const toast = page.locator("[data-sonner-toast]");
      await expect(toast.first()).toBeVisible({ timeout: 10_000 });
      await expect(toast.getByText(new RegExp(retryLabel))).toBeVisible();
      // Trace id is language-agnostic but must be present in both.
      await expect(toast.getByText(/trace|ট্রেস/i)).toBeVisible();

      await page.unroute("**/irrigation_invoices**");
    }
  });
});
