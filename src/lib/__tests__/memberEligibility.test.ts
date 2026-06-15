import { describe, it, expect } from "vitest";
import { isValidMemberNo, evaluateMemberEligibility } from "@/lib/memberEligibility";

const tx = (en: string, _bn: string) => en;

describe("isValidMemberNo", () => {
  it("accepts zero-padded numeric codes", () => {
    expect(isValidMemberNo("00001")).toBe(true);
    expect(isValidMemberNo("12345")).toBe(true);
  });
  it("accepts alphanumeric with hyphen/slash containing a digit", () => {
    expect(isValidMemberNo("MK-01")).toBe(true);
    expect(isValidMemberNo("2024/7")).toBe(true);
  });
  it("rejects empty / whitespace / null / undefined", () => {
    expect(isValidMemberNo("")).toBe(false);
    expect(isValidMemberNo("   ")).toBe(false);
    expect(isValidMemberNo(null)).toBe(false);
    expect(isValidMemberNo(undefined)).toBe(false);
  });
  it("rejects values with no digit or invalid chars or over length", () => {
    expect(isValidMemberNo("ABCD")).toBe(false);
    expect(isValidMemberNo("12 34")).toBe(false);
    expect(isValidMemberNo("1".repeat(21))).toBe(false);
  });
  it("rejects disallowed special characters and whitespace edge cases", () => {
    expect(isValidMemberNo("12#34")).toBe(false);
    expect(isValidMemberNo("12.34")).toBe(false);
    expect(isValidMemberNo("১২৩")).toBe(false); // Bangla digits are not ASCII-valid
    expect(isValidMemberNo("\t007\n")).toBe(true); // trimmed then valid
  });
  it("accepts boundary lengths (1 and 20 chars)", () => {
    expect(isValidMemberNo("7")).toBe(true);
    expect(isValidMemberNo("1".repeat(20))).toBe(true);
  });
});

describe("evaluateMemberEligibility (savings/loans rule)", () => {
  it("allows active member with valid member number", () => {
    const r = evaluateMemberEligibility({ status: "active", member_no: "00007", name_en: "A" }, tx);
    expect(r.ok).toBe(true);
  });
  it("blocks inactive member even with member number", () => {
    const r = evaluateMemberEligibility({ status: "inactive", member_no: "00007", name_en: "A" }, tx);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/not an active member/i);
  });
  it("blocks active member without a valid member number", () => {
    const r = evaluateMemberEligibility({ status: "active", member_no: "", name_en: "A" }, tx);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/member number/i);
  });
  it("blocks when farmer is missing", () => {
    expect(evaluateMemberEligibility(null, tx).ok).toBe(false);
  });
});
