import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Integration test: the Dashboard collection cards and the Collection Report
 * must agree 100% for the same date range because both read from
 * getCollectionTotal / the same three streams. This test locks in the
 * aggregation contract so future edits can't silently diverge.
 */

// In-memory fixtures keyed by table name.
const tables: Record<string, any[]> = {
  irrigation_invoice_payments: [
    { collected_amount: 1000, created_at: "2026-07-05T10:00:00Z" },
    { collected_amount: 500, created_at: "2026-07-20T10:00:00Z" },
    { collected_amount: 999, created_at: "2026-06-30T10:00:00Z" }, // out of range
  ],
  loan_payments: [
    { amount: 300, paid_on: "2026-07-05" },
    { amount: 200, paid_on: "2026-07-15" },
    { amount: 100, paid_on: "2026-08-01" }, // out of range
  ],
  savings_transactions: [
    { amount: 400, txn_date: "2026-07-05", type: "deposit", status: "approved", deleted_at: null },
    { amount: 250, txn_date: "2026-07-10", type: "share_deposit", status: "approved", deleted_at: null },
    { amount: 999, txn_date: "2026-07-10", type: "deposit", status: "pending", deleted_at: null }, // not approved
    { amount: 777, txn_date: "2026-07-10", type: "withdraw", status: "approved", deleted_at: null }, // not a deposit
  ],
};

// Minimal chainable query builder honoring the filters getCollectionTotal uses.
function makeQuery(rows: any[]) {
  let data = [...rows];
  const q: any = {
    select: () => q,
    gt: (col: string, v: number) => { data = data.filter((r) => Number(r[col] ?? 0) > v); return q; },
    gte: (col: string, v: string) => { data = data.filter((r) => String(r[col] ?? "") >= v); return q; },
    lte: (col: string, v: string) => { data = data.filter((r) => String(r[col] ?? "") <= v); return q; },
    is: (col: string, v: any) => { data = data.filter((r) => r[col] === v); return q; },
    in: (col: string, vals: any[]) => { data = data.filter((r) => vals.includes(r[col])); return q; },
    eq: (col: string, v: any) => { data = data.filter((r) => r[col] === v); return q; },
    then: (resolve: any) => resolve({ data, error: null }),
  };
  return q;
}

vi.mock("@/lib/db", () => ({
  db: { from: (t: string) => makeQuery(tables[t] ?? []) },
}));

import { getCollectionTotal } from "@/lib/collectionTotals";

describe("getCollectionTotal (dashboard ↔ collection report parity)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sums the three streams for the month range", async () => {
    const r = await getCollectionTotal("2026-07-01", "2026-07-31");
    expect(r.irrigation).toBe(1500);
    expect(r.loan).toBe(500);
    expect(r.savings).toBe(650);
    expect(r.total).toBe(2650);
  });

  it("excludes rows outside the date range and non-approved / non-deposit savings", async () => {
    const r = await getCollectionTotal("2026-07-05", "2026-07-05");
    expect(r.irrigation).toBe(1000);
    expect(r.loan).toBe(300);
    expect(r.savings).toBe(400);
    expect(r.total).toBe(1700);
  });
});
