import { describe, it, expect } from "vitest";
import { savingsNoOf, buildMemberSummary } from "@/lib/receiptMemberSummary";

describe("savingsNoOf", () => {
  it("returns the account number for an active member", () => {
    expect(savingsNoOf({ account_number: "123", savings_inactive: false })).toBe("123");
    expect(savingsNoOf({ account_number: 456 })).toBe("456");
    expect(savingsNoOf({ account_number: "123", is_voter: true })).toBe("123");
    expect(savingsNoOf({ voter_number: "789", is_voter: true })).toBe("789");
  });
  it("returns null for inactive / non-voter / non-member / missing", () => {
    expect(savingsNoOf({ account_number: "123", savings_inactive: true })).toBeNull();
    expect(savingsNoOf({ account_number: "123", is_voter: false })).toBeNull();
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

  it("own land with non-member cultivator shows নাই", () => {
    expect(buildMemberSummary({ cultivator: { savings_inactive: true }, owner: null, isBorga: false })).toBe("নাই");
  });

  it("borga land shows cultivator/owner in that order", () => {
    expect(buildMemberSummary({ cultivator, owner, isBorga: true })).toBe("111/222");
  });

  it("borga land shows নাই for a non-voter owner without savings", () => {
    expect(buildMemberSummary({ cultivator, owner: { account_number: "999", is_voter: false }, isBorga: true })).toBe("111/নাই");
  });

  it("borga land falls back to নাই for missing sides", () => {
    expect(buildMemberSummary({ cultivator, owner: null, isBorga: true })).toBe("111/নাই");
    expect(buildMemberSummary({ cultivator: null, owner, isBorga: true })).toBe("নাই/222");
    expect(buildMemberSummary({ cultivator: null, owner: null, isBorga: true })).toBe("নাই/নাই");
  });
});
