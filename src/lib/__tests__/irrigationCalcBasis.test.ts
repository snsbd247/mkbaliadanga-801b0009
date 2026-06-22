import { describe, it, expect } from "vitest";
import { calcInvoice, baseIrrigationAmount, DEFAULT_SETTINGS } from "@/lib/irrigationInvoice";

const FUTURE = "2999-12-31";

describe("irrigation calculation basis (Step 1 — category units)", () => {
  it("per_shotok: rate × area", () => {
    expect(baseIrrigationAmount(100, 10, "per_shotok")).toBe(1000);
  });

  it("per_bigha: rate × (area / 33)", () => {
    expect(baseIrrigationAmount(33, 100, "per_bigha")).toBe(100); // exactly 1 bigha
    expect(baseIrrigationAmount(66, 100, "per_bigha")).toBe(200); // 2 bigha
  });

  it("flat: fixed fee regardless of area (e.g. পুকুর / ভর্তি ফি)", () => {
    expect(baseIrrigationAmount(100, 500, "flat")).toBe(500);
    expect(baseIrrigationAmount(1, 500, "flat")).toBe(500);
  });

  it("custom defaults to per_shotok behaviour", () => {
    expect(baseIrrigationAmount(50, 20, "custom")).toBe(1000);
  });

  it("calcInvoice honours basis for the payable amount", () => {
    const flat = calcInvoice({ land_size_shotok: 80, rate_per_shotok: 300, basis: "flat", settings: DEFAULT_SETTINGS, due_date: FUTURE });
    expect(flat.payable_amount).toBe(300);

    const bigha = calcInvoice({ land_size_shotok: 33, rate_per_shotok: 1000, basis: "per_bigha", settings: DEFAULT_SETTINGS, due_date: FUTURE });
    expect(bigha.payable_amount).toBe(1000);
  });

  it("missing basis falls back to per_shotok (backward compatible)", () => {
    const r = calcInvoice({ land_size_shotok: 100, rate_per_shotok: 10, settings: DEFAULT_SETTINGS, due_date: FUTURE });
    expect(r.payable_amount).toBe(1000);
  });
});
