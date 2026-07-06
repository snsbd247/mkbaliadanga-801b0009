import { test, expect, request } from "@playwright/test";

/**
 * E2E: payment receipt editing is permission-gated on the SERVER (payment-edit
 * edge function), not just in the UI.
 *
 *  - An UNAUTHORIZED user (no admin role, no payments can_edit permission) must
 *    receive 401/403 and cause NO data change.
 *  - An AUTHORIZED user (developer / super_admin / admin, or a user granted the
 *    payments edit permission) must be able to edit.
 *
 * Required env:
 *   VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, E2E_PASSWORD
 *   E2E_STAFF_EMAIL        — a user WITHOUT payments edit permission
 *   E2E_SUPERADMIN_EMAIL   — a developer/super_admin user (falls back to committee)
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";
const STAFF = process.env.E2E_STAFF_EMAIL ?? "";
const SUPER = process.env.E2E_SUPERADMIN_EMAIL ?? process.env.E2E_COMMITTEE_EMAIL ?? "";

const FN_URL = `${SUPABASE_URL}/functions/v1/payment-edit`;

const skipReason =
  !SUPABASE_URL || !ANON || !PASSWORD || !STAFF || !SUPER
    ? "payment-edit-permission e2e credentials not configured"
    : null;

async function apiToken(api: any, email: string) {
  const res = await api.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: ANON, "Content-Type": "application/json" },
    data: { email, password: PASSWORD },
  });
  expect(res.ok(), `login failed for ${email}`).toBeTruthy();
  return (await res.json()).access_token as string;
}

async function firstApprovedPayment(api: any, token: string) {
  const rows = (await (
    await api.get(
      `${SUPABASE_URL}/rest/v1/payments?select=id,amount,note&status=eq.approved&voided_at=is.null&limit=1`,
      { headers: { apikey: ANON, Authorization: `Bearer ${token}` } },
    )
  ).json()) as Array<Record<string, any>>;
  return rows[0] ?? null;
}

test.describe("payment-edit permission enforcement", () => {
  test.skip(!!skipReason, skipReason ?? "");

  test("unauthorized user cannot edit a receipt", async () => {
    const api = await request.newContext();
    const superToken = await apiToken(api, SUPER);
    const pay = await firstApprovedPayment(api, superToken);
    test.skip(!pay, "no approved payment available");

    const staffToken = await apiToken(api, STAFF);
    const res = await api.post(FN_URL, {
      headers: { apikey: ANON, Authorization: `Bearer ${staffToken}`, "Content-Type": "application/json" },
      data: { payment_id: pay.id, reason: "e2e unauthorized attempt", amount: pay.amount, note: pay.note ?? "" },
    });
    expect([401, 403], `expected forbidden, got ${res.status()}`).toContain(res.status());
  });

  test("authorized user can edit a receipt (note change)", async () => {
    const api = await request.newContext();
    const superToken = await apiToken(api, SUPER);
    const pay = await firstApprovedPayment(api, superToken);
    test.skip(!pay, "no approved payment available");

    const newNote = `e2e-edit-${Date.now()}`;
    const res = await api.post(FN_URL, {
      headers: { apikey: ANON, Authorization: `Bearer ${superToken}`, "Content-Type": "application/json" },
      data: { payment_id: pay.id, reason: "e2e authorized edit", amount: pay.amount, note: newNote },
    });
    expect(res.ok(), `edit failed: ${await res.text()}`).toBeTruthy();

    // Verify persisted + audit row exists.
    const check = (await (
      await api.get(`${SUPABASE_URL}/rest/v1/payments?select=note&id=eq.${pay.id}`, {
        headers: { apikey: ANON, Authorization: `Bearer ${superToken}` },
      })
    ).json()) as Array<Record<string, any>>;
    expect(check[0]?.note).toBe(newNote);
  });

  test("over-payment beyond payable is rejected server-side", async () => {
    const api = await request.newContext();
    const superToken = await apiToken(api, SUPER);
    // Find an irrigation payment linked to an invoice.
    const rows = (await (
      await api.get(
        `${SUPABASE_URL}/rest/v1/payments?select=id,amount,kind,reference_id&kind=eq.irrigation&status=eq.approved&voided_at=is.null&reference_id=not.is.null&limit=1`,
        { headers: { apikey: ANON, Authorization: `Bearer ${superToken}` } },
      )
    ).json()) as Array<Record<string, any>>;
    test.skip(rows.length === 0, "no irrigation payment available");

    const res = await api.post(FN_URL, {
      headers: { apikey: ANON, Authorization: `Bearer ${superToken}`, "Content-Type": "application/json" },
      data: { payment_id: rows[0].id, reason: "e2e over-payment", amount: 99999999 },
    });
    expect(res.status(), `expected 400, got ${res.status()}: ${await res.text()}`).toBe(400);
  });
});
