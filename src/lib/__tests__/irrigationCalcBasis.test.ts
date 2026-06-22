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

describe("due/paid logic across all bases (no double-counting)", () => {
  const cases: { basis: "per_shotok" | "per_bigha" | "flat" | "custom"; area: number; rate: number; expectedPayable: number }[] = [
    { basis: "per_shotok", area: 100, rate: 10, expectedPayable: 1000 },
    { basis: "per_bigha", area: 66, rate: 100, expectedPayable: 200 },
    { basis: "flat", area: 80, rate: 500, expectedPayable: 500 },
    { basis: "custom", area: 50, rate: 20, expectedPayable: 1000 },
  ];

  for (const c of cases) {
    it(`${c.basis}: unpaid → due equals payable`, () => {
      const r = calcInvoice({ land_size_shotok: c.area, rate_per_shotok: c.rate, basis: c.basis, settings: DEFAULT_SETTINGS, due_date: FUTURE });
      expect(r.payable_amount).toBe(c.expectedPayable);
      expect(r.due_amount).toBe(c.expectedPayable);
      expect(r.paid_amount).toBe(0);
      expect(r.status).toBe("generated");
    });

    it(`${c.basis}: partial payment → due = payable - paid, status partial_paid`, () => {
      const paid = Math.round(c.expectedPayable / 2);
      const r = calcInvoice({ land_size_shotok: c.area, rate_per_shotok: c.rate, basis: c.basis, settings: DEFAULT_SETTINGS, due_date: FUTURE, paid_amount: paid });
      expect(r.paid_amount).toBe(paid);
      expect(r.due_amount).toBe(c.expectedPayable - paid);
      expect(r.status).toBe("partial_paid");
    });

    it(`${c.basis}: full payment → due 0, status paid (no negative/double)`, () => {
      const r = calcInvoice({ land_size_shotok: c.area, rate_per_shotok: c.rate, basis: c.basis, settings: DEFAULT_SETTINGS, due_date: FUTURE, paid_amount: c.expectedPayable });
      expect(r.due_amount).toBe(0);
      expect(r.status).toBe("paid");
    });

    it(`${c.basis}: overpayment clamps paid to payable, due never negative`, () => {
      const r = calcInvoice({ land_size_shotok: c.area, rate_per_shotok: c.rate, basis: c.basis, settings: DEFAULT_SETTINGS, due_date: FUTURE, paid_amount: c.expectedPayable * 5 });
      expect(r.paid_amount).toBe(c.expectedPayable);
      expect(r.due_amount).toBe(0);
    });
  }

  it("overdue unpaid invoice applies delay fee once and is flagged overdue", () => {
    const settings = { ...DEFAULT_SETTINGS, delay_fee_percent: 10, auto_apply_delay_fee: true, grace_days: 0 };
    const r = calcInvoice({ land_size_shotok: 100, rate_per_shotok: 10, basis: "per_shotok", settings, due_date: "2000-01-01", as_of: "2000-02-01" });
    expect(r.delay_fee).toBe(100); // 10% of 1000
    expect(r.payable_amount).toBe(1100);
    expect(r.is_overdue).toBe(true);
    expect(r.status).toBe("overdue");
  });

  it("maintenance + canal percentages stack on the base, not on each other", () => {
    const settings = { ...DEFAULT_SETTINGS, maintenance_percent: 10, canal_percent: 5 };
    const r = calcInvoice({ land_size_shotok: 100, rate_per_shotok: 10, basis: "per_shotok", settings, due_date: FUTURE });
    expect(r.irrigation_amount).toBe(1000);
    expect(r.maintenance_amount).toBe(100);
    expect(r.canal_amount).toBe(50);
    expect(r.payable_amount).toBe(1150);
  });
});
