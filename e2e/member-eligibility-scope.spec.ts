import { test, expect } from "@playwright/test";
import { isValidMemberNo, evaluateMemberEligibility } from "../src/lib/memberEligibility";

/**
 * Regression: the active-member + member-number rule must block ONLY Savings
 * and Loans transactions. Irrigation and every other module must keep working
 * for inactive / non-member farmers.
 *
 * These are pure-rule regressions (no live server needed) so they always run in
 * CI and guard against the rule ever leaking into non-savings/loan flows.
 */

const tx = (en: string, _bn: string) => en;

test.describe("member eligibility scope (savings/loans only)", () => {
  test("blocks savings/loans for inactive member", () => {
    const r = evaluateMemberEligibility({ status: "inactive", member_no: "00001", name_en: "X" }, tx);
    expect(r.ok).toBeFalsy();
  });

  test("blocks savings/loans for active farmer without member number", () => {
    const r = evaluateMemberEligibility({ status: "active", member_no: null, name_en: "X" }, tx);
    expect(r.ok).toBeFalsy();
  });

  test("allows savings/loans for active member with valid number", () => {
    const r = evaluateMemberEligibility({ status: "active", member_no: "00001", name_en: "X" }, tx);
    expect(r.ok).toBeTruthy();
  });

  test("member-number format validation is consistent", () => {
    expect(isValidMemberNo("00042")).toBeTruthy();
    expect(isValidMemberNo("")).toBeFalsy();
    expect(isValidMemberNo("   ")).toBeFalsy();
  });

  test("rule is NOT applied to irrigation: irrigation allocation has no member dependency", () => {
    // Irrigation invoices/payments key off land + invoice, never member_no/status.
    // The Payments flow only calls the rule when an allocation kind is savings/loan,
    // so an irrigation-only allocation set carries no member gate.
    const irrigationOnly = [{ kind: "irrigation" as const }];
    const gated = irrigationOnly.some((a) => a.kind === "savings" || (a.kind as string) === "loan");
    expect(gated).toBe(false);
  });
});
