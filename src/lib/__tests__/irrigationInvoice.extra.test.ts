import { describe, it, expect } from "vitest";
import { calcInvoice, DEFAULT_SETTINGS, type ChargeSettings } from "../irrigationInvoice";

const S: ChargeSettings = {
  delay_fee_percent: 10,
  maintenance_percent: 5,
  canal_percent: 3,
  grace_days: 7,
  auto_apply_delay_fee: true,
};

describe("calcInvoice — rounding & precision", () => {
  it("rounds maintenance to 2 decimals", () => {
    const r = calcInvoice({
      land_size_shotok: 7, rate_per_shotok: 33,
      settings: { ...S, maintenance_percent: 7.5 }, due_date: "2099-01-01",
    });
    // 7*33 = 231 ; maintenance = 231*7.5/100 = 17.325 → 17.33
    expect(r.irrigation_amount).toBe(231);
    expect(r.maintenance_amount).toBe(17.33);
  });

  it("handles fractional shotok values", () => {
    const r = calcInvoice({
      land_size_shotok: 12.5, rate_per_shotok: 100,
      settings: DEFAULT_SETTINGS, due_date: "2099-01-01",
    });
    expect(r.irrigation_amount).toBe(1250);
  });

  it("payable totals match sum of components exactly", () => {
    const r = calcInvoice({
      land_size_shotok: 50, rate_per_shotok: 120,
      settings: S, due_date: "2099-01-01", other_charge: 75,
    });
    const expected = r.irrigation_amount + r.maintenance_amount + r.canal_amount + r.delay_fee + r.other_charge;
    expect(r.payable_amount).toBeCloseTo(expected, 2);
  });
});

describe("calcInvoice — overdue boundaries", () => {
  it("exactly at due_date+grace = NOT overdue", () => {
    const r = calcInvoice({
      land_size_shotok: 33, rate_per_shotok: 100, settings: S,
      due_date: "2026-05-01", as_of: "2026-05-08", // exactly 7 days
    });
    expect(r.is_overdue).toBe(false);
    expect(r.delay_fee).toBe(0);
  });

  it("one second past grace window = overdue", () => {
    const r = calcInvoice({
      land_size_shotok: 33, rate_per_shotok: 100, settings: S,
      due_date: "2026-05-01T00:00:00Z", as_of: "2026-05-08T00:00:01Z",
    });
    expect(r.is_overdue).toBe(true);
  });

  it("zero grace_days → overdue immediately after due_date", () => {
    const r = calcInvoice({
      land_size_shotok: 10, rate_per_shotok: 50,
      settings: { ...S, grace_days: 0 },
      due_date: "2026-01-01", as_of: "2026-01-02",
    });
    expect(r.is_overdue).toBe(true);
    expect(r.delay_fee).toBeGreaterThan(0);
  });
});

describe("calcInvoice — delay fee math", () => {
  it("delay fee excludes other_charge from base", () => {
    const r = calcInvoice({
      land_size_shotok: 100, rate_per_shotok: 10, settings: S,
      due_date: "2026-01-01", as_of: "2026-06-01", other_charge: 500,
    });
    // base 1000 + maint 50 + canal 30 = 1080 ; delay = 108 ; not 158
    expect(r.delay_fee).toBe(108);
  });

  it("zero delay_fee_percent → no delay fee even when overdue", () => {
    const r = calcInvoice({
      land_size_shotok: 33, rate_per_shotok: 100,
      settings: { ...S, delay_fee_percent: 0 },
      due_date: "2026-01-01", as_of: "2026-06-01",
    });
    expect(r.delay_fee).toBe(0);
    expect(r.status).toBe("overdue");
  });
});

describe("calcInvoice — invariants", () => {
  it("due_amount is never negative", () => {
    const r = calcInvoice({
      land_size_shotok: 33, rate_per_shotok: 100, settings: S,
      due_date: "2099-01-01", paid_amount: 999999,
    });
    expect(r.due_amount).toBeGreaterThanOrEqual(0);
  });

  it("paid_amount never exceeds payable_amount", () => {
    const r = calcInvoice({
      land_size_shotok: 5, rate_per_shotok: 10, settings: DEFAULT_SETTINGS,
      due_date: "2099-01-01", paid_amount: 999999,
    });
    expect(r.paid_amount).toBeLessThanOrEqual(r.payable_amount);
  });

  it("zero payable + zero paid → status=generated, not paid", () => {
    const r = calcInvoice({
      land_size_shotok: 0, rate_per_shotok: 0, settings: DEFAULT_SETTINGS,
      due_date: "2099-01-01",
    });
    expect(r.payable_amount).toBe(0);
    expect(r.status).toBe("generated");
  });

  it("all amounts are finite numbers", () => {
    const r = calcInvoice({
      land_size_shotok: NaN as any, rate_per_shotok: undefined as any,
      settings: S, due_date: "2099-01-01",
    });
    expect(Number.isFinite(r.payable_amount)).toBe(true);
    expect(Number.isFinite(r.due_amount)).toBe(true);
  });
});

describe("calcInvoice — input sanitisation", () => {
  it("treats negative land_size as zero", () => {
    const r = calcInvoice({
      land_size_shotok: -10, rate_per_shotok: 100, settings: S,
      due_date: "2099-01-01",
    });
    expect(r.irrigation_amount).toBe(0);
  });

  it("treats negative rate as zero", () => {
    const r = calcInvoice({
      land_size_shotok: 10, rate_per_shotok: -100, settings: S,
      due_date: "2099-01-01",
    });
    expect(r.irrigation_amount).toBe(0);
  });

  it("treats negative paid_amount as zero", () => {
    const r = calcInvoice({
      land_size_shotok: 10, rate_per_shotok: 100, settings: DEFAULT_SETTINGS,
      due_date: "2099-01-01", paid_amount: -50,
    });
    expect(r.paid_amount).toBe(0);
    expect(r.due_amount).toBe(1000);
  });

  it("string numeric inputs are parsed", () => {
    const r = calcInvoice({
      land_size_shotok: "20" as any, rate_per_shotok: "50" as any,
      settings: DEFAULT_SETTINGS, due_date: "2099-01-01",
    });
    expect(r.irrigation_amount).toBe(1000);
  });
});

describe("calcInvoice — status combinations", () => {
  it("partial paid + overdue still reports partial_paid (payment status wins)", () => {
    const r = calcInvoice({
      land_size_shotok: 33, rate_per_shotok: 100, settings: S,
      due_date: "2026-01-01", as_of: "2026-06-01", paid_amount: 100,
    });
    expect(r.is_overdue).toBe(true);
    expect(r.status).toBe("partial_paid");
  });

  it("fully paid overdue → status=paid", () => {
    const inp = {
      land_size_shotok: 33, rate_per_shotok: 100, settings: S,
      due_date: "2026-01-01", as_of: "2026-06-01",
    };
    const preview = calcInvoice(inp);
    const r = calcInvoice({ ...inp, paid_amount: preview.payable_amount });
    expect(r.status).toBe("paid");
    expect(r.due_amount).toBe(0);
  });
});
