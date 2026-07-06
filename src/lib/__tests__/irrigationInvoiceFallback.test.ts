import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * E2E-style test: invoice billing resolution must keep working when the
 * `get_billed_farmer_for_land` RPC is missing/unavailable — the table-based
 * fallback should resolve the owner, and the fallback must be audited via
 * the `log_rpc_fallback` RPC.
 */

const rpcMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    rpc: (...args: any[]) => rpcMock(...args),
    from: (...args: any[]) => fromMock(...args),
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {},
}));

// Land + relations table fallback: returns an owner and no active sharecropper.
function tableStub(table: string) {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    is: () => chain,
    maybeSingle: () =>
      Promise.resolve({ data: { owner_farmer_id: "owner-1", land_size: 33 }, error: null }),
    then: undefined,
  };
  if (table === "land_relations") {
    // Resolve to empty relations (owner-only billing).
    return { ...chain, select: () => ({ eq: () => ({ is: () => Promise.resolve({ data: [], error: null }) }) }) };
  }
  return chain;
}

beforeEach(() => {
  rpcMock.mockReset();
  fromMock.mockReset();
  fromMock.mockImplementation((table: string) => tableStub(table));
});

describe("resolveBilledFarmer — RPC missing fallback", () => {
  it("falls back to the land owner and logs the fallback when the RPC is missing", async () => {
    // First RPC call (get_billed_farmer_for_land) fails → triggers fallback.
    // Subsequent calls (log_rpc_fallback) succeed.
    rpcMock.mockImplementation((name: string) => {
      if (name === "get_billed_farmer_for_land") {
        return Promise.resolve({ data: null, error: new Error("function does not exist") });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const { resolveBilledFarmer } = await import("../irrigationInvoice");
    const result = await resolveBilledFarmer("land-1", "2026-07-01");

    expect(result.owner_farmer_id).toBe("owner-1");
    expect(result.billed_farmer_id).toBe("owner-1");
    expect(result.is_borga).toBe(false);

    // The fallback must have been audited.
    const loggedFallback = rpcMock.mock.calls.some(
      ([name, payload]) =>
        name === "log_rpc_fallback" &&
        payload?.rpc === "get_billed_farmer_for_land" &&
        payload?.land_id === "land-1" &&
        typeof payload?.request_id === "string",
    );
    expect(loggedFallback).toBe(true);
  });
});
