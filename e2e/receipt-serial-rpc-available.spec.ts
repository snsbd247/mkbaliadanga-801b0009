import { test, expect, request } from "@playwright/test";

/**
 * Integration: the admin_set_receipt_serial_start RPC must be reachable via
 * PostgREST (schema cache loaded) so staging/prod catch a missing/undeployed
 * function BEFORE a user hits "not available on this server" in the UI.
 *
 * A reachable function rejects an invalid argument (-1) with a validation error
 * (NOT a PGRST202 / "schema cache" / "not available" error). A missing function
 * returns the schema-cache error — which this test fails on.
 *
 * Required env:
 *   VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY,
 *   E2E_SUPERADMIN_EMAIL (or E2E_COMMITTEE_EMAIL), E2E_PASSWORD
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
const EMAIL = process.env.E2E_SUPERADMIN_EMAIL ?? process.env.E2E_COMMITTEE_EMAIL ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";

const skipReason =
  !SUPABASE_URL || !ANON || !PASSWORD || !EMAIL
    ? "receipt-serial-rpc e2e credentials not configured"
    : null;

async function apiToken(api: any) {
  const res = await api.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: ANON, "Content-Type": "application/json" },
    data: { email: EMAIL, password: PASSWORD },
  });
  expect(res.ok(), "login failed").toBeTruthy();
  return (await res.json()).access_token as string;
}

test.describe("admin_set_receipt_serial_start RPC availability", () => {
  test.skip(!!skipReason, skipReason ?? "");

  test("RPC is reachable via PostgREST (schema cache loaded)", async () => {
    const api = await request.newContext();
    const token = await apiToken(api);

    const res = await api.post(`${SUPABASE_URL}/rest/v1/rpc/admin_set_receipt_serial_start`, {
      headers: {
        apikey: ANON,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      data: { p_start: -1 },
    });

    const bodyText = await res.text();
    // The one status/message we must NEVER see: function missing / stale schema cache.
    expect(res.status(), `RPC missing (schema cache)? body=${bodyText}`).not.toBe(404);
    expect(bodyText.toLowerCase()).not.toContain("not available on this server");
    expect(bodyText.toLowerCase()).not.toContain("could not find the function");
    expect(bodyText.toUpperCase()).not.toContain("PGRST202");
  });
});
