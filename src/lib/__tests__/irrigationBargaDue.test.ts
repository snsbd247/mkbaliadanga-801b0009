import { describe, it, expect } from "vitest";
import { computeBargaDue } from "@/lib/irrigationBargaDue";
import { calcInvoice, DEFAULT_SETTINGS } from "@/lib/irrigationInvoice";

const FUTURE = "2999-12-31";
const settings = { ...DEFAULT_SETTINGS, maintenance_percent: 10, canal_percent: 5 };

describe("computeBargaDue — per-farmer barga due", () => {
  it("owner gets full due when no sharecropper", () => {
    const rows = computeBargaDue({
      owner_farmer_id: "OWN",
      parcel_area: 100,
      rate_per_shotok: 25,
      settings,
      due_date: FUTURE,
      relations: [],
    });
    const whole = calcInvoice({ land_size_shotok: 100, rate_per_shotok: 25, settings, due_date: FUTURE });
    expect(rows).toHaveLength(1);
    expect(rows[0].billed_farmer_id).toBe("OWN");
    expect(rows[0].due_amount).toBe(whole.payable_amount);
  });

  it("sum of split dues equals whole-parcel due (no double / no loss)", () => {
    const whole = calcInvoice({ land_size_shotok: 100, rate_per_shotok: 25, settings, due_date: FUTURE });
    const rows = computeBargaDue({
      owner_farmer_id: "OWN",
      parcel_area: 100,
      rate_per_shotok: 25,
      settings,
      due_date: FUTURE,
      relations: [{ sharecropper_farmer_id: "SC1", area_decimal: 40 }],
    });
    const total = rows.reduce((s, r) => s + r.due_amount, 0);
    expect(r2(total)).toBe(whole.payable_amount);
    expect(rows.find((r) => r.billed_farmer_id === "SC1")!.is_borga).toBe(true);
    expect(rows.find((r) => r.billed_farmer_id === "OWN")!.is_borga).toBe(false);
  });

  it("allocates payment proportionally and never doubles due", () => {
    const rows = computeBargaDue({
      owner_farmer_id: "OWN",
      parcel_area: 100,
      rate_per_shotok: 25,
      settings,
      due_date: FUTURE,
      relations: [{ sharecropper_farmer_id: "SC1", area_decimal: 40 }],
      paid_amount: 500,
    });
    const totalPaid = rows.reduce((s, r) => s + r.paid_amount, 0);
    const totalDue = rows.reduce((s, r) => s + r.due_amount, 0);
    const whole = calcInvoice({ land_size_shotok: 100, rate_per_shotok: 25, settings, due_date: FUTURE });
    expect(r2(totalPaid)).toBe(500);
    expect(r2(totalDue)).toBe(r2(whole.payable_amount - 500));
  });

  it("overpayment is clamped, no negative due", () => {
    const rows = computeBargaDue({
      owner_farmer_id: "OWN",
      parcel_area: 100,
      rate_per_shotok: 25,
      settings,
      due_date: FUTURE,
      relations: [{ sharecropper_farmer_id: "SC1", area_decimal: 40 }],
      paid_amount: 999999,
    });
    expect(rows.every((r) => r.due_amount === 0)).toBe(true);
  });
});

const r2 = (v: number) => Math.round(v * 100) / 100;
