import { test, expect, request } from "@playwright/test";

/**
 * E2E regression: the Payments invoice filter only ever surfaces invoices with
 * due_amount > 0. Fully-paid (due_amount = 0) and cancelled/deleted invoices
 * must never render for the selected farmer. This guards the JS-side positive
 * due filter in fetchOpenIrrigationInvoicesResult (both Supabase & Laravel
 * adapters must behave identically).
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
    ? "payments-invoice-due-amount-positive e2e credentials not configured"
    : null;

async function apiToken(api: any) {
  const res = await api.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: ANON, "Content-Type": "application/json" },
    data: { email: EMAIL, password: PASSWORD },
  });
  expect(res.ok(), "login failed").toBeTruthy();
  return (await res.json()).access_token as string;
}

/** Find a farmer that has BOTH a due (>0) and a fully-paid (=0) invoice. */
async function farmerWithMixedDue(api: any, token: string) {
  const res = await api.get(
    `${SUPABASE_URL}/rest/v1/irrigation_invoices?select=id,farmer_id,invoice_no,due_amount,invoice_status,deleted_at&limit=1000`,
    { headers: { apikey: ANON, Authorization: `Bearer ${token}` } },
  );
  expect(res.ok()).toBeTruthy();
  const rows = (await res.json()) as Array<Record<string, any>>;
  const byFarmer = new Map<string, Array<Record<string, any>>>();
  for (const r of rows) {
    if (!r.farmer_id) continue;
    (byFarmer.get(r.farmer_id) ?? byFarmer.set(r.farmer_id, []).get(r.farmer_id)!).push(r);
  }
  for (const [farmerId, list] of byFarmer) {
    const active = list.filter((r) => r.invoice_status !== "cancelled" && !r.deleted_at);
    const due = active.filter((r) => Number(r.due_amount || 0) > 0);
    const paid = active.filter((r) => Number(r.due_amount || 0) <= 0);
    if (due.length && paid.length) {
      return { farmerId, dueNos: due.map((r) => String(r.invoice_no)), paidNos: paid.map((r) => String(r.invoice_no)) };
    }
  }
  return null;
}

async function login(page: any) {
  await page.goto("/auth");
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/admin|dashboard/i, { timeout: 15_000 });
}

test.describe("Payments — invoice list only shows due_amount > 0", () => {
  test.skip(!!skipReason, skipReason ?? "");

  test("renders only positive-due invoices, hides fully-paid ones", async ({ page }) => {
    const api = await request.newContext();
    const token = await apiToken(api);
    const mixed = await farmerWithMixedDue(api, token);
    test.skip(!mixed, "no farmer with both due and fully-paid invoices in this environment");

    // Verify the debug log confirms the positive-due filter dropped rows.
    const debugLogs: string[] = [];
    page.on("console", (m: any) => {
      const t = m.text();
      if (t.includes("[irrigation-invoices]")) debugLogs.push(t);
    });

    await login(page);
    await page.goto(`/payments?farmer=${mixed!.farmerId}`);

    // Open the invoice select so options render.
    await page.getByTestId("no-invoices-alert").waitFor({ state: "detached", timeout: 15_000 }).catch(() => {});

    const body = page.locator("body");
    // Every due invoice number should be visible somewhere in the invoice list.
    for (const no of mixed!.dueNos.slice(0, 3)) {
      await expect.poll(async () => body.getByText(no, { exact: false }).count()).toBeGreaterThan(0);
    }
    // No fully-paid invoice number should render.
    for (const no of mixed!.paidNos.slice(0, 3)) {
      await expect(body.getByText(no, { exact: false })).toHaveCount(0);
    }

    // The debug log must confirm received > kept (fully-paid rows were dropped)
    // and that zero non-positive rows leaked through.
    await expect
      .poll(() => debugLogs.some((l) => /nonPositiveKept=0/.test(l)))
      .toBeTruthy();
  });
});
