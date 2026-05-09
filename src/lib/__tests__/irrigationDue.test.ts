import { describe, it, expect } from "vitest";
import { aggregate } from "@/lib/irrigationDue";

describe("irrigationDue.aggregate", () => {
  it("sums payable/paid/due", () => {
    const out = aggregate([
      { payable_amount: 100, paid_amount: 60, due_amount: 40, due_date: "2099-01-01" },
      { payable_amount: 50, paid_amount: 50, due_amount: 0, due_date: "2099-01-01" },
    ]);
    expect(out).toMatchObject({ payable: 150, paid: 110, due: 40, overdue: 0, invoiceCount: 2 });
  });
  it("flags overdue when due_date is in the past and due > 0", () => {
    const past = "2000-01-01";
    const out = aggregate([
      { payable_amount: 100, paid_amount: 0, due_amount: 100, due_date: past },
      { payable_amount: 100, paid_amount: 100, due_amount: 0, due_date: past },
    ]);
    expect(out.overdue).toBe(100);
  });
  it("treats null/undefined as 0", () => {
    const out = aggregate([{ payable_amount: null, paid_amount: undefined, due_amount: "x", due_date: null }]);
    expect(out).toEqual({ payable: 0, paid: 0, due: 0, overdue: 0, invoiceCount: 1 });
  });
  it("returns zeroes for empty input", () => {
    expect(aggregate([])).toEqual({ payable: 0, paid: 0, due: 0, overdue: 0, invoiceCount: 0 });
  });
});
