import { describe, it, expect } from "vitest";
import { calcInvoice, DEFAULT_SETTINGS, type ChargeSettings } from "../irrigationInvoice";

const baseSettings: ChargeSettings = {
  delay_fee_percent: 10,
  maintenance_percent: 5,
  canal_percent: 3,
  grace_days: 7,
  auto_apply_delay_fee: true,
};

describe("calcInvoice — base computation", () => {
  it("computes irrigation, maintenance, canal, payable correctly", () => {
    const r = calcInvoice({
      land_size_shotok: 33,         // 1 bigha
      rate_per_shotok: 100,
      settings: baseSettings,
      due_date: "2099-12-31",        // not overdue
      as_of: "2026-05-01",
    });
    expect(r.irrigation_amount).toBe(3300);
    expect(r.maintenance_amount).toBe(165);   // 5%
    expect(r.canal_amount).toBe(99);          // 3%
    expect(r.delay_fee).toBe(0);
    expect(r.payable_amount).toBe(3564);
    expect(r.due_amount).toBe(3564);
    expect(r.status).toBe("generated");
    expect(r.is_overdue).toBe(false);
  });

  it("zero land or rate → zero payable", () => {
    const r = calcInvoice({ land_size_shotok: 0, rate_per_shotok: 100, settings: baseSettings, due_date: "2099-01-01" });
    expect(r.payable_amount).toBe(0);
    expect(r.status).toBe("generated");
  });
});

describe("calcInvoice — overdue + delay fee", () => {
  it("applies delay fee after due_date + grace_days", () => {
    const r = calcInvoice({
      land_size_shotok: 33,
      rate_per_shotok: 100,
      settings: baseSettings,
      due_date: "2026-01-01",
      as_of: "2026-02-01",           // way past grace
    });
    // base 3300 + maint 165 + canal 99 = 3564
    // delay = 10% of (3300+165+99) = 356.4
    expect(r.delay_fee).toBe(356.4);
    expect(r.payable_amount).toBe(3920.4);
    expect(r.is_overdue).toBe(true);
    expect(r.status).toBe("overdue");
  });

  it("does NOT apply delay fee inside grace window", () => {
    const r = calcInvoice({
      land_size_shotok: 33, rate_per_shotok: 100, settings: baseSettings,
      due_date: "2026-05-01", as_of: "2026-05-05",   // 4 days past, grace 7
    });
    expect(r.delay_fee).toBe(0);
    expect(r.is_overdue).toBe(false);
  });

  it("respects auto_apply_delay_fee=false", () => {
    const r = calcInvoice({
      land_size_shotok: 33, rate_per_shotok: 100,
      settings: { ...baseSettings, auto_apply_delay_fee: false },
      due_date: "2026-01-01", as_of: "2026-06-01",
    });
    expect(r.delay_fee).toBe(0);
    expect(r.is_overdue).toBe(true);
    expect(r.status).toBe("overdue");
  });
});

describe("calcInvoice — payment status transitions", () => {
  const inp = { land_size_shotok: 33, rate_per_shotok: 100, settings: baseSettings, due_date: "2099-12-31" };

  it("paid in full → status=paid", () => {
    const r = calcInvoice({ ...inp, paid_amount: 3564 });
    expect(r.due_amount).toBe(0);
    expect(r.status).toBe("paid");
  });

  it("partial payment → status=partial_paid", () => {
    const r = calcInvoice({ ...inp, paid_amount: 1000 });
    expect(r.due_amount).toBe(2564);
    expect(r.status).toBe("partial_paid");
  });

  it("overpayment is clamped, status=paid", () => {
    const r = calcInvoice({ ...inp, paid_amount: 99999 });
    expect(r.paid_amount).toBe(3564);
    expect(r.due_amount).toBe(0);
    expect(r.status).toBe("paid");
  });
});

describe("calcInvoice — other_charge", () => {
  it("includes other_charge in payable", () => {
    const r = calcInvoice({
      land_size_shotok: 33, rate_per_shotok: 100, settings: baseSettings,
      due_date: "2099-01-01", other_charge: 200,
    });
    expect(r.other_charge).toBe(200);
    expect(r.payable_amount).toBe(3764);
  });

  it("ignores negative other_charge", () => {
    const r = calcInvoice({
      land_size_shotok: 33, rate_per_shotok: 100, settings: baseSettings,
      due_date: "2099-01-01", other_charge: -50,
    });
    expect(r.other_charge).toBe(0);
  });
});

describe("DEFAULT_SETTINGS", () => {
  it("has zero percentages", () => {
    expect(DEFAULT_SETTINGS.delay_fee_percent).toBe(0);
    expect(DEFAULT_SETTINGS.maintenance_percent).toBe(0);
    expect(DEFAULT_SETTINGS.canal_percent).toBe(0);
    expect(DEFAULT_SETTINGS.auto_apply_delay_fee).toBe(true);
  });

  it("default settings → only irrigation amount", () => {
    const r = calcInvoice({
      land_size_shotok: 33, rate_per_shotok: 100,
      settings: DEFAULT_SETTINGS, due_date: "2099-01-01",
    });
    expect(r.payable_amount).toBe(3300);
    expect(r.maintenance_amount).toBe(0);
    expect(r.canal_amount).toBe(0);
  });
});
