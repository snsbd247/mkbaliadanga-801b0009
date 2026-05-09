import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { normalizeFarmerCode, formatFarmerCode, isCanonicalFarmerCode, FARMER_CODE_RE } from "../farmerCode";

describe("normalizeFarmerCode", () => {
  it.each([
    ["00001", "00001"],
    ["F-00001", "00001"],
    ["f-1", "00001"],
    ["  00042 ", "00042"],
    ["2026-00000001", "00001"],
    ["1", "00001"],
    [1, "00001"],
    ["12345", "12345"],
    ["123456", "123456"], // already wider than pad
  ])("normalizes %p -> %p", (input, expected) => {
    const r = normalizeFarmerCode(input as any);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(expected);
  });

  it.each([
    ["", "empty"],
    [null, "null"],
    [undefined, "undefined"],
    ["abc", "letters only"],
    ["F-abc", "non-digit body"],
    ["12 34", "internal space"],
    ["1".repeat(20), "too long"],
  ])("rejects %p (%s)", (input) => {
    const r = normalizeFarmerCode(input as any);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Farmer ID|valid|empty|too long/);
  });
});

describe("isCanonicalFarmerCode / formatFarmerCode", () => {
  it("recognizes canonical form", () => {
    expect(isCanonicalFarmerCode("00001")).toBe(true);
    expect(isCanonicalFarmerCode("F-00001")).toBe(false);
    expect(FARMER_CODE_RE.test("00001")).toBe(true);
  });
  it("formatFarmerCode returns canonical when possible", () => {
    expect(formatFarmerCode("F-00001")).toBe("00001");
    expect(formatFarmerCode("00007")).toBe("00007");
    expect(formatFarmerCode(null)).toBe("");
    expect(formatFarmerCode("")).toBe("");
    // Junk passes through unchanged so legacy data stays visible.
    expect(formatFarmerCode("???")).toBe("???");
  });
});

/**
 * Regression guard: no source file should hard-code the legacy "F-NNNNN"
 * farmer code style. If a sample/test/snapshot needs it, allowlist below.
 */
describe("farmer_code formatting consistency across modules", () => {
  const ALLOWLIST = new Set<string>([
    // None — every previous "F-" sample has been migrated to canonical form.
  ]);

  const FILES = [
    "src/pages/Farmers.tsx",
    "src/pages/FarmersImport.tsx",
    "src/pages/IrrigationInvoices.tsx",
    "src/pages/Savings.tsx",
    "src/pages/Loans.tsx",
    "src/pages/Payments.tsx",
    "src/pages/Settings.tsx",
    "src/lib/bnReceipts.ts",
    "src/lib/irrigationInvoicePdf.ts",
    "src/lib/irrigationExports.ts",
    "src/lib/paymentReceiptPdf.ts",
    "src/lib/exports.ts",
  ];

  for (const f of FILES) {
    if (ALLOWLIST.has(f)) continue;
    it(`${f} contains no hard-coded "F-NNNNN" farmer codes`, () => {
      const src = readFileSync(f, "utf8");
      // Match explicit farmer_code literals like "F-00001" / `F-12` etc.
      const offenders = src.match(/["'`]F-\d{2,}["'`]/g) ?? [];
      expect(offenders, `Found legacy farmer codes in ${f}: ${offenders.join(", ")}`).toEqual([]);
    });
  }
});
