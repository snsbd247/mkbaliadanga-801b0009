import { describe, it, expect } from "vitest";
import {
  validateFarmerCode,
  FARMER_CODE_MESSAGES,
  FARMER_CODE_MIN,
  FARMER_CODE_MAX,
} from "@/lib/legacyFarmerCode";

describe("Legacy Irrigation search — farmer code only", () => {
  it("accepts a valid numeric farmer code", () => {
    expect(validateFarmerCode("2473")).toBeNull();
    expect(validateFarmerCode("123")).toBeNull();
    expect(validateFarmerCode("  456  ")).toBeNull(); // trimmed
  });

  it("rejects empty input", () => {
    expect(validateFarmerCode("")).toBe("empty");
    expect(validateFarmerCode("   ")).toBe("empty");
  });

  it("rejects non-digit input (mobile with letters, farmer ID, mixed)", () => {
    expect(validateFarmerCode("abc")).toBe("non_digit");
    expect(validateFarmerCode("2473a")).toBe("non_digit");
    expect(validateFarmerCode("017-000")).toBe("non_digit");
    expect(validateFarmerCode("FID123")).toBe("non_digit");
  });

  it("rejects codes shorter than the minimum", () => {
    expect(validateFarmerCode("1")).toBe("too_short");
    expect(validateFarmerCode("12")).toBe("too_short");
    expect(validateFarmerCode("1".repeat(FARMER_CODE_MIN))).toBeNull();
  });

  it("rejects codes longer than the maximum", () => {
    expect(validateFarmerCode("1".repeat(FARMER_CODE_MAX))).toBeNull();
    expect(validateFarmerCode("1".repeat(FARMER_CODE_MAX + 1))).toBe("too_long");
  });

  it("has both Bangla and English messages for every error", () => {
    (["empty", "non_digit", "too_short", "too_long"] as const).forEach((key) => {
      expect(FARMER_CODE_MESSAGES[key].en.length).toBeGreaterThan(0);
      expect(FARMER_CODE_MESSAGES[key].bn.length).toBeGreaterThan(0);
    });
  });
});
