import { describe, expect, it } from "vitest";
import {
  computeInstallmentDelayFee,
  computePenaltyBreakdown,
  buildPenaltySnapshot,
  validateInstallmentPayment,
  nextDueInstallment,
  allocateAcrossInstallments,
  DEFAULT_DELAY_SETTINGS,
} from "../loanDelayFee";

const today = new Date("2026-05-09");
const past = (days: number) => new Date(today.getTime() - days * 86400000).toISOString().slice(0, 10);

const inst = (over: Partial<any> = {}) => ({
  id: over.id ?? "i1",
  installment_no: over.installment_no ?? 1,
  amount: over.amount ?? 5000,
  paid_amount: over.paid_amount ?? 0,
  due_date: over.due_date ?? past(10),
  status: over.status ?? "due",
});

describe("computeInstallmentDelayFee", () => {
  it("returns 0 within grace", () => {
    const fee = computeInstallmentDelayFee(inst({ due_date: past(2) }), { ...DEFAULT_DELAY_SETTINGS, mode: "flat", value: 100, grace_days: 5 }, today);
    expect(fee).toBe(0);
  });
  it("flat fee after grace", () => {
    const fee = computeInstallmentDelayFee(inst({ due_date: past(10) }), { ...DEFAULT_DELAY_SETTINGS, mode: "flat", value: 100, grace_days: 5 }, today);
    expect(fee).toBe(100);
  });
  it("percent fee after grace", () => {
    const fee = computeInstallmentDelayFee(inst({ due_date: past(10), amount: 5000 }), { ...DEFAULT_DELAY_SETTINGS, mode: "percent", value: 2, grace_days: 5 }, today);
    expect(fee).toBe(100);
  });
  it("daily fee accumulates", () => {
    const fee = computeInstallmentDelayFee(inst({ due_date: past(10) }), { ...DEFAULT_DELAY_SETTINGS, mode: "daily", daily_penalty: 10, grace_days: 0 }, today);
    expect(fee).toBe(100);
  });
  it("daily fee respects grace", () => {
    const fee = computeInstallmentDelayFee(inst({ due_date: past(10) }), { ...DEFAULT_DELAY_SETTINGS, mode: "daily", daily_penalty: 10, grace_days: 5 }, today);
    expect(fee).toBe(50);
  });
  it("combined adds percent + daily", () => {
    const fee = computeInstallmentDelayFee(inst({ due_date: past(10), amount: 5000 }), { ...DEFAULT_DELAY_SETTINGS, mode: "combined", value: 2, daily_penalty: 10, grace_days: 0 }, today);
    expect(fee).toBe(200); // 100 percent + 100 daily
  });
  it("respects max_penalty cap", () => {
    const fee = computeInstallmentDelayFee(inst({ due_date: past(60) }), { ...DEFAULT_DELAY_SETTINGS, mode: "daily", daily_penalty: 10, max_penalty: 250 }, today);
    expect(fee).toBe(250);
  });
  it("zero when auto_apply false", () => {
    const fee = computeInstallmentDelayFee(inst({ due_date: past(30) }), { ...DEFAULT_DELAY_SETTINGS, mode: "flat", value: 500, auto_apply: false }, today);
    expect(fee).toBe(0);
  });
});

describe("computePenaltyBreakdown", () => {
  it("returns parts and capped flag", () => {
    const b = computePenaltyBreakdown(inst({ due_date: past(20), amount: 1000 }), { ...DEFAULT_DELAY_SETTINGS, mode: "combined", value: 5, daily_penalty: 10, max_penalty: 100 }, today);
    expect(b.percentPart).toBe(50);
    expect(b.dailyPart).toBe(200);
    expect(b.capped).toBe(true);
    expect(b.total).toBe(100);
  });
});

describe("buildPenaltySnapshot", () => {
  it("returns rule + breakdown", () => {
    const snap = buildPenaltySnapshot(inst(), { ...DEFAULT_DELAY_SETTINGS, mode: "flat", value: 100 }, today);
    expect(snap).toHaveProperty("rule");
    expect(snap).toHaveProperty("breakdown");
  });
});

describe("validateInstallmentPayment enforcement modes", () => {
  const settings = { ...DEFAULT_DELAY_SETTINGS, mode: "flat" as const, value: 100, grace_days: 5 };
  it("blocks underpayment", () => {
    const v = validateInstallmentPayment(inst(), settings, 4000, today);
    expect(v.ok).toBe(false);
    expect(v.required).toBe(5100);
    expect(v.reason).toMatch(/কম টাকা/);
  });
  it("warn mode flags needsOverride", () => {
    const v = validateInstallmentPayment(inst(), { ...settings, enforcement_mode: "warn" }, 4000, today);
    expect(v.ok).toBe(false);
    expect(v.needsOverride).toBe(true);
  });
  it("allow mode requires override but ok", () => {
    const v = validateInstallmentPayment(inst(), { ...settings, enforcement_mode: "allow" }, 1000, today);
    expect(v.ok).toBe(true);
    expect(v.needsOverride).toBe(true);
  });
  it("accepts exact required", () => {
    const v = validateInstallmentPayment(inst(), settings, 5100, today);
    expect(v.ok).toBe(true);
  });
});

describe("nextDueInstallment", () => {
  it("picks oldest unpaid", () => {
    const list = [
      inst({ id: "a", installment_no: 1, status: "paid", paid_amount: 5000 }),
      inst({ id: "b", installment_no: 2 }),
      inst({ id: "c", installment_no: 3 }),
    ];
    expect(nextDueInstallment(list)?.id).toBe("b");
  });
});

describe("allocateAcrossInstallments", () => {
  it("spreads across multiple installments", () => {
    const list = [
      inst({ id: "a", installment_no: 1, due_date: past(20) }),
      inst({ id: "b", installment_no: 2, due_date: past(10) }),
    ];
    const lines = allocateAcrossInstallments(list, { ...DEFAULT_DELAY_SETTINGS, mode: "flat", value: 100, grace_days: 0 }, 8000, today);
    expect(lines.length).toBeGreaterThan(0);
    const total = lines.reduce((s, l) => s + l.applied, 0);
    expect(total).toBe(8000);
  });
});
