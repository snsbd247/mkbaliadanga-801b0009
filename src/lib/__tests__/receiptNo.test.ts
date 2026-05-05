import { describe, it, expect } from "vitest";
import { autoReceiptNo, normalizeReceiptNo, isValidManualReceiptNo, normalizeShotok } from "../receiptNo";

describe("autoReceiptNo", () => {
  it("formats kind-YMD-tail", () => {
    const r = autoReceiptNo("PAY", "abc12345-xyz", new Date("2026-05-05T00:00:00Z"));
    expect(r).toMatch(/^PAY-20260505-[A-Z0-9]{6}$/);
  });
  it("pads short seeds", () => {
    const r = autoReceiptNo("SAV", "ab", new Date("2026-01-09T00:00:00Z"));
    expect(r).toBe("SAV-20260109-0000AB");
  });
  it("strips punctuation from seed", () => {
    const r = autoReceiptNo("LOAN", "!!a-b/c1!!", new Date("2026-12-31T00:00:00Z"));
    expect(r).toMatch(/^LOAN-20261231-[A-Z0-9]{6}$/);
    expect(r.endsWith("0ABC1") || r.endsWith("AABBC1")).toBe(false);
  });
});

describe("normalizeReceiptNo", () => {
  it("returns null for empty / whitespace", () => {
    expect(normalizeReceiptNo("")).toBeNull();
    expect(normalizeReceiptNo("   ")).toBeNull();
    expect(normalizeReceiptNo(null)).toBeNull();
    expect(normalizeReceiptNo(undefined)).toBeNull();
  });
  it("uppercases and dash-joins spaces", () => {
    expect(normalizeReceiptNo("  rcpt 12 ab ")).toBe("RCPT-12-AB");
  });
});

describe("isValidManualReceiptNo", () => {
  it.each([
    ["RCPT-001", true],
    ["AB1", true],
    ["A/12-9/Z", true],
    ["AB", false],         // too short
    ["", false],
    ["-AB1", false],       // leading dash
    ["AB1-", false],       // trailing dash
    ["RC PT", false],      // space
    ["RC#1", false],       // bad char
  ])("validates %s -> %s", (v, ok) => {
    expect(isValidManualReceiptNo(v)).toBe(ok);
  });
  it("rejects > 32 chars", () => {
    expect(isValidManualReceiptNo("A".repeat(33))).toBe(false);
    expect(isValidManualReceiptNo("A".repeat(32))).toBe(true);
  });
});

describe("normalizeShotok", () => {
  it("rounds to 2dp", () => {
    expect(normalizeShotok(3.336)).toBe(3.34);
    expect(normalizeShotok("12.5")).toBe(12.5);
  });
  it("clamps negatives & invalid to 0", () => {
    expect(normalizeShotok(-1)).toBe(0);
    expect(normalizeShotok("abc")).toBe(0);
    expect(normalizeShotok(null)).toBe(0);
  });
});
