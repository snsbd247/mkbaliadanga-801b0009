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

describe("Bigha ↔ Shatak conversion", () => {
  it("uses 33 শতক = 1 বিঘা constant", () => {
    expect(SHATAK_PER_BIGHA).toBe(33);
  });
  it("shatakToBigha: round-trip with bighaToShatak", () => {
    expect(shatakToBigha(33)).toBe(1);
    expect(shatakToBigha(66)).toBe(2);
    expect(shatakToBigha(49.5)).toBe(1.5);
    expect(bighaToShatak(1)).toBe(33);
    expect(bighaToShatak(2.5)).toBe(82.5);
  });
  it("handles null / NaN / negative safely", () => {
    expect(shatakToBigha(null)).toBe(0);
    expect(shatakToBigha(undefined)).toBe(0);
    expect(shatakToBigha(-10)).toBe(0);
    expect(bighaToShatak("abc" as any)).toBe(0);
  });
  it("rounds to 2 decimals", () => {
    expect(shatakToBigha(10)).toBe(0.3);
    expect(shatakToBigha(100)).toBe(3.03);
  });
});

describe("formatLandSize", () => {
  it("default long variant shows both units in Bangla", () => {
    expect(formatLandSize(49.5)).toBe("১.৫০ বিঘা (৪৯.৫০ শতক)".replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d).toString()));
    // Plain ASCII assertion (string already in latin digits)
    expect(formatLandSize(49.5)).toBe("1.50 বিঘা (49.50 শতক)");
  });
  it("short variant uses slash separator", () => {
    expect(formatLandSize(33, "short")).toBe("1.00 বিঘা / 33.00 শতক");
  });
  it("ascii variant for PDF/Excel without Bangla fonts", () => {
    expect(formatLandSize(33, "ascii")).toBe("1.00 bigha (33.00 shatak)");
    expect(formatLandSize(66, "ascii")).toBe("2.00 bigha (66.00 shatak)");
  });
  it("falls back when value is missing", () => {
    expect(formatLandSize(null)).toBe("—");
    expect(formatLandSize(undefined)).toBe("—");
    expect(formatLandSize("")).toBe("—");
  });
  it("renders zero explicitly", () => {
    expect(formatLandSize(0, "ascii")).toBe("0 bigha (0 shatak)");
  });
});

describe("calculation consistency: per_size charge equals per-bigha rate × bigha", () => {
  it("rate-per-শতক × land in শতক = rate-per-বিঘা × land in বিঘা", () => {
    const ratePerShatak = 12;
    const landShatak = 49.5;
    const a = calcBaseCharge({ basis: "per_size", rate: ratePerShatak, land_size: landShatak });
    const ratePerBigha = ratePerShatak * SHATAK_PER_BIGHA;
    const landBigha = shatakToBigha(landShatak);
    const b = Math.round(ratePerBigha * landBigha * 100) / 100;
    expect(a).toBe(b);
  });
});
