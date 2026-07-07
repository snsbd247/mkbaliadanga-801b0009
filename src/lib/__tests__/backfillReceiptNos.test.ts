import { describe, it, expect, vi, beforeEach } from "vitest";

// Capture update payloads issued against the payments table.
const updateCalls: any[] = [];

function makeBuilder() {
  const rows = [{ id: "p1", occurred_at: "2026-01-01T00:00:00Z", created_at: null }];
  const builder: any = {
    select: () => builder,
    is: () => builder,
    eq: () => builder,
    limit: () => builder,
    then: (resolve: any) => resolve({ data: rows, error: null }),
    update: (payload: any) => {
      updateCalls.push(payload);
      return {
        eq: () => ({ is: () => Promise.resolve({ error: null }) }),
      };
    },
  };
  return builder;
}

vi.mock("@/lib/db", () => ({ db: { from: () => makeBuilder() } }));

import { backfillMissingReceiptNos } from "@/lib/backfillReceiptNos";

describe("backfillMissingReceiptNos", () => {
  beforeEach(() => {
    updateCalls.length = 0;
  });

  it("generates and persists a receipt_no for legacy payment rows", async () => {
    const count = await backfillMissingReceiptNos("office-1");
    expect(count).toBe(1);
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].receipt_no).toMatch(/^PAY-\d{8}-/);
  });

  it("only runs once per session (idempotent guard)", async () => {
    const count = await backfillMissingReceiptNos("office-1");
    expect(count).toBe(0);
    expect(updateCalls).toHaveLength(0);
  });
});
