import { describe, it, expect } from "vitest";
import {
  approvePayment,
  editPayment,
  cancelPayment,
  isLivePayment,
  type PaymentRecord,
} from "../irrigationPaymentLifecycle";

const pending: PaymentRecord = { id: "p1", amount: 100, status: "pending" };

describe("approvePayment", () => {
  it("approves a pending payment", () => {
    const r = approvePayment(pending, "admin");
    expect(r.ok).toBe(true);
    expect(r.record!.status).toBe("approved");
    expect(r.record!.approved_by).toBe("admin");
  });
  it("rejects approving an already-approved payment (bilingual)", () => {
    const r = approvePayment({ ...pending, status: "approved" }, "admin");
    expect(r.ok).toBe(false);
    expect(r.error!.bn).toContain("অনুমোদিত");
  });
  it("rejects approving a cancelled payment", () => {
    expect(approvePayment({ ...pending, status: "cancelled" }, "admin").ok).toBe(false);
  });
});

describe("editPayment", () => {
  it("edits the amount while pending", () => {
    const r = editPayment(pending, 250);
    expect(r.ok).toBe(true);
    expect(r.record!.amount).toBe(250);
  });
  it("blocks editing once approved", () => {
    expect(editPayment({ ...pending, status: "approved" }, 250).ok).toBe(false);
  });
  it("rejects non-positive amounts", () => {
    expect(editPayment(pending, 0).ok).toBe(false);
  });
});

describe("cancelPayment", () => {
  it("cancels pending or approved with a reason", () => {
    expect(cancelPayment(pending, "admin", "wrong amount").ok).toBe(true);
    expect(cancelPayment({ ...pending, status: "approved" }, "admin", "duplicate").ok).toBe(true);
  });
  it("requires a reason", () => {
    expect(cancelPayment(pending, "admin", "  ").ok).toBe(false);
  });
  it("cannot cancel twice", () => {
    expect(cancelPayment({ ...pending, status: "cancelled" }, "admin", "x").ok).toBe(false);
  });
});

describe("isLivePayment", () => {
  it("excludes cancelled payments from paid totals", () => {
    expect(isLivePayment(pending)).toBe(true);
    expect(isLivePayment({ ...pending, status: "cancelled" })).toBe(false);
  });
});
