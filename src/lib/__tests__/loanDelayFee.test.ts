import { describe, expect, it } from "vitest";
import {
  computeInstallmentDelayFee,
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
  status: over.status ?? "pending",
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
  it("zero when auto_apply false", () => {
    const fee = computeInstallmentDelayFee(inst({ due_date: past(30) }), { ...DEFAULT_DELAY_SETTINGS, mode: "flat", value: 500, auto_apply: false }, today);
    expect(fee).toBe(0);
  });
});

describe("validateInstallmentPayment", () => {
  const settings = { ...DEFAULT_DELAY_SETTINGS, mode: "flat" as const, value: 100, grace_days: 5 };
  it("blocks underpayment", () => {
    const v = validateInstallmentPayment(inst(), settings, 4000, today);
    expect(v.ok).toBe(false);
    expect(v.required).toBe(5100);
    expect(v.reason).toMatch(/কম টাকা/);
  });
  it("accepts exact required", () => {
    const v = validateInstallmentPayment(inst(), settings, 5100, today);
    expect(v.ok).toBe(true);
  });
  it("accepts overpayment", () => {
    const v = validateInstallmentPayment(inst(), settings, 6000, today);
    expect(v.ok).toBe(true);
  });
  it("allows partial when configured", () => {
    const v = validateInstallmentPayment(inst(), { ...settings, allow_partial_installment: true }, 1000, today);
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
