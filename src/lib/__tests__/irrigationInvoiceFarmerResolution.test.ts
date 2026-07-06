import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Regression: after invoice generation the billed farmer must ALWAYS resolve.
 * Even when both the billing-split RPC and the single-farmer RPC are missing,
 * the table fallback must return the land owner as the billed farmer so the
 * generated invoice carries a valid farmer_id (never null).
 */

const rpcMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    rpc: (...args: any[]) => rpcMock(...args),
    from: (...args: any[]) => fromMock(...args),
  },
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

function tableStub(table: string) {
  if (table === "lands") {
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: () =>
        Promise.resolve({
          data: { farmer_id: "owner-1", owner_farmer_id: "owner-1", land_size: 33 },
          error: null,
        }),
    };
    return chain;
  }
  if (table === "land_relations") {
    return { select: () => ({ eq: () => ({ is: () => Promise.resolve({ data: [], error: null }) }) }) };
  }
  const chain: any = { select: () => chain, eq: () => chain, is: () => chain, maybeSingle: () => Promise.resolve({ data: null, error: null }) };
  return chain;
}

beforeEach(() => {
  rpcMock.mockReset();
  fromMock.mockReset();
  fromMock.mockImplementation((table: string) => tableStub(table));
  // All RPCs missing → force table fallback.
  rpcMock.mockImplementation(() => Promise.resolve({ data: null, error: new Error("function does not exist") }));
});

describe("resolveBillingSplits — farmer always resolves after generation", () => {
  it("returns the land owner as billed_farmer_id when every RPC is missing", async () => {
    const { resolveBillingSplits } = await import("../irrigationInvoice");
    const splits = await resolveBillingSplits("land-1", "2026-07-01");

    expect(splits.length).toBeGreaterThan(0);
    expect(splits[0].billed_farmer_id).toBe("owner-1");
    expect(splits[0].owner_farmer_id).toBe("owner-1");
    // A valid farmer_id is what gets written onto the invoice payload.
    expect(splits.every((s) => !!s.billed_farmer_id)).toBe(true);
  });
});
