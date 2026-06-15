import { describe, it, expect } from "vitest";
import { allocateFifo, splitCurrentByHeads } from "@/lib/irrigationPaymentAllocation";

describe("irrigation payment — জরিমানা stays separate, two-season FIFO", () => {
  it("splits collected amount keeping জরিমানা (delay) out of base irrigation", () => {
    // base land charge 500, জরিমানা 100, maintenance 0, canal 0 → collect 600
    const out = splitCurrentByHeads({ collected: 600, irrigation: 500, delay: 100, maintenance: 0, canal: 0 });
    expect(out.delay).toBe(100); // জরিমানা reported in its own bucket
    expect(out.irrigation).toBe(500); // never mixed into base due
    expect(out.maintenance).toBe(0);
    expect(out.canal).toBe(0);
  });

  it("never lets জরিমানা inflate the base irrigation bucket on partial pay", () => {
    const out = splitCurrentByHeads({ collected: 150, irrigation: 500, delay: 100, maintenance: 0, canal: 0 });
    // delay is capped/scaled but base irrigation is whatever remains, never includes delay portion
    expect(out.delay).toBeLessThanOrEqual(100);
    expect(out.irrigation + out.delay + out.maintenance + out.canal).toBeCloseTo(150, 2);
    expect(out.delay).toBeGreaterThan(0);
  });

  it("collects two seasons in one receipt, oldest due first (FIFO)", () => {
    const prev = { id: "prev", due_date: "2025-01-01", due_amount: 400 };
    const curr = { id: "curr", due_date: "2025-07-01", due_amount: 500 };
    const alloc = allocateFifo([curr, prev], 700);
    expect(alloc.prev).toBe(400); // previous season cleared first
    expect(alloc.curr).toBe(300); // remainder to current season
  });

  it("does not over-allocate beyond a single season's due", () => {
    const alloc = allocateFifo([{ id: "a", due_date: "2025-01-01", due_amount: 200 }], 1000);
    expect(alloc.a).toBe(200);
  });
});
