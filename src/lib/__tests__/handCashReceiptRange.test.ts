import { describe, it, expect } from "vitest";
import { receiptNum, receiptRange } from "@/lib/handCash";

describe("receiptNum", () => {
  it("extracts the leading integer", () => {
    expect(receiptNum("4683")).toBe(4683);
    expect(receiptNum("R-4690")).toBe(4690);
    expect(receiptNum(4691)).toBe(4691);
  });
  it("returns NaN for non-numeric values", () => {
    expect(Number.isNaN(receiptNum("abc"))).toBe(true);
    expect(Number.isNaN(receiptNum(null))).toBe(true);
    expect(Number.isNaN(receiptNum(undefined))).toBe(true);
  });
});

describe("receiptRange", () => {
  it("sorts numerically to find from/to regardless of input order", () => {
    expect(receiptRange(["4690", "4683", "4685"])).toEqual({ from: "4683", to: "4690" });
    expect(receiptRange(["4705", "4691"])).toEqual({ from: "4691", to: "4705" });
  });
  it("handles a single receipt", () => {
    expect(receiptRange(["4683"])).toEqual({ from: "4683", to: "4683" });
  });
  it("ignores non-numeric values", () => {
    expect(receiptRange(["R-4683", "bad", "R-4690"])).toEqual({ from: "4683", to: "4690" });
  });
  it("returns empty strings when nothing is numeric", () => {
    expect(receiptRange([])).toEqual({ from: "", to: "" });
    expect(receiptRange(["abc", null])).toEqual({ from: "", to: "" });
  });
});
