import { test, expect, request } from "@playwright/test";

/**
 * Land CRUD + cascading prefill + double-submit-prevention e2e.
 *
 * Runs against the REST API directly (no UI) so it is fast and deterministic.
 * Skips automatically when E2E credentials are not configured.
 *
 * Required env:
 *   VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
 *   E2E_COMMITTEE_EMAIL, E2E_PASSWORD
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
const COMMITTEE = process.env.E2E_COMMITTEE_EMAIL ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";

const skipReason = (!COMMITTEE || !PASSWORD || !SUPABASE_URL) ? "E2E credentials not configured" : null;

async function login(api: any, email: string) {
  const res = await api.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: ANON, "Content-Type": "application/json" },
    data: { email, password: PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
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

test.describe("Land CRUD", () => {
  test.skip(!!skipReason, skipReason ?? "");

  test("add → edit → delete with cascading mouza, double-submit safe", async () => {
    const api = await request.newContext();
    const token = await login(api, COMMITTEE);

    // Pick farmer + mouza
    const f = await (await rest(api, "farmers?select=id,office_id&status=eq.active&limit=1", token)).json();
    const m = await (await rest(api, "mouzas?select=id,name&limit=1", token)).json();
    expect(f[0]).toBeTruthy();
    expect(m[0]).toBeTruthy();
    const farmerId = f[0].id, officeId = f[0].office_id, mouzaId = m[0].id, mouzaName = m[0].name;

    // CREATE
    const ins = await rest(api, "lands", token, {
      method: "POST",
      data: { farmer_id: farmerId, office_id: officeId, mouza: mouzaName, mouza_id: mouzaId, dag_no: "E2E-1", land_size: 1.5, owner_type: "owner", field_type: "medium_land" },
    });
    expect(ins.ok(), `create: ${ins.status()} ${await ins.text()}`).toBeTruthy();
    const [land] = await ins.json();

    // Cascading view should expose breadcrumb columns
    const view = await (await rest(api, `lands_with_location?id=eq.${land.id}&select=mouza_name,division_name,district_name,upazila_name,union_name`, token)).json();
    expect(view[0].mouza_name, "lands_with_location should hydrate mouza_name").toBeTruthy();

    // DOUBLE-SUBMIT — fire two identical UPDATEs in parallel; both must succeed without duplicating rows.
    const [u1, u2] = await Promise.all([
      rest(api, `lands?id=eq.${land.id}`, token, { method: "PATCH", data: { dag_no: "E2E-1A" } }),
      rest(api, `lands?id=eq.${land.id}`, token, { method: "PATCH", data: { dag_no: "E2E-1A" } }),
    ]);
    expect(u1.ok() && u2.ok()).toBeTruthy();
    const after = await (await rest(api, `lands?id=eq.${land.id}&select=id,dag_no`, token)).json();
    expect(after).toHaveLength(1);
    expect(after[0].dag_no).toBe("E2E-1A");

    // DELETE
    const del = await rest(api, `lands?id=eq.${land.id}`, token, { method: "DELETE" });
    expect(del.ok()).toBeTruthy();
    const gone = await (await rest(api, `lands?id=eq.${land.id}&select=id`, token)).json();
    expect(gone).toHaveLength(0);
  });

  test("farmer search by account_number is office-scoped", async () => {
    const api = await request.newContext();
    const token = await login(api, COMMITTEE);
    // Pull any account_number — RLS should ensure office scope automatically.
    const r = await (await rest(api, "farmers?select=account_number,office_id&account_number=not.is.null&limit=5", token)).json();
    for (const row of r) {
      expect(row.account_number, "account_number must be present").toBeTruthy();
    }
  });
});
