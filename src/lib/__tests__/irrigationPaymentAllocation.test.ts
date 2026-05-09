import { describe, it, expect } from "vitest";
import { allocateFifo, splitCurrentByHeads } from "@/lib/irrigationPaymentAllocation";

describe("allocateFifo", () => {
  it("returns empty when collected = 0", () => {
    expect(allocateFifo([{ id: "a", due_date: "2026-01-01", due_amount: 100 }], 0)).toEqual({});
  });
  it("allocates oldest first and stops when exhausted", () => {
    const out = allocateFifo([
      { id: "a", due_date: "2026-02-01", due_amount: 100 },
      { id: "b", due_date: "2026-01-01", due_amount: 60 },
      { id: "c", due_date: "2026-03-01", due_amount: 50 },
    ], 130);
    expect(out).toEqual({ b: 60, a: 70 });
  });
  it("never exceeds an invoice due", () => {
    const out = allocateFifo([{ id: "a", due_date: "2026-01-01", due_amount: 50 }], 999);
    expect(out).toEqual({ a: 50 });
  });
});

describe("splitCurrentByHeads", () => {
  it("puts everything to irrigation when no overhead", () => {
    expect(splitCurrentByHeads({ collected: 500, irrigation: 500, delay: 0, maintenance: 0, canal: 0 }))
      .toEqual({ irrigation: 500, delay: 0, maintenance: 0, canal: 0 });
  });
  it("scales overhead heads proportionally on partial collection", () => {
    const out = splitCurrentByHeads({ collected: 50, irrigation: 80, delay: 20, maintenance: 10, canal: 10 });
    // overhead total 40, scale = min(1, 50/40) = 1, so full overhead taken; irr = 50-40 = 10
    expect(out).toEqual({ irrigation: 10, delay: 20, maintenance: 10, canal: 10 });
  });
  it("partial: collected less than overhead", () => {
    const out = splitCurrentByHeads({ collected: 20, irrigation: 80, delay: 20, maintenance: 10, canal: 10 });
    // scale = 20/40 = 0.5, delay=10, maint=5, canal=5, irr=0
    expect(out).toEqual({ irrigation: 0, delay: 10, maintenance: 5, canal: 5 });
  });
  it("handles zero collected", () => {
    expect(splitCurrentByHeads({ collected: 0, irrigation: 0, delay: 0, maintenance: 0, canal: 0 }))
      .toEqual({ irrigation: 0, delay: 0, maintenance: 0, canal: 0 });
  });
});
