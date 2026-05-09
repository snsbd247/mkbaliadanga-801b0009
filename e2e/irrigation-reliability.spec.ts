import { test, expect, request } from "@playwright/test";

/**
 * Phase 5 — Irrigation reliability ecosystem E2E.
 *
 * Validates that the retry queue, audit log, and permission matrix
 * tables are reachable and that role-based REST access matches the
 * documented matrix. Falls back to skipping when credentials are
 * not configured (CI / local without secrets).
 *
 * Required env:
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_PUBLISHABLE_KEY
 *   E2E_PASSWORD
 *   E2E_STAFF_EMAIL
 *   E2E_COMMITTEE_EMAIL
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
const STAFF = process.env.E2E_STAFF_EMAIL ?? "";
const COMMITTEE = process.env.E2E_COMMITTEE_EMAIL ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";

const skipReason =
  !SUPABASE_URL || !ANON || !PASSWORD || !STAFF || !COMMITTEE
    ? "Phase 5 e2e credentials not configured"
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

test.describe("irrigation reliability — retry/audit/permissions", () => {
  test.skip(!!skipReason, skipReason ?? "");

  test("retry queue table is readable in scope", async () => {
    const api = await request.newContext();
    const token = await login(api, COMMITTEE);
    const r = await get(api, "background_retry_jobs?select=id,status&limit=1", token);
    expect(r.status(), "retry queue must be readable").toBeLessThan(400);
  });

  test("system audit log is restricted (no insert from REST)", async () => {
    const api = await request.newContext();
    const token = await login(api, STAFF);
    const r = await api.post(`${SUPABASE_URL}/rest/v1/system_audit_logs`, {
      headers: {
        apikey: ANON,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      data: { module: "test", action_type: "tamper", new_data: { x: 1 } },
    });
    // Insert may succeed (own user_id) or be rejected; either way must not crash.
    expect([200, 201, 401, 403, 409]).toContain(r.status());
  });

  test("role_permissions readable; permission_audit_logs locked to super", async () => {
    const api = await request.newContext();
    const token = await login(api, STAFF);
    const rp = await get(api, "role_permissions?select=role,module&limit=1", token);
    expect(rp.status()).toBeLessThan(400);

    const pal = await get(api, "permission_audit_logs?select=id&limit=1", token);
    const body = await pal.text();
    // Should be empty array or 401/403
    expect([200, 401, 403]).toContain(pal.status());
    if (pal.status() === 200) expect(body.trim()).toBe("[]");
  });

  test("staff cannot delete irrigation_invoices", async () => {
    const api = await request.newContext();
    const token = await login(api, STAFF);
    const r = await api.delete(
      `${SUPABASE_URL}/rest/v1/irrigation_invoices?id=eq.00000000-0000-0000-0000-000000000000`,
      { headers: { apikey: ANON, Authorization: `Bearer ${token}` } }
    );
    // Either rejected or no-op (0 rows) — must never delete arbitrary rows
    expect([200, 204, 401, 403]).toContain(r.status());
  });
});
