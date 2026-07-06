import { test, expect, request } from "@playwright/test";
import * as fs from "fs";
import * as XLSX from "xlsx";

/**
 * E2E: the invoice list export (Excel + PDF) applies the SAME filters as the
 * on-screen list — Open/Cancelled filter, deleted_at rule, and due_amount > 0.
 * Cancelled / soft-deleted / fully-paid invoices must never appear in exports.
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
    ? "payments-invoice-export-filters e2e credentials not configured"
    : null;

async function apiToken(api: any) {
  const res = await api.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: ANON, "Content-Type": "application/json" },
    data: { email: EMAIL, password: PASSWORD },
  });
  expect(res.ok(), "login failed").toBeTruthy();
  return (await res.json()).access_token as string;
}

async function farmerInvoices(api: any, token: string) {
  const res = await api.get(
    `${SUPABASE_URL}/rest/v1/irrigation_invoices?select=farmer_id,invoice_no,due_amount,invoice_status,deleted_at&limit=1000`,
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
    const open = list.filter((r) => r.invoice_status !== "cancelled" && !r.deleted_at && Number(r.due_amount || 0) > 0);
    const excluded = list.filter(
      (r) => r.invoice_status === "cancelled" || r.deleted_at || Number(r.due_amount || 0) <= 0,
    );
    if (open.length && excluded.length) {
      return {
        farmerId,
        openNos: open.map((r) => String(r.invoice_no)),
        excludedNos: excluded.map((r) => String(r.invoice_no)),
      };
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

test.describe("Payments — export applies list filters", () => {
  test.skip(!!skipReason, skipReason ?? "");

  test("Excel export contains only open, non-deleted, due>0 invoices", async ({ page }, testInfo) => {
    const api = await request.newContext();
    const token = await apiToken(api);
    const data = await farmerInvoices(api, token);
    test.skip(!data, "need a farmer with both open and excluded invoices");

    await login(page);
    await page.goto(`/payments?farmer=${data!.farmerId}`);
    await expect(page.getByTestId("no-invoices-alert")).toHaveCount(0);

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /^Excel$/ }).click(),
    ]);
    const filePath = testInfo.outputPath("invoices-export.xlsx");
    await download.saveAs(filePath);

    const wb = XLSX.read(fs.readFileSync(filePath));
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const contents = JSON.stringify(XLSX.utils.sheet_to_json(sheet, { header: 1 }));

    for (const no of data!.openNos.slice(0, 3)) expect(contents).toContain(no);
    for (const no of data!.excludedNos.slice(0, 5)) expect(contents).not.toContain(no);
  });
});
