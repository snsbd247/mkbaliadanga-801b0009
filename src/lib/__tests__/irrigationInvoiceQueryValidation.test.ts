import { describe, it, expect } from "vitest";
import {
  validateStep4Query,
  isStep4QueryValid,
} from "../irrigationInvoiceQueryValidation";

describe("validateStep4Query (bilingual)", () => {
  it("passes a valid query", () => {
    expect(
      isStep4QueryValid({ office_id: "off-1", from: "2026-01-01", to: "2026-01-31" })
    ).toBe(true);
  });

  it("requires office with bilingual message", () => {
    const errs = validateStep4Query({ from: "2026-01-01" });
    const office = errs.find((e) => e.field === "office_id")!;
    expect(office.en).toMatch(/Office/);
    expect(office.bn).toMatch(/অফিস/);
  });

  it("rejects malformed dates in both languages", () => {
    const errs = validateStep4Query({ office_id: "off-1", from: "2026/01/01" });
    expect(errs.some((e) => e.field === "from" && e.bn.length > 0)).toBe(true);
  });

  it("rejects an inverted date range", () => {
    const errs = validateStep4Query({
      office_id: "off-1",
      from: "2026-02-01",
      to: "2026-01-01",
    });
    expect(errs.some((e) => e.field === "to")).toBe(true);
  });
});
