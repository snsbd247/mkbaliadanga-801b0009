import { test, expect, request } from "@playwright/test";

/**
 * E2E: the database enforces receipt-number uniqueness so accidental duplicate
 * receipt creation fails safely instead of producing two receipts with the same
 * number. Guards the unique index idx_payments_receipt_no_office
 * (office_id, receipt_no) — a second payment with the same office + receipt_no is
 * rejected by Postgres (23505) and no duplicate row is persisted.
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
    ? "receipt-duplicate-guard e2e credentials not configured"
    : null;

async function apiToken(api: any) {
  const res = await api.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: ANON, "Content-Type": "application/json" },
    data: { email: EMAIL, password: PASSWORD },
  });
  expect(res.ok(), "login failed").toBeTruthy();
  return (await res.json()).access_token as string;
}

async function insertPayment(api: any, token: string, body: Record<string, unknown>) {
  return api.post(`${SUPABASE_URL}/rest/v1/payments`, {
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    data: body,
  });
}

test.describe("duplicate receipt numbers fail safely", () => {
  test.skip(!!skipReason, skipReason ?? "");

  test("second payment with same office + receipt_no is rejected", async () => {
    const api = await request.newContext();
    const token = await apiToken(api);

    // Need a farmer + office to satisfy NOT NULL / RLS constraints.
    const farmers = (await (
      await api.get(`${SUPABASE_URL}/rest/v1/farmers?select=id,office_id&office_id=not.is.null&limit=1`, {
        headers: { apikey: ANON, Authorization: `Bearer ${token}` },
      })
    ).json()) as Array<Record<string, any>>;
    test.skip(farmers.length === 0, "no farmer with office available");
    const { id: farmer_id, office_id } = farmers[0];

    const receipt_no = `E2E-DUP-${Date.now()}`;
    const base = {
      farmer_id,
      office_id,
      kind: "irrigation",
      amount: 1,
      status: "approved",
      receipt_no,
    };

    const first = await insertPayment(api, token, base);
    expect(first.ok(), `first insert should succeed: ${first.status()} ${await first.text()}`).toBeTruthy();

    // Duplicate: same office_id + receipt_no must violate the unique index.
    const second = await insertPayment(api, token, { ...base, amount: 2 });
    expect(second.ok(), "duplicate insert unexpectedly succeeded").toBeFalsy();
    expect([409, 400, 422]).toContain(second.status());
    const body = await second.text();
    expect(body).toMatch(/duplicate|unique|23505/i);

    // Confirm only one row persisted for this receipt_no.
    const rows = (await (
      await api.get(
        `${SUPABASE_URL}/rest/v1/payments?select=id&receipt_no=eq.${receipt_no}&office_id=eq.${office_id}`,
        { headers: { apikey: ANON, Authorization: `Bearer ${token}` } },
      )
    ).json()) as Array<Record<string, any>>;
    expect(rows.length, "more than one row persisted for duplicate receipt_no").toBe(1);

    // Cleanup the test row.
    const createdId = (await first.json())?.[0]?.id;
    if (createdId) {
      await api.delete(`${SUPABASE_URL}/rest/v1/payments?id=eq.${createdId}`, {
        headers: { apikey: ANON, Authorization: `Bearer ${token}` },
      });
    }

    await api.dispose();
  });
});
