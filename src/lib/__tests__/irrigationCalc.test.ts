import { describe, it, expect } from "vitest";
import {
  calcBaseCharge, calcIrrigation, dailyDue,
  shatakToBigha, bighaToShatak, formatLandSize, SHATAK_PER_BIGHA,
} from "../irrigationCalc";

describe("calcBaseCharge", () => {
  it("per_size: rate × land_size (শতক)", () => {
    expect(calcBaseCharge({ basis: "per_size", rate: 10, land_size: 33 })).toBe(330);
  });
  it("per_size: zero land_size → 0", () => {
    expect(calcBaseCharge({ basis: "per_size", rate: 10, land_size: 0 })).toBe(0);
  });
  it("per_day: rate × quantity", () => {
    expect(calcBaseCharge({ basis: "per_day", rate: 50, quantity: 4 })).toBe(200);
  });
  it("per_hour: rate × hours", () => {
    expect(calcBaseCharge({ basis: "per_hour", rate: 25, quantity: 6 })).toBe(150);
  });
  it("per_land: flat rate, ignores quantity/land_size", () => {
    expect(calcBaseCharge({ basis: "per_land", rate: 500, quantity: 99, land_size: 99 })).toBe(500);
  });
  it("ignores negative inputs", () => {
    expect(calcBaseCharge({ basis: "per_size", rate: -10, land_size: 5 })).toBe(0);
    expect(calcBaseCharge({ basis: "per_day", rate: 10, quantity: -3 })).toBe(0);
  });
  it("handles strings & NaN safely", () => {
    expect(calcBaseCharge({ basis: "per_size", rate: "12" as any, land_size: "2.5" as any })).toBe(30);
    expect(calcBaseCharge({ basis: "per_size", rate: NaN as any, land_size: 5 })).toBe(0);
  });
  it("rounds to 2 decimals", () => {
    expect(calcBaseCharge({ basis: "per_size", rate: 10.333, land_size: 3 })).toBe(31);
  });
});

describe("calcIrrigation breakdown", () => {
  it("sums all components", () => {
    const r = calcIrrigation({
      basis: "per_size", rate: 10, land_size: 30,
      canal_charge: 50, maintenance_charge: 20, other_charge: 5,
      previous_due: 100, penalty: 10, paid_amount: 200,
    });
    expect(r.base_charge).toBe(300);
    expect(r.total).toBe(485);
    expect(r.paid_amount).toBe(200);
    expect(r.due_amount).toBe(285);
  });
  it("clamps overpayment so due never negative", () => {
    const r = calcIrrigation({ basis: "per_land", rate: 100, paid_amount: 500 });
    expect(r.paid_amount).toBe(100);
    expect(r.due_amount).toBe(0);
  });
  it("zero rate → zero total when no extras", () => {
    const r = calcIrrigation({ basis: "per_size", rate: 0, land_size: 10 });
    expect(r.total).toBe(0);
    expect(r.due_amount).toBe(0);
  });
  it("previous_due alone still produces due", () => {
    const r = calcIrrigation({ basis: "per_size", rate: 0, land_size: 0, previous_due: 250 });
    expect(r.total).toBe(250);
    expect(r.due_amount).toBe(250);
  });
});

describe("dailyDue", () => {
  it("amortizes across days", () => {
    expect(dailyDue(1000, 10)).toBe(100);
  });
  it("guards against zero / negative days", () => {
    expect(dailyDue(500, 0)).toBe(500);
    expect(dailyDue(500, -5)).toBe(500);
  });
});
