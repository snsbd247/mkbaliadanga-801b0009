import { test, expect, request } from "@playwright/test";

/**
 * E2E regression: after the admin sets the receipt serial start to N, the next
 * generated receipt number must be exactly N + 1 (e.g. 4641 -> 4642).
 *
 * Flow:
 *   1. Super admin sets the serial start via `admin_set_receipt_serial_start`.
 *   2. Mint the next serial via `next_unified_receipt_no`.
 *   3. Assert it equals start + 1.
 *
 * Required env (super admin, because setting the serial is restricted):
 *   VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY,
 *   E2E_SUPER_ADMIN_EMAIL, E2E_PASSWORD
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
const EMAIL = process.env.E2E_SUPER_ADMIN_EMAIL ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";

const skipReason =
  !SUPABASE_URL || !ANON || !PASSWORD || !EMAIL
    ? "receipt-serial-start-plus-one e2e credentials not configured (needs super admin)"
    : null;

async function apiToken(api: any) {
  const res = await api.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: ANON, "Content-Type": "application/json" },
    data: { email: EMAIL, password: PASSWORD },
  });
  expect(res.ok(), "login failed").toBeTruthy();
  return (await res.json()).access_token as string;
}

async function currentSerialLast(api: any, token: string): Promise<number> {
  const res = await api.get(
    `${SUPABASE_URL}/rest/v1/receipt_counters?kind=eq.SERIAL&year=eq.0&select=last_no`,
    { headers: { apikey: ANON, Authorization: `Bearer ${token}` } },
  );
  expect(res.ok()).toBeTruthy();
  const rows = await res.json();
  return Number(rows?.[0]?.last_no ?? 0) || 0;
}

async function setSerialStart(api: any, token: string, start: number) {
  const res = await api.post(`${SUPABASE_URL}/rest/v1/rpc/admin_set_receipt_serial_start`, {
    headers: { apikey: ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    data: { p_start: start },
  });
  expect(res.ok(), `set serial failed: ${res.status()} ${await res.text()}`).toBeTruthy();
}

async function mintSerial(api: any, token: string): Promise<number> {
  const res = await api.post(`${SUPABASE_URL}/rest/v1/rpc/next_unified_receipt_no`, {
    headers: { apikey: ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    data: { p_office_id: null },
  });
  expect(res.ok(), `mint failed: ${res.status()}`).toBeTruthy();
  return Number(await res.json());
}

test.describe("receipt serial start yields next = start + 1", () => {
  test.skip(!!skipReason, skipReason ?? "");

  test("setting start to N generates N+1 as the next receipt", async () => {
    const api = await request.newContext();
    const token = await apiToken(api);

    // Pick a start safely above the current counter so the RPC guard accepts it
    // and the result is deterministic (>= 4641 to mirror the reported case).
    const last = await currentSerialLast(api, token);
    const start = Math.max(4641, last + 1);

    await setSerialStart(api, token, start);

    // The value must persist in receipt_settings.
    const settingsRes = await api.get(
      `${SUPABASE_URL}/rest/v1/receipt_settings?id=eq.1&select=receipt_serial_start`,
      { headers: { apikey: ANON, Authorization: `Bearer ${token}` } },
    );
    expect(settingsRes.ok()).toBeTruthy();
    const settings = await settingsRes.json();
    expect(Number(settings?.[0]?.receipt_serial_start)).toBe(start);

    // Next minted receipt must be exactly start + 1.
    const next = await mintSerial(api, token);
    expect(next).toBe(start + 1);
  });
});
