import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { autoReceiptNo } from "@/lib/receiptNo";

/**
 * Audit/regression test: every place that generates a receipt PDF must use the
 * canonical `autoReceiptNo(...)` helper with one of the agreed prefixes.
 * This guards against drift like `SAV-${id.slice(0,8)}` reappearing.
 */
const FILES = [
  "src/pages/Payments.tsx",
  "src/pages/ScanPayment.tsx",
  "src/pages/FarmerDetail.tsx",
];

describe("receipt_no format consistency", () => {
  it("autoReceiptNo emits PREFIX-YYYYMMDD-XXXXXX", () => {
    const r = autoReceiptNo("IRR", "abcdef123456", new Date("2026-05-06T00:00:00Z"));
    expect(r).toMatch(/^IRR-20260506-[A-Z0-9]{6}$/);
  });

  it("kind → prefix mapping is consistent (SAV/LOAN/IRR)", () => {
    expect(autoReceiptNo("SAV", "x").startsWith("SAV-")).toBe(true);
    expect(autoReceiptNo("LOAN", "x").startsWith("LOAN-")).toBe(true);
    expect(autoReceiptNo("IRR", "x").startsWith("IRR-")).toBe(true);
  });

  for (const f of FILES) {
    it(`${f} uses autoReceiptNo and no ad-hoc id.slice receipt format`, () => {
      const src = readFileSync(f, "utf8");
      expect(src).toContain("autoReceiptNo");
      // No legacy template-literal forms like `SAV-${...slice(0, 8)`.
      expect(src).not.toMatch(/`(SAV|LOAN|IRR)-\$\{[^}]*slice/);
    });
  }
});
