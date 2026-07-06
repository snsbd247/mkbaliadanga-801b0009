import { test, expect, request } from "@playwright/test";

/**
 * E2E: receipt serial numbers stay strictly sequential (no gaps that skip and
 * no duplicates) even when many receipt-number requests race concurrently.
 *
 * The unified serial is minted by the Postgres RPC `next_serial_receipt_no`
 * (also reached via next_unified_receipt_no / generate_receipt_no). We fire a
 * burst of parallel RPC calls and assert the returned numbers form a
 * contiguous, unique, increasing set.
 *
 * Required env:
 *   VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY,
 *   E2E_PASSWORD, E2E_COMMITTEE_EMAIL
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
const EMAIL = process.env.E2E_COMMITTEE_EMAIL ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";

const skipReason =
  !SUPABASE_URL || !ANON || !PASSWORD || !EMAIL
    ? "receipt-serial-sequential e2e credentials not configured"
    : null;

async function apiToken(api: any) {
  const res = await api.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: ANON, "Content-Type": "application/json" },
    data: { email: EMAIL, password: PASSWORD },
  });
  expect(res.ok(), "login failed").toBeTruthy();
  return (await res.json()).access_token as string;
}

async function mintSerial(api: any, token: string): Promise<number> {
  const res = await api.post(`${SUPABASE_URL}/rest/v1/rpc/next_unified_receipt_no`, {
    headers: { apikey: ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    data: { p_office_id: null },
  });
  expect(res.ok(), `rpc failed: ${res.status()}`).toBeTruthy();
  const body = await res.json();
  const n = Number(body);
  expect(Number.isInteger(n), `serial not numeric: ${JSON.stringify(body)}`).toBeTruthy();
  return n;
}

test.describe("receipt serial sequential under concurrency", () => {
  test.skip(!!skipReason, skipReason ?? "");

  test("concurrent mints produce unique, contiguous, increasing serials", async () => {
    const api = await request.newContext();
    const token = await apiToken(api);

    const BURST = 25;
    const results = await Promise.all(
      Array.from({ length: BURST }, () => mintSerial(api, token)),
    );

    const sorted = [...results].sort((a, b) => a - b);
    const unique = new Set(results);

    // No duplicates: every concurrent caller got its own number.
    expect(unique.size, `duplicate serials issued: ${results.join(",")}`).toBe(BURST);

    // Strictly contiguous: max - min + 1 === count => no gaps.
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    expect(max - min + 1, `serials not contiguous: ${sorted.join(",")}`).toBe(BURST);

    // Monotonic increasing when sorted (implied, but assert for clarity).
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i]).toBe(sorted[i - 1] + 1);
    }

    await api.dispose();
  });
});
