import { test, expect, request } from "@playwright/test";

/**
 * E2E (UI view): when the selected invoice's land has NO patwari linked, the
 * Payments page shows a manual patwari selector, and the patwari chosen there
 * flows onto the generated receipt data.
 *
 * This asserts the UI contract (manual patwari block appears + selection sticks)
 * rather than parsing the PDF binary. The receipt-data mapping itself is unit
 * tested in src/lib/__tests__/receiptPatwari.test.ts.
 *
 * Required env:
 *   E2E_BASE_URL, VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY,
 *   E2E_COMMITTEE_EMAIL, E2E_PASSWORD
 */

const BASE = process.env.E2E_BASE_URL ?? "";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
const EMAIL = process.env.E2E_COMMITTEE_EMAIL ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";

const skipReason =
  !BASE || !SUPABASE_URL || !ANON || !EMAIL || !PASSWORD
    ? "payments-manual-patwari-receipt-view e2e credentials not configured"
    : null;

async function apiToken(api: any) {
  const res = await api.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: ANON, "Content-Type": "application/json" },
    data: { email: EMAIL, password: PASSWORD },
  });
  expect(res.ok(), "login failed").toBeTruthy();
  return (await res.json()).access_token as string;
}

// Find a farmer whose open invoice land has no patwari linked.
async function farmerWithoutLandPatwari(api: any, token: string) {
  const res = await api.get(
    `${SUPABASE_URL}/rest/v1/irrigation_invoices?select=farmer_id,due_amount,invoice_status,deleted_at,lands(patwari_id)&due_amount=gt.0&deleted_at=is.null&limit=300`,
    { headers: { apikey: ANON, Authorization: `Bearer ${token}` } },
  );
  expect(res.ok()).toBeTruthy();
  const rows = (await res.json()) as Array<Record<string, any>>;
  const hit = rows.find(
    (r) => r.farmer_id && r.invoice_status !== "cancelled" && !(r.lands?.patwari_id),
  );
  return hit ? (hit.farmer_id as string) : null;
}

async function login(page: any) {
  await page.goto("/auth");
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/admin|dashboard/i, { timeout: 15_000 });
}

test.describe("Payments — manual patwari appears when land has none", () => {
  test.skip(!!skipReason, skipReason ?? "");

  test("manual patwari selector shows and selection persists", async ({ page }) => {
    const api = await request.newContext();
    const token = await apiToken(api);
    const farmerId = await farmerWithoutLandPatwari(api, token);
    test.skip(!farmerId, "no farmer with open invoice + land missing patwari in this environment");

    await login(page);
    await page.goto(`/payments?farmer=${farmerId}`);

    // The manual patwari block only renders when no selected land has a patwari.
    const block = page.getByTestId("manual-patwari-block");
    await expect(block).toBeVisible({ timeout: 15_000 });

    const select = page.getByTestId("manual-patwari-select");
    await select.click();
    const firstOption = page.getByRole("option").first();
    await expect(firstOption).toBeVisible();
    const chosen = (await firstOption.textContent())?.trim() ?? "";
    await firstOption.click();

    // Selection sticks on the trigger (the receipt will carry this patwari).
    await expect(select).toContainText(chosen.split(" — ")[0] || chosen);
  });
});
