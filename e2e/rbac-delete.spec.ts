import { test, expect, request } from "@playwright/test";

/**
 * RBAC + ledger-consistency e2e tests.
 *
 * Prerequisites (set as env vars before running):
 *   E2E_BASE_URL
 *   E2E_STAFF_EMAIL          – user with `staff` role only
 *   E2E_COMMITTEE_EMAIL      – user with `committee` or `super_admin` role
 *   E2E_PASSWORD
 *   VITE_SUPABASE_URL        – read from .env automatically; mirror here for direct REST calls
 *   VITE_SUPABASE_PUBLISHABLE_KEY
 */

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:5173";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";

const STAFF = process.env.E2E_STAFF_EMAIL ?? "";
const COMMITTEE = process.env.E2E_COMMITTEE_EMAIL ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";

const skipReason = (!STAFF || !COMMITTEE || !PASSWORD || !SUPABASE_URL) ? "E2E credentials not configured" : null;

async function login(api: ReturnType<typeof request.newContext> extends Promise<infer T> ? T : never, email: string) {
  const res = await api.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: ANON, "Content-Type": "application/json" },
    data: { email, password: PASSWORD },
  });
  expect(res.ok(), `login ${email} failed`).toBeTruthy();
  const j = await res.json();
  return j.access_token as string;
}

async function rest(api: any, path: string, token: string, init: any = {}) {
  return api.fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers ?? {}),
    },
  });
}

test.describe("RBAC: delete loans + savings", () => {
  test.skip(!!skipReason, skipReason ?? "");

  test("staff cannot delete loans (RLS blocks)", async () => {
    const api = await request.newContext();
    const token = await login(api, STAFF);
    // Pick any loan visible to staff
    const r = await rest(api, "loans?select=id,office_id&limit=1", token);
    const loans = await r.json();
    if (!Array.isArray(loans) || loans.length === 0) test.skip(true, "no loan available for staff");
    const id = loans[0].id;
    const del = await rest(api, `loans?id=eq.${id}`, token, { method: "DELETE" });
    // RLS denies → 0 rows affected; PostgREST returns 200 with [] OR 401/403 depending on setup
    if (del.ok()) {
      const body = await del.json().catch(() => []);
      expect(Array.isArray(body) ? body.length : 0).toBe(0);
    } else {
      expect([401, 403]).toContain(del.status());
    }
  });

  test("committee can delete loan and ledger stays consistent", async () => {
    const api = await request.newContext();
    const token = await login(api, COMMITTEE);

    // Create a tiny throwaway loan
    const farmerRes = await rest(api, "farmers?select=id,office_id&status=eq.active&limit=1", token);
    const [farmer] = await farmerRes.json();
    expect(farmer, "need at least one active farmer").toBeTruthy();

    const insert = await rest(api, "loans", token, {
      method: "POST",
      data: {
        farmer_id: farmer.id,
        office_id: farmer.office_id,
        principal: 100,
        interest_rate: 0,
        interest_enabled: false,
        status: "approved",
      },
    });
    expect(insert.ok(), `insert loan: ${insert.status()} ${await insert.text()}`).toBeTruthy();
    const [loan] = await insert.json();

    // Confirm ledger postings exist for the new loan
    const led1 = await rest(api, `ledger_entries?reference_type=eq.loan&reference_id=eq.${loan.id}&select=debit,credit`, token);
    const ledgerBefore = await led1.json();
    expect(ledgerBefore.length).toBeGreaterThan(0);

    // Delete
    const del = await rest(api, `loans?id=eq.${loan.id}`, token, { method: "DELETE" });
    expect(del.ok(), `delete loan: ${del.status()}`).toBeTruthy();

    // Verify postings cleared
    const check = await api.post(`${SUPABASE_URL}/functions/v1/ledger-check`, {
      headers: { apikey: ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      data: { reference_type: "loan", reference_id: loan.id },
    });
    expect(check.ok()).toBeTruthy();
    const j = await check.json();
    expect(j.lingering_count, "ledger entries should be cleared").toBe(0);
  });

  test("committee can delete savings transaction and ledger stays consistent", async () => {
    const api = await request.newContext();
    const token = await login(api, COMMITTEE);

    const farmerRes = await rest(api, "farmers?select=id,office_id&status=eq.active&limit=1", token);
    const [farmer] = await farmerRes.json();
    expect(farmer).toBeTruthy();

    const insert = await rest(api, "savings_transactions", token, {
      method: "POST",
      data: {
        farmer_id: farmer.id,
        office_id: farmer.office_id,
        type: "deposit",
        amount: 50,
        status: "approved",
      },
    });
    expect(insert.ok(), `insert savings: ${insert.status()} ${await insert.text()}`).toBeTruthy();
    const [sv] = await insert.json();

    const del = await rest(api, `savings_transactions?id=eq.${sv.id}`, token, { method: "DELETE" });
    expect(del.ok()).toBeTruthy();

    const check = await api.post(`${SUPABASE_URL}/functions/v1/ledger-check`, {
      headers: { apikey: ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      data: { reference_type: "savings", reference_id: sv.id },
    });
    expect(check.ok()).toBeTruthy();
    const j = await check.json();
    expect(j.lingering_count).toBe(0);
    expect((j.unbalanced ?? []).length, "no unbalanced refs").toBe(0);
  });
});
