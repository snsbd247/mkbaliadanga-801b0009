import { describe, it, expect } from "vitest";
import { evaluateClearance, type ClearanceInvoice } from "./irrigationDueClearance";

const current: ClearanceInvoice[] = [
  { id: "c1", invoice_no: "INV-C1", due_amount: 1000, delay_fee: 0 },
  { id: "c2", invoice_no: "INV-C2", due_amount: 500, delay_fee: 100 },
];
const previous: ClearanceInvoice[] = [
  { id: "p1", invoice_no: "INV-P1", due_amount: 800, delay_fee: 0 },
];

describe("evaluateClearance — multiple invoices for the same farmer", () => {
  it("blocks receipt when current-season selection is only partially paid", () => {
    const r = evaluateClearance({
      selectedCurrentInvoices: current,
      previousInvoices: [],
      currentCollected: 1000, // less than 1500 payable
      previousCollected: 0,
      userRoles: ["staff"],
      allowedRoles: ["super_admin"],
    });
    expect(r.blocked).toBe(true);
    expect(r.currentPayable).toBe(1500);
    expect(r.unpaidRows.length).toBeGreaterThan(0);
  });

  it("blocks receipt when previous dues remain even if current is fully paid", () => {
    const r = evaluateClearance({
      selectedCurrentInvoices: current,
      previousInvoices: previous,
      currentCollected: 1500,
      previousCollected: 0, // 800 previous still unpaid
      userRoles: ["staff"],
      allowedRoles: ["super_admin"],
    });
    expect(r.blocked).toBe(true);
    expect(r.unpaidRows.some(row => row.label.includes("INV-P1"))).toBe(true);
  });

  it("allows receipt when BOTH previous and current dues are fully cleared", () => {
    const r = evaluateClearance({
      selectedCurrentInvoices: current,
      previousInvoices: previous,
      currentCollected: 1500,
      previousCollected: 800,
      userRoles: ["staff"],
      allowedRoles: ["super_admin"],
    });
    expect(r.blocked).toBe(false);
    expect(r.unpaidRows).toHaveLength(0);
  });

  it("allows a super admin to take a partial payment", () => {
    const r = evaluateClearance({
      selectedCurrentInvoices: current,
      previousInvoices: previous,
      currentCollected: 500,
      previousCollected: 0,
      userRoles: ["super_admin"],
      allowedRoles: ["super_admin"],
      isSuper: true,
    });
    expect(r.blocked).toBe(false);
  });

  it("allows a configured role (e.g. admin) to take a partial payment", () => {
    const r = evaluateClearance({
      selectedCurrentInvoices: current,
      previousInvoices: [],
      currentCollected: 200,
      previousCollected: 0,
      userRoles: ["admin"],
      allowedRoles: ["super_admin", "admin"],
    });
    expect(r.blocked).toBe(false);
  });

  it("accounts for delay-fee overrides in the current payable", () => {
    const r = evaluateClearance({
      selectedCurrentInvoices: [{ id: "c2", invoice_no: "INV-C2", due_amount: 500, delay_fee: 100 }],
      previousInvoices: [],
      currentCollected: 500,
      previousCollected: 0,
      delayFeeOverride: { c2: 300 }, // +200 over original fee
      userRoles: ["staff"],
      allowedRoles: ["super_admin"],
    });
    // payable becomes 500 + (300-100) = 700, collected 500 -> blocked
    expect(r.currentPayable).toBe(700);
    expect(r.blocked).toBe(true);
  });
});
