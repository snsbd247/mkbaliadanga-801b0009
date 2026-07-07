import { describe, it, expect } from "vitest";
import { resolveReceiptPatwari } from "@/lib/receiptPatwari";

describe("resolveReceiptPatwari", () => {
  it("uses the land patwari when present", () => {
    const land = { name: "Land P", name_bn: "জমি পা", mobile: "011" };
    const manual = { name: "Manual P", name_bn: "ম্যানুয়াল পা", mobile: "022" };
    expect(resolveReceiptPatwari(land, manual)).toEqual({ name: "জমি পা", mobile: "011" });
  });

  it("falls back to the manually selected patwari when the land has none", () => {
    const manual = { name: "Manual P", name_bn: "ম্যানুয়াল পা", mobile: "022" };
    expect(resolveReceiptPatwari(null, manual)).toEqual({ name: "ম্যানুয়াল পা", mobile: "022" });
  });

  it("returns nulls when neither is available", () => {
    expect(resolveReceiptPatwari(null, null)).toEqual({ name: null, mobile: null });
  });

  it("prefers English name when bn is missing", () => {
    expect(resolveReceiptPatwari(null, { name: "Eng", name_bn: null, mobile: null })).toEqual({ name: "Eng", mobile: null });
  });
});
