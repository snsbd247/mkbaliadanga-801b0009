import { test, expect, request } from "@playwright/test";

/**
 * Health check: the `receipt-serial-admin` edge function is deployed and
 * reachable. We call it with the check probe ({ check: true }) using a super
 * admin token and expect a 200 with { available: true }.
 *
 * Required env:
 *   VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY,
 *   E2E_SUPER_ADMIN_EMAIL, E2E_PASSWORD
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
const EMAIL = process.env.E2E_SUPER_ADMIN_EMAIL ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";

const skipReason =
  !SUPABASE_URL || !ANON || !EMAIL || !PASSWORD
    ? "receipt-serial-admin-health e2e credentials not configured (needs super admin)"
    : null;

test.describe("Edge function — receipt-serial-admin is deployed", () => {
  test.skip(!!skipReason, skipReason ?? "");

  test("check probe returns available:true", async () => {
    const api = await request.newContext();
    const login = await api.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      headers: { apikey: ANON, "Content-Type": "application/json" },
      data: { email: EMAIL, password: PASSWORD },
    });
    expect(login.ok(), "login failed").toBeTruthy();
    const token = (await login.json()).access_token as string;

    const res = await api.post(`${SUPABASE_URL}/functions/v1/receipt-serial-admin`, {
      headers: { apikey: ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      data: { check: true },
    });
    expect(res.status(), "edge function not reachable/deployed").toBe(200);
    const body = await res.json();
    expect(body.available).toBe(true);
  });
});
