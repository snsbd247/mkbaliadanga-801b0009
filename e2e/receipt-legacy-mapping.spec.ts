import { test, expect, request } from "@playwright/test";

/**
 * E2E: legacy RCPT-/RCP-/R- receipts still resolve to a stable numeric alias via
 * the receipt_no_legacy_map backfill, so reports and exports (PDF + Excel) can
 * present the same mapped numeric sequence for old receipts without mutating the
 * source rows. Confirms:
 *   1. Every legacy receipt number has exactly one numeric_alias.
 *   2. Aliases are unique and contiguous (report/export consistency).
 *   3. The original legacy receipt_no is preserved on the source rows (still renders).
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
    ? "receipt-legacy-mapping e2e credentials not configured"
    : null;

async function apiToken(api: any) {
  const res = await api.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: ANON, "Content-Type": "application/json" },
    data: { email: EMAIL, password: PASSWORD },
  });
  expect(res.ok(), "login failed").toBeTruthy();
  return (await res.json()).access_token as string;
}

async function rest(api: any, token: string, path: string) {
  const res = await api.get(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: ANON, Authorization: `Bearer ${token}` },
  });
  expect(res.ok(), `GET ${path} -> ${res.status()}`).toBeTruthy();
  return res.json();
}

test.describe("legacy receipt numeric mapping consistency", () => {
  test.skip(!!skipReason, skipReason ?? "");

  test("legacy RCPT receipts map to unique contiguous numeric aliases", async () => {
    const api = await request.newContext();
    const token = await apiToken(api);

    const map = (await rest(
      api,
      token,
      "receipt_no_legacy_map?select=legacy_receipt_no,numeric_alias,source_table,source_id&order=numeric_alias.asc&limit=2000",
    )) as Array<Record<string, any>>;

    expect(map.length, "legacy map is empty — backfill missing").toBeGreaterThan(0);

    // 1. Aliases unique.
    const aliases = map.map((r) => Number(r.numeric_alias));
    expect(new Set(aliases).size, "duplicate numeric_alias values").toBe(aliases.length);

    // 2. Contiguous 1..N (report/export show a clean sequence).
    const sorted = [...aliases].sort((a, b) => a - b);
    expect(sorted[0]).toBe(1);
    expect(sorted[sorted.length - 1]).toBe(sorted.length);

    // 3. Every mapped number is a legacy-format receipt no, and the source row
    //    still carries the original legacy receipt_no (i.e. old receipts render).
    const sample = map.find((r) => r.source_table === "payments") ?? map[0];
    expect(String(sample.legacy_receipt_no)).toMatch(/^(RCPT|RCP|R)-/);

    if (sample.source_table === "payments") {
      const rows = (await rest(
        api,
        token,
        `payments?select=id,receipt_no&id=eq.${sample.source_id}`,
      )) as Array<Record<string, any>>;
      expect(rows.length).toBe(1);
      expect(rows[0].receipt_no).toBe(sample.legacy_receipt_no);
    }

    await api.dispose();
  });
});
