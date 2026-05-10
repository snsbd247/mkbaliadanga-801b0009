import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client", () => {
  const state: any = { rows: [] as any[] };
  const builder = (table: string) => {
    let chain: any = {};
    let mode: "select" | "update" | "insert" = "select";
    let updates: any = null, payload: any = null;
    let filters: Array<[string, any]> = [];
    chain.select = () => chain;
    chain.eq = (k: string, v: any) => { filters.push([k, v]); return chain; };
    chain.maybeSingle = async () => {
      const found = state.rows.find((r) => filters.every(([k, v]) => r[k] === v && r.__table === table));
      return { data: found ?? null, error: null };
    };
    chain.update = (u: any) => { mode = "update"; updates = u; return chain; };
    chain.insert = (p: any) => {
      const arr = Array.isArray(p) ? p : [p];
      arr.forEach((r) => state.rows.push({ ...r, id: crypto.randomUUID(), __table: table }));
      return { error: null };
    };
    // execute update via .eq chain end (no terminal)
    Object.defineProperty(chain, "_exec", {
      value: () => {
        if (mode === "update") {
          for (const r of state.rows) {
            if (r.__table === table && filters.every(([k, v]) => r[k] === v)) Object.assign(r, updates);
          }
          return { error: null };
        }
        return { error: null };
      },
    });
    // proxy await on chain to run update
    return new Proxy(chain, {
      get(t, p) {
        if (p === "then") return (res: any) => res({ error: null });
        return (t as any)[p];
      },
    });
  };
  return { supabase: { from: (t: string) => builder(t), state } };
});

import { adjustAssetStock } from "../assetStock";

describe("adjustAssetStock", () => {
  beforeEach(() => {});
  it("rejects without location", async () => {
    await expect(adjustAssetStock({ asset_id: "a", office_id: null, location_id: null, delta: 1 }))
      .rejects.toThrow(/location_id/);
  });
  it("inserts new row when delta > 0 and none exists", async () => {
    const v = await adjustAssetStock({ asset_id: "a1", office_id: "o", location_id: "L1", delta: 5 });
    expect(v).toBe(5);
  });
  it("does not insert when delta <= 0 and none exists", async () => {
    const v = await adjustAssetStock({ asset_id: "a2", office_id: "o", location_id: "L2", delta: -3 });
    expect(v).toBe(0);
  });
});
