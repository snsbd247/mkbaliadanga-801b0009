import { describe, it, expect } from "vitest";
import { calcDisposalGainLoss, applyStockDelta, nextStatusForAction } from "../assetMath";

describe("assetMath.calcDisposalGainLoss", () => {
  it("returns positive on gain", () => {
    expect(calcDisposalGainLoss(1500, 1000)).toBe(500);
  });
  it("returns negative on loss", () => {
    expect(calcDisposalGainLoss(800, 1200)).toBe(-400);
  });
  it("treats null sale_amount as zero (write_off / lost)", () => {
    expect(calcDisposalGainLoss(null, 1000)).toBe(-1000);
  });
  it("rounds to 2 decimals", () => {
    expect(calcDisposalGainLoss(100.555, 100)).toBeCloseTo(0.56, 2);
  });
});

describe("assetMath.applyStockDelta", () => {
  it("adds positive delta", () => expect(applyStockDelta(5, 3)).toBe(8));
  it("subtracts and floors at zero", () => expect(applyStockDelta(2, -10)).toBe(0));
  it("handles null current", () => expect(applyStockDelta(null, 4)).toBe(4));
});

describe("assetMath.nextStatusForAction", () => {
  it("maps actions to statuses", () => {
    expect(nextStatusForAction("purchase")).toBe("in_stock");
    expect(nextStatusForAction("transfer")).toBe("transferred");
    expect(nextStatusForAction("install")).toBe("installed");
    expect(nextStatusForAction("repair_start")).toBe("maintenance");
    expect(nextStatusForAction("repair_end")).toBe("in_stock");
    expect(nextStatusForAction("damage")).toBe("damaged");
    expect(nextStatusForAction("dispose")).toBe("disposed");
  });
});
