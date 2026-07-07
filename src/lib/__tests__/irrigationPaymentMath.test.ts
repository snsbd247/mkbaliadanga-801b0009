import { describe, it, expect } from "vitest";
import {
  sumDue,
  exceedsDue,
  hasShortfall,
  allocateOldestFirst,
} from "@/lib/irrigationPaymentMath";

describe("irrigation payment math — rounding & tolerance", () => {
  it("does NOT flag exceeds when collecting the exact due of 1288", () => {
    expect(exceedsDue(1288, 1288)).toBe(false);
  });

  it("does NOT flag exceeds under floating-point drift", () => {
    expect(exceedsDue(1288.0000001, 1288)).toBe(false);
    expect(exceedsDue(0.1 + 0.2, 0.3)).toBe(false);
  });

  it("flags exceeds only when clearly over the due", () => {
    expect(exceedsDue(1289, 1288)).toBe(true);
    expect(exceedsDue(1288.4, 1288)).toBe(false); // within 0.5 tolerance
    expect(exceedsDue(1288.6, 1288)).toBe(true);
  });

  it("hasShortfall ignores rounding noise", () => {
    expect(hasShortfall(0.4)).toBe(false);
    expect(hasShortfall(0)).toBe(false);
    expect(hasShortfall(1)).toBe(true);
  });

  it("sumDue totals selected invoices", () => {
    expect(sumDue([{ due_amount: 788 }, { due_amount: 500 }])).toBe(1288);
    expect(sumDue([])).toBe(0);
  });
});

describe("irrigation payment math — multi-invoice allocation", () => {
  const invs = [
    { id: "old", due_date: "2025-01-01", due_amount: 500 },
    { id: "new", due_date: "2025-07-01", due_amount: 788 },
  ];

  it("covers oldest invoice first and records covered ids", () => {
    const r = allocateOldestFirst(invs, 600);
    expect(r.takes.old).toBe(500);
    expect(r.takes.new).toBe(100);
    expect(r.covered).toEqual(["old", "new"]);
    expect(r.remaining).toBe(0);
  });

  it("only covers what is paid (partial)", () => {
    const r = allocateOldestFirst(invs, 300);
    expect(r.takes.old).toBe(300);
    expect(r.covered).toEqual(["old"]);
    expect(r.takes.new).toBeUndefined();
  });

  it("never over-allocates beyond total due", () => {
    const r = allocateOldestFirst(invs, 2000);
    expect(r.takes.old).toBe(500);
    expect(r.takes.new).toBe(788);
    expect(r.remaining).toBe(712);
  });

  it("fully covers exact total of 1288", () => {
    const r = allocateOldestFirst(invs, 1288);
    expect(r.covered).toEqual(["old", "new"]);
    expect(r.remaining).toBe(0);
  });
});
