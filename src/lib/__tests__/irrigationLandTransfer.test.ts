import { describe, it, expect } from "vitest";
import { calcInvoice, DEFAULT_SETTINGS } from "@/lib/irrigationInvoice";
import { recalcAfterTransfer } from "@/lib/irrigationLandTransfer";
import { splitBillableArea } from "@/lib/irrigationBargaSplit";

const FUTURE = "2999-12-31";

describe("land transfer — previous due closes, new due opens fresh", () => {
  it("closes the previous holder's open due and opens the new holder's due once", () => {
    const fresh = calcInvoice({ land_size_shotok: 100, rate_per_shotok: 10, settings: DEFAULT_SETTINGS, due_date: FUTURE });
    const r = recalcAfterTransfer({
      previous: { farmer_id: "OLD", payable: 1000, paid: 0 },
      newPayable: fresh.payable_amount,
      newFarmerId: "NEW",
    });
    expect(r.previous.due).toBe(0);
    expect(r.previous.closed).toBe(1000);
    expect(r.next.farmer_id).toBe("NEW");
    expect(r.next.due).toBe(1000); // fresh, not doubled
    expect(r.totalDue).toBe(1000);
  });

  it("preserves already-paid amounts on the previous holder when closing due", () => {
    const r = recalcAfterTransfer({
      previous: { farmer_id: "OLD", payable: 1000, paid: 400 },
      newPayable: 1000,
      newFarmerId: "NEW",
    });
    expect(r.previous.paid).toBe(400);
    expect(r.previous.closed).toBe(600); // only the open portion is released
    expect(r.previous.due).toBe(0);
  });

  it("a fully-paid previous parcel transfers with nothing to close", () => {
    const r = recalcAfterTransfer({
      previous: { farmer_id: "OLD", payable: 1000, paid: 1000 },
      newPayable: 1000,
      newFarmerId: "NEW",
    });
    expect(r.previous.closed).toBe(0);
    expect(r.totalDue).toBe(1000);
  });

  it("transferring to a bargadar splits the new due by billable area", () => {
    const rate = 10;
    const rows = splitBillableArea({
      owner_farmer_id: "NEW",
      parcel_area: 100,
      relations: [{ sharecropper_farmer_id: "SC1", area_decimal: 40 }],
    });
    const newPayable = rows.reduce(
      (s, row) => s + calcInvoice({ land_size_shotok: row.billed_area, rate_per_shotok: rate, settings: DEFAULT_SETTINGS, due_date: FUTURE }).payable_amount,
      0,
    );
    const whole = calcInvoice({ land_size_shotok: 100, rate_per_shotok: rate, settings: DEFAULT_SETTINGS, due_date: FUTURE });
    const r = recalcAfterTransfer({ previous: { farmer_id: "OLD", payable: 800, paid: 0 }, newPayable, newFarmerId: "NEW" });
    expect(newPayable).toBe(whole.payable_amount); // split sums to whole
    expect(r.totalDue).toBe(whole.payable_amount); // no carryover from OLD
    expect(r.previous.due).toBe(0);
  });
});
