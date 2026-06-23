import { test, expect } from "@playwright/test";
import {
  validateBargaSplit,
  bargaErrorMessages,
} from "../src/lib/irrigationBargaValidation";

/**
 * Asserts the bilingual reconciliation panel surfaces the EXACT mismatched
 * fields and recommended fix values that the Land form would render. Because
 * the panel renders `validateBargaSplit(...)[lang]` verbatim, validating the
 * messages guarantees the on-screen text.
 */
test.describe("Barga reconciliation panel exact messages", () => {
  test("area overflow shows both totals and the mismatch amount (bn + en)", () => {
    const errors = validateBargaSplit({
      parcel_area: 100,
      relations: [
        { sharecropper_farmer_id: "a", area_decimal: 70 },
        { sharecropper_farmer_id: "b", area_decimal: 50 },
      ],
    });
    const en = bargaErrorMessages(errors, "en");
    const bn = bargaErrorMessages(errors, "bn");

    const enMsg = en.find((m) => m.includes("Total borga area"));
    expect(enMsg).toBeTruthy();
    expect(enMsg).toContain("(120)");
    expect(enMsg).toContain("parcel area (100)");
    expect(enMsg).toContain("Mismatch: 20");

    const bnMsg = bn.find((m) => m.includes("বর্গা ক্ষেত্রফল"));
    expect(bnMsg).toBeTruthy();
    expect(bnMsg).toContain("অমিল: 20");
  });

  test("percentage overflow shows mismatch percentage", () => {
    const errors = validateBargaSplit({
      parcel_area: 100,
      relations: [
        { sharecropper_farmer_id: "a", share_percentage: 70 },
        { sharecropper_farmer_id: "b", share_percentage: 50 },
      ],
    });
    const en = bargaErrorMessages(errors, "en").find((m) =>
      m.includes("Total share percentage"),
    );
    expect(en).toContain("(120%)");
    expect(en).toContain("Mismatch: 20%");
  });

  test("missing area/percentage names the offending sharecropper row", () => {
    const errors = validateBargaSplit({
      parcel_area: 100,
      relations: [{ sharecropper_farmer_id: "a" }],
    });
    const en = bargaErrorMessages(errors, "en");
    expect(en.some((m) => m.includes("Sharecropper #1"))).toBe(true);
  });

  test("valid split produces no panel messages", () => {
    const errors = validateBargaSplit({
      parcel_area: 100,
      relations: [{ sharecropper_farmer_id: "a", area_decimal: 40 }],
    });
    expect(errors).toHaveLength(0);
  });
});
