import { test, expect, request } from "@playwright/test";

/**
 * E2E: permanently deleting an irrigation receipt (via delete_payment_cascade)
 * must leave NO remaining rows for that payment/reference across:
 *   - payments
 *   - irrigation_invoice_payments
 *   - payment_allocations
 *   - journal_entries / journal_entry_lines (matched by reference = receipt_no)
 * and an audit entry must be written to system_audit_logs.
 *
 * Required env (super admin — permanent delete is restricted):
 *   VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY,
 *   E2E_SUPER_ADMIN_EMAIL, E2E_PASSWORD
 */
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
const EMAIL = process.env.E2E_SUPER_ADMIN_EMAIL ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";

const skipReason =
  !SUPABASE_URL || !ANON || !EMAIL || !PASSWORD
    ? "receipt-cascade-delete e2e credentials not configured (needs super admin)"
    : null;

async function apiToken(api: any) {
  const res = await api.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: ANON, "Content-Type": "application/json" },
    data: { email: EMAIL, password: PASSWORD },
  });
  expect(res.ok(), "login failed").toBeTruthy();
  return (await res.json()).access_token as string;
}

function rest(api: any, token: string, path: string) {
  return api.get(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: ANON, Authorization: `Bearer ${token}` },
  });
}

test.describe("irrigation receipt permanent delete → no orphan rows", () => {
  test.skip(!!skipReason, skipReason ?? "");

  test("cascade removes payment + invoice links + allocations + journals", async () => {
    const api = await request.newContext();
    const token = await apiToken(api);

    // Pick an existing irrigation payment that has a receipt number.
    const payRes = await rest(
      api,
      token,
      "payments?kind=eq.irrigation&receipt_no=not.is.null&deleted_at=is.null&select=id,receipt_no&limit=1",
    );
    expect(payRes.ok()).toBeTruthy();
    const rows = await payRes.json();
    test.skip(!rows?.length, "no irrigation payment with a receipt available in this environment");

    const paymentId = rows[0].id as string;
    const receiptNo = rows[0].receipt_no as string;

    // Delete permanently via the cascade RPC.
    const del = await api.post(`${SUPABASE_URL}/rest/v1/rpc/delete_payment_cascade`, {
      headers: { apikey: ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      data: { _payment_id: paymentId },
    });
    expect(del.ok(), `delete failed: ${del.status()} ${await del.text()}`).toBeTruthy();

    // Verify no remaining rows in any related table.
    const checks: Array<[string, string]> = [
      ["payments", `payments?id=eq.${paymentId}&select=id`],
      ["irrigation_invoice_payments", `irrigation_invoice_payments?payment_id=eq.${paymentId}&select=id`],
      ["payment_allocations", `payment_allocations?payment_id=eq.${paymentId}&select=id`],
      ["journal_entries", `journal_entries?reference=eq.${encodeURIComponent(receiptNo)}&select=id`],
    ];
    for (const [label, path] of checks) {
      const res = await rest(api, token, path);
      expect(res.ok(), `${label} query failed`).toBeTruthy();
      const remaining = await res.json();
      expect(remaining.length, `${label} still has rows for the deleted receipt`).toBe(0);
    }

    // journal_entry_lines: none should reference a journal that referenced the receipt.
    const jl = await rest(
      api,
      token,
      `journal_entry_lines?select=id,journal_entries!inner(reference)&journal_entries.reference=eq.${encodeURIComponent(receiptNo)}`,
    );
    expect(jl.ok()).toBeTruthy();
    expect((await jl.json()).length).toBe(0);

    // An audit entry for the permanent delete must exist.
    const audit = await rest(
      api,
      token,
      `system_audit_logs?module=eq.payments&action_type=eq.delete&reference_id=eq.${paymentId}&select=id`,
    );
    expect(audit.ok()).toBeTruthy();
    expect((await audit.json()).length).toBeGreaterThan(0);
  });
});
