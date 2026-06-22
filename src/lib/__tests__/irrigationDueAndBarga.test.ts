import { describe, it, expect } from "vitest";
import { calcInvoice, DEFAULT_SETTINGS } from "@/lib/irrigationInvoice";
import { splitBillableArea } from "@/lib/irrigationBargaSplit";

const FUTURE = "2999-12-31"; // never overdue → no auto delay fee

describe("irrigation due calculation — no double counting", () => {
  it("due equals payable when nothing is paid (single calc, payable-based)", () => {
    const r = calcInvoice({
      land_size_shotok: 100,
      rate_per_shotok: 10,
      settings: DEFAULT_SETTINGS,
      due_date: FUTURE,
    });
    expect(r.payable_amount).toBe(1000);
    expect(r.due_amount).toBe(1000); // not 2000 — due derives once from payable
  });

  it("due decreases by exactly the paid amount and never doubles", () => {
    const r = calcInvoice({
      land_size_shotok: 50,
      rate_per_shotok: 20,
      settings: DEFAULT_SETTINGS,
      due_date: FUTURE,
      paid_amount: 400,
    });
    expect(r.payable_amount).toBe(1000);
    expect(r.due_amount).toBe(600); // payable - paid, once
  });

  it("re-running calc with the same inputs is idempotent (no accumulation)", () => {
    const input = {
      land_size_shotok: 33,
      rate_per_shotok: 30,
      settings: { ...DEFAULT_SETTINGS, maintenance_percent: 10 },
      due_date: FUTURE,
    } as const;
    const a = calcInvoice(input);
    const b = calcInvoice(input);
    expect(a.payable_amount).toBe(b.payable_amount);
    expect(a.due_amount).toBe(b.due_amount);
  });

  it("full payment closes the due to zero", () => {
    const r = calcInvoice({
      land_size_shotok: 10,
      rate_per_shotok: 100,
      settings: DEFAULT_SETTINGS,
      due_date: FUTURE,
      paid_amount: 1000,
    });
    expect(r.due_amount).toBe(0);
    expect(r.status).toBe("paid");
  });
});

describe("barga split — owner vs sharecropper consistency", () => {
  it("owner gets the full area when there is no sharecropper", () => {
    const rows = splitBillableArea({ owner_farmer_id: "OWN", parcel_area: 100, relations: [] });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ billed_farmer_id: "OWN", is_borga: false, billed_area: 100 });
  });

  it("splits explicit borga area between sharecropper and owner remainder", () => {
    const rows = splitBillableArea({
      owner_farmer_id: "OWN",
      parcel_area: 100,
      relations: [{ sharecropper_farmer_id: "SC1", area_decimal: 40 }],
    });
    const sc = rows.find((r) => r.billed_farmer_id === "SC1")!;
    const owner = rows.find((r) => r.billed_farmer_id === "OWN")!;
    expect(sc.is_borga).toBe(true);
    expect(sc.billed_area).toBe(40);
    expect(owner.is_borga).toBe(false);
    expect(owner.billed_area).toBe(60);
  });

  it("supports share_percentage when explicit area is absent", () => {
    const rows = splitBillableArea({
      owner_farmer_id: "OWN",
      parcel_area: 200,
      relations: [{ sharecropper_farmer_id: "SC1", share_percentage: 25 }],
    });
    expect(rows.find((r) => r.billed_farmer_id === "SC1")!.billed_area).toBe(50);
    expect(rows.find((r) => r.billed_farmer_id === "OWN")!.billed_area).toBe(150);
  });

  it("no owner remainder row when fully allocated to sharecroppers", () => {
    const rows = splitBillableArea({
      owner_farmer_id: "OWN",
      parcel_area: 100,
      relations: [
        { sharecropper_farmer_id: "SC1", area_decimal: 60 },
        { sharecropper_farmer_id: "SC2", area_decimal: 40 },
      ],
    });
    expect(rows.every((r) => r.is_borga)).toBe(true);
    expect(rows.reduce((s, r) => s + r.billed_area, 0)).toBe(100);
  });

  it("sum of split charges equals the whole-parcel charge (no double / no loss)", () => {
    const rate = 25;
    const settings = { ...DEFAULT_SETTINGS, maintenance_percent: 10, canal_percent: 5 };
    const whole = calcInvoice({ land_size_shotok: 100, rate_per_shotok: rate, settings, due_date: FUTURE });

    const rows = splitBillableArea({
      owner_farmer_id: "OWN",
      parcel_area: 100,
      relations: [{ sharecropper_farmer_id: "SC1", area_decimal: 40 }],
    });
    const splitTotal = rows.reduce(
      (s, r) =>
        s + calcInvoice({ land_size_shotok: r.billed_area, rate_per_shotok: rate, settings, due_date: FUTURE }).payable_amount,
      0,
    );
    expect(splitTotal).toBe(whole.payable_amount);
  });
});
