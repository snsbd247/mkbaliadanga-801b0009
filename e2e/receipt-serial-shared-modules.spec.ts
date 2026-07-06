import { test, expect, request } from "@playwright/test";

/**
 * E2E: the unified receipt serial is a single shared, sequential counter across
 * payments, savings, irrigation and loan modules. Every module mints its number
 * through the same Postgres serial (next_unified_receipt_no / generate_receipt_no
 * -> next_serial_receipt_no), so interleaving mints from different modules still
 * yields one strictly increasing, gap-free, duplicate-free sequence.
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
    ? "receipt-serial-shared e2e credentials not configured"
    : null;

async function apiToken(api: any) {
  const res = await api.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: ANON, "Content-Type": "application/json" },
    data: { email: EMAIL, password: PASSWORD },
  });
  expect(res.ok(), "login failed").toBeTruthy();
  return (await res.json()).access_token as string;
}

// Each module reaches the SAME serial through its own RPC entry point.
const MODULE_RPCS: Record<string, { fn: string; args: Record<string, unknown> }> = {
  payments: { fn: "next_unified_receipt_no", args: { p_office_id: null } },
  savings: { fn: "next_monthly_receipt_no", args: { p_office_id: null, p_kind: "SAV" } },
  irrigation: { fn: "next_monthly_receipt_no", args: { p_office_id: null, p_kind: "IRR" } },
  loan: { fn: "next_receipt_no", args: { p_kind: "LOAN" } },
};

async function mint(api: any, token: string, module: keyof typeof MODULE_RPCS): Promise<number> {
  const { fn, args } = MODULE_RPCS[module];
  const res = await api.post(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    headers: { apikey: ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    data: args,
  });
  expect(res.ok(), `${module} rpc ${fn} failed: ${res.status()}`).toBeTruthy();
  const n = Number(await res.json());
  expect(Number.isInteger(n), `${module} serial not numeric`).toBeTruthy();
  return n;
}

test.describe("receipt serial shared across modules", () => {
  test.skip(!!skipReason, skipReason ?? "");

  test("interleaved mints from all modules form one sequential stream", async () => {
    const api = await request.newContext();
    const token = await apiToken(api);

    const order: (keyof typeof MODULE_RPCS)[] = [
      "payments", "savings", "irrigation", "loan",
      "loan", "irrigation", "savings", "payments",
    ];
    const results: number[] = [];
    for (const m of order) results.push(await mint(api, token, m));

    // Sequential in mint order (each next is exactly previous + 1) => shared counter.
    for (let i = 1; i < results.length; i++) {
      expect(results[i], `not sequential at ${order[i]}: ${results.join(",")}`).toBe(results[i - 1] + 1);
    }
    // No duplicates across modules.
    expect(new Set(results).size).toBe(results.length);

    await api.dispose();
  });
});
