import { describe, expect, it } from "vitest";
import { invoiceBilledArea } from "@/lib/irrigationInvoiceArea";

describe("invoiceBilledArea", () => {
  it("uses billed_area_shotok when it is present", () => {
    expect(invoiceBilledArea({ billed_area_shotok: 0.2, lands: { land_size: 0.4 } })).toBe(0.2);
  });

  it("recovers legacy share area from amount and rate before falling back to parcel size", () => {
    expect(invoiceBilledArea({
      billed_area_shotok: null,
      irrigation_amount: 727,
      applied_rate: 3637,
      lands: { land_size: 0.4 },
      calculation_snapshot: { land_size_shotok: 0.4, parcel_size_shotok: 0.4 },
    })).toBe(0.2);
  });
});