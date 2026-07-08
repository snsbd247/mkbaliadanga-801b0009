import { describe, it, expect } from "vitest";
import { savingsNoOf, buildMemberSummary } from "@/lib/receiptMemberSummary";

describe("savingsNoOf", () => {
  it("returns the account number for an active member", () => {
    expect(savingsNoOf({ account_number: "123", savings_inactive: false })).toBe("123");
    expect(savingsNoOf({ account_number: 456 })).toBe("456");
    expect(savingsNoOf({ account_number: "123", is_voter: true })).toBe("123");
    expect(savingsNoOf({ account_number: "01711", is_voter: false })).toBe("01711");
    expect(savingsNoOf({ voter_number: "789", is_voter: true })).toBe("789");
  });
  it("returns null for inactive / missing savings number", () => {
    expect(savingsNoOf({ account_number: "123", savings_inactive: true })).toBeNull();
    expect(savingsNoOf({ account_number: null })).toBeNull();
    expect(savingsNoOf({ account_number: "" })).toBeNull();
    expect(savingsNoOf({ member_no: "02473", farmer_code: "02473" } as any)).toBeNull();
    expect(savingsNoOf(null)).toBeNull();
    expect(savingsNoOf(undefined)).toBeNull();
  });
});

describe("buildMemberSummary", () => {
  const cultivator = { account_number: "111" };
  const owner = { account_number: "222" };

  it("own land shows only the cultivator savings no", () => {
    expect(buildMemberSummary({ cultivator, owner: null, isBorga: false })).toBe("111");
  });

  it("own land uses savings number, never farmer id/member code", () => {
    expect(buildMemberSummary({
      cultivator: { account_number: "01711", member_no: "02473", farmer_code: "02473", is_voter: false } as any,
      owner: null,
      isBorga: false,
    })).toBe("01711");
  });

  // Regression: receipt no. 4683 — cultivator is also the land owner (self land).
  // The "কৃষক এবং মালিক সভ্য সদস্য" field must show Savings Number 01711,
  // never the Farmer ID 02473.
  it("receipt 4683: self-land owner shows savings number 01711, not farmer id 02473", () => {
    const self = { account_number: "01711", member_no: "02473", farmer_code: "02473", is_voter: false } as any;
    const summary = buildMemberSummary({ cultivator: self, owner: self, isBorga: false });
    expect(summary).toBe("01711");
    expect(summary).not.toContain("02473");
  });

  // Validation guard: if the Farmer ID accidentally lands in account_number,
  // savingsNoOf must reject it rather than display the Farmer ID.
  it("rejects farmer id used as a savings-number fallback", () => {
    expect(savingsNoOf({ account_number: "02473", member_no: "02473", farmer_code: "02473" } as any)).toBeNull();
  });

  it("borga land shows বর্গাদার savings / মালিক savings when both exist", () => {
    expect(buildMemberSummary({
      cultivator: { account_number: "01711" },
      owner: { account_number: "01925" },
      isBorga: true,
    })).toBe("01711/01925");
  });

  it("own land with non-member cultivator shows নাই", () => {
    expect(buildMemberSummary({ cultivator: { savings_inactive: true }, owner: null, isBorga: false })).toBe("নাই");
  });

  it("borga land shows cultivator/owner in that order", () => {
    expect(buildMemberSummary({ cultivator, owner, isBorga: true })).toBe("111/222");
  });

  it("borga land shows the owner account number even when voter flag is false", () => {
    expect(buildMemberSummary({ cultivator, owner: { account_number: "999", is_voter: false }, isBorga: true })).toBe("111/999");
  });

  it("borga land uses cultivator savings first and owner savings second", () => {
    expect(buildMemberSummary({
      cultivator: { account_number: "01711", member_no: "02473", farmer_code: "02473" } as any,
      owner: { account_number: "01925", member_no: "08888", farmer_code: "08888" } as any,
      isBorga: true,
    })).toBe("01711/01925");
  });

  it("borga land falls back to নাই for missing sides", () => {
    expect(buildMemberSummary({ cultivator, owner: null, isBorga: true })).toBe("111/নাই");
    expect(buildMemberSummary({ cultivator: null, owner, isBorga: true })).toBe("নাই/222");
    expect(buildMemberSummary({ cultivator: null, owner: null, isBorga: true })).toBe("নাই/নাই");
  });
});
