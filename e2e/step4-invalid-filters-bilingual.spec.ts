import { test, expect } from "@playwright/test";
import { validateStep4Query } from "../src/lib/irrigationInvoiceQueryValidation";

/**
 * ধাপ ৪ — Invalid Step 4 query filters return bilingual validation errors.
 * The same validator runs inline (UI) and on the server, so testing it here
 * guarantees the messages displayed to the user match the API responses.
 */
test("invalid Step 4 filters produce bilingual (English + Bangla) errors", () => {
  const missingOffice = validateStep4Query({ from: "2026-01-01" });
  expect(missingOffice.some((e) => e.field === "office_id" && /Office/.test(e.en) && /অফিস/.test(e.bn))).toBe(true);

  const badDate = validateStep4Query({ office_id: "off-1", from: "01-2026-99" });
  expect(badDate.some((e) => e.field === "from" && e.en.length > 0 && e.bn.length > 0)).toBe(true);

  const inverted = validateStep4Query({ office_id: "off-1", from: "2026-02-01", to: "2026-01-01" });
  expect(inverted.some((e) => e.field === "to" && /after/.test(e.en) && e.bn.includes("পরে"))).toBe(true);

  // A valid query yields no errors.
  expect(validateStep4Query({ office_id: "off-1", from: "2026-01-01", to: "2026-01-31" })).toHaveLength(0);
});
