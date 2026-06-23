import { describe, it, expect } from "vitest";
import {
  baseIrrigationAmount,
  describeBaseCalculation,
  calcInvoice,
  SHATAK_PER_BIGHA,
  DEFAULT_SETTINGS,
  type CalculationBasis,
} from "../irrigationInvoice";

const future = "2999-12-31";

describe("describeBaseCalculation", () => {
  it("per_shotok formula matches amount", () => {
    const bd = describeBaseCalculation(33, 10, "per_shotok");
    expect(bd.amount).toBe(330);
    expect(bd.land_bigha).toBe(1);
    expect(bd.bigha_factor).toBe(SHATAK_PER_BIGHA);
    expect(bd.formula_en).toContain("330");
    expect(bd.formula_bn).toContain("শতক");
  });

  it("per_bigha uses bigha conversion factor", () => {
    const bd = describeBaseCalculation(66, 100, "per_bigha");
    expect(bd.land_bigha).toBe(2);
    expect(bd.amount).toBe(200);
    expect(bd.formula_bn).toContain("বিঘা");
  });

  it("flat fee is area-independent", () => {
    const bd = describeBaseCalculation(999, 500, "flat");
    expect(bd.amount).toBe(500);
    expect(bd.formula_en).toContain("Flat");
  });

  it("breakdown amount always equals baseIrrigationAmount", () => {
    const cases: Array<[number, number, CalculationBasis]> = [
      [33, 10, "per_shotok"],
      [66, 100, "per_bigha"],
      [10, 500, "flat"],
      [49.5, 12, "custom"],
    ];
    for (const [land, rate, basis] of cases) {
      expect(describeBaseCalculation(land, rate, basis).amount).toBe(
        baseIrrigationAmount(land, rate, basis),
      );
    }
  });
});

describe("calcInvoice due/paid end-to-end across bases", () => {
  const bases: CalculationBasis[] = ["per_shotok", "per_bigha", "flat", "custom"];

  it("unpaid → due equals payable for every basis", () => {
    for (const basis of bases) {
      const c = calcInvoice({
        land_size_shotok: 33, rate_per_shotok: 10, basis,
        settings: DEFAULT_SETTINGS, due_date: future,
      });
      expect(c.due_amount).toBe(c.payable_amount);
      expect(c.paid_amount).toBe(0);
    }
  });

  it("partial payment never doubles due", () => {
    const c = calcInvoice({
      land_size_shotok: 33, rate_per_shotok: 10, basis: "per_shotok",
      settings: DEFAULT_SETTINGS, due_date: future, paid_amount: 130,
    });
    expect(c.payable_amount).toBe(330);
    expect(c.due_amount).toBe(200);
    expect(c.status).toBe("partial_paid");
  });

  it("overpayment clamps paid, due never negative", () => {
    const c = calcInvoice({
      land_size_shotok: 0, rate_per_shotok: 500, basis: "flat",
      settings: DEFAULT_SETTINGS, due_date: future, paid_amount: 9999,
    });
    expect(c.paid_amount).toBe(500);
    expect(c.due_amount).toBe(0);
    expect(c.status).toBe("paid");
  });
});
