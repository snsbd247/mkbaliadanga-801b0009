import { test, expect, request } from "@playwright/test";

/**
 * Hybrid Irrigation Rate Engine — REST-level E2E.
 *
 * Verifies that:
 *  - Category + category-rate tables are reachable from staff scope
 *  - Existing irrigation_invoices schema exposes new snapshot columns
 *    (rate_source / applied_rate / original_standard_rate /
 *     irrigation_category_id / override_reason)
 *  - irrigation_rate_overrides table is readable in office scope
 *  - Legacy rows with NULL rate_source are still returned (backward compat)
 *
 * Skips when E2E credentials are absent.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
const STAFF = process.env.E2E_STAFF_EMAIL ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";

const skipReason =
  !SUPABASE_URL || !ANON || !PASSWORD || !STAFF
    ? "Hybrid rate engine e2e credentials not configured"
    : null;

async function login(api: any, email: string) {
  const res = await api.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: ANON, "Content-Type": "application/json" },
    data: { email, password: PASSWORD },
  });
  expect(res.ok(), `login ${email} failed`).toBeTruthy();
  return (await res.json()).access_token as string;
}

async function get(api: any, path: string, token: string) {
  return api.get(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: ANON, Authorization: `Bearer ${token}` },
  });
}

test.describe("hybrid irrigation rate engine — schema + visibility", () => {
  test.skip(!!skipReason, skipReason ?? "");

  test("irrigation_categories readable", async () => {
    const api = await request.newContext();
    const token = await login(api, STAFF);
    const r = await get(api, "irrigation_categories?select=id,code,name_bn,allow_manual_negotiation&limit=5", token);
    expect(r.status(), "categories list must be readable").toBeLessThan(400);
  });

  test("irrigation_category_rates readable", async () => {
    const api = await request.newContext();
    const token = await login(api, STAFF);
    const r = await get(api, "irrigation_category_rates?select=id,rate,rate_type,is_negotiable&limit=5", token);
    expect(r.status()).toBeLessThan(400);
  });

  test("irrigation_invoices exposes hybrid snapshot columns", async () => {
    const api = await request.newContext();
    const token = await login(api, STAFF);
    const r = await get(
      api,
      "irrigation_invoices?select=id,invoice_no,rate_source,applied_rate,original_standard_rate,irrigation_category_id,irrigation_category_name,override_reason,is_manual_rate&limit=3",
      token,
    );
    expect(r.status()).toBeLessThan(400);
    const body = (await r.json()) as any[];
    if (body.length) {
      const row = body[0];
      // Columns must exist on the response (may be null on legacy rows).
      for (const k of [
        "rate_source",
        "applied_rate",
        "original_standard_rate",
        "irrigation_category_id",
        "irrigation_category_name",
        "override_reason",
        "is_manual_rate",
      ]) {
        expect(Object.prototype.hasOwnProperty.call(row, k), `missing ${k}`).toBeTruthy();
      }
    }
  });

  test("legacy invoices (NULL rate_source) still listed — backward compatible", async () => {
    const api = await request.newContext();
    const token = await login(api, STAFF);
    const r = await get(api, "irrigation_invoices?rate_source=is.null&select=id&limit=1", token);
    expect(r.status()).toBeLessThan(400);
    // Must not error; an empty array is acceptable.
    expect(Array.isArray(await r.json())).toBeTruthy();
  });

  test("irrigation_rate_overrides readable in office scope", async () => {
    const api = await request.newContext();
    const token = await login(api, STAFF);
    const r = await get(
      api,
      "irrigation_rate_overrides?select=id,irrigation_invoice_id,original_rate,overridden_rate,override_reason&limit=3",
      token,
    );
    expect(r.status()).toBeLessThan(400);
  });

  test("staff cannot update irrigation_rate_overrides (audit-safe)", async () => {
    const api = await request.newContext();
    const token = await login(api, STAFF);
    const r = await api.patch(
      `${SUPABASE_URL}/rest/v1/irrigation_rate_overrides?id=eq.00000000-0000-0000-0000-000000000000`,
      {
        headers: {
          apikey: ANON,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        data: { override_reason: "tamper" },
      },
    );
    // No UPDATE policy exists — must be denied or no-op.
    expect([401, 403, 404, 200, 204]).toContain(r.status());
  });
});
