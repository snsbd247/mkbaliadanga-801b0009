import { describe, it, expect } from "vitest";
import { validateSerialStart, validateWatermark } from "@/lib/receiptTemplateValidation";

describe("validateSerialStart", () => {
  it("rejects empty input", () => {
    expect(validateSerialStart("")).toContain("Serial start is required");
    expect(validateSerialStart("   ")).toContain("Serial start is required");
  });
  it("rejects non-integer input", () => {
    expect(validateSerialStart("12.5")).toContain("positive whole numbers");
    expect(validateSerialStart("abc")).toContain("positive whole numbers");
    expect(validateSerialStart("-5")).toContain("positive whole numbers");
  });
  it("rejects values that are too large", () => {
    expect(validateSerialStart("9000000001")).toContain("too large");
  });
  it("accepts valid whole numbers", () => {
    expect(validateSerialStart("0")).toBeNull();
    expect(validateSerialStart("4641")).toBeNull();
  });
});

describe("validateWatermark", () => {
  it("skips validation when watermark is disabled", () => {
    expect(validateWatermark(false, "")).toBeNull();
  });
  it("requires text when enabled", () => {
    expect(validateWatermark(true, "")).toContain("Watermark text is required");
    expect(validateWatermark(true, "   ")).toContain("Watermark text is required");
  });
  it("rejects text longer than 40 characters", () => {
    expect(validateWatermark(true, "x".repeat(41))).toContain("40 characters");
  });
  it("accepts valid watermark text", () => {
    expect(validateWatermark(true, "Mohammadkhani")).toBeNull();
  });
});
