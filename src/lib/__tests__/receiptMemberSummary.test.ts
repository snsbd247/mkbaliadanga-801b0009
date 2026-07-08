import { describe, it, expect } from "vitest";
import { savingsNoOf, buildMemberSummary } from "@/lib/receiptMemberSummary";

describe("savingsNoOf", () => {
  it("returns the account number for an active member", () => {
    expect(savingsNoOf({ account_number: "123", savings_inactive: false })).toBe("123");
    expect(savingsNoOf({ account_number: 456 })).toBe("456");
  });
  it("returns null for inactive / non-member / missing", () => {
    expect(savingsNoOf({ account_number: "123", savings_inactive: true })).toBeNull();
    expect(savingsNoOf({ account_number: null })).toBeNull();
    expect(savingsNoOf({ account_number: "" })).toBeNull();
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

  it("own land with non-member cultivator shows N/A", () => {
    expect(buildMemberSummary({ cultivator: { savings_inactive: true }, owner: null, isBorga: false })).toBe("N/A");
  });

  it("borga land shows cultivator/owner in that order", () => {
    expect(buildMemberSummary({ cultivator, owner, isBorga: true })).toBe("111/222");
  });

  it("borga land falls back to N/A for missing sides", () => {
    expect(buildMemberSummary({ cultivator, owner: null, isBorga: true })).toBe("111/N/A");
    expect(buildMemberSummary({ cultivator: null, owner, isBorga: true })).toBe("N/A/222");
    expect(buildMemberSummary({ cultivator: null, owner: null, isBorga: true })).toBe("N/A/N/A");
  });
});
