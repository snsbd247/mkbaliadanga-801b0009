import { describe, it, expect } from "vitest";
import {
  pickCurrentSeasonId,
  reconcileFarmerInvoices,
  type ReconInvoice,
} from "@/lib/irrigationReconciliation";

const inv = (over: Partial<ReconInvoice> & { id: string; season_id: string }): ReconInvoice => ({
  invoice_no: over.id,
  due_amount: 0,
  delay_fee: 0,
  due_date: null,
  seasons: null,
  ...over,
});

describe("pickCurrentSeasonId", () => {
  it("prefers the active season when it appears among the invoices", () => {
    const list = [
      inv({ id: "a", season_id: "s1", seasons: { name: "Boro", year: 2025 } }),
      inv({ id: "b", season_id: "s2", seasons: { name: "Aman", year: 2026 } }),
    ];
    expect(pickCurrentSeasonId(list, "s1")).toBe("s1");
  });

  it("falls back to newest season by year when active is absent", () => {
    const list = [
      inv({ id: "a", season_id: "s1", seasons: { name: "Boro", year: 2025 } }),
      inv({ id: "b", season_id: "s2", seasons: { name: "Aman", year: 2026 } }),
    ];
    expect(pickCurrentSeasonId(list, "missing")).toBe("s2");
  });

  it("breaks year ties using the latest due date", () => {
    const list = [
      inv({ id: "a", season_id: "s1", due_date: "2026-01-01", seasons: { year: 2026 } }),
      inv({ id: "b", season_id: "s2", due_date: "2026-06-01", seasons: { year: 2026 } }),
    ];
    expect(pickCurrentSeasonId(list)).toBe("s2");
  });

  it("returns null for an empty list", () => {
    expect(pickCurrentSeasonId([])).toBeNull();
  });
});

describe("reconcileFarmerInvoices", () => {
  it("splits hāl vs due and excludes penalty from charge", () => {
    const list = [
      inv({ id: "cur", season_id: "s2", due_amount: 1100, delay_fee: 100, seasons: { year: 2026 } }),
      inv({ id: "old", season_id: "s1", due_amount: 550, delay_fee: 50, seasons: { year: 2025 } }),
    ];
    const cur = pickCurrentSeasonId(list);
    const r = reconcileFarmerInvoices(list, cur);
    expect(r.halCharge).toBe(1000); // 1100 - 100 penalty
    expect(r.halPenalty).toBe(100);
    expect(r.dueCharge).toBe(500); // 550 - 50 penalty
    expect(r.duePenalty).toBe(50);
    expect(r.grandTotal).toBe(1650);
  });

  it("never produces a negative charge", () => {
    const list = [inv({ id: "x", season_id: "s1", due_amount: 30, delay_fee: 100 })];
    const r = reconcileFarmerInvoices(list, "s1");
    expect(r.halCharge).toBe(0);
  });

  it("applies penalty overrides when supplied", () => {
    const list = [inv({ id: "x", season_id: "s1", due_amount: 500, delay_fee: 50 })];
    const r = reconcileFarmerInvoices(list, "s1", { x: 120 });
    expect(r.halPenalty).toBe(120);
    expect(r.halCharge).toBe(450); // charge uses original 50, not override
  });

  it("classifies everything as due when no current season", () => {
    const list = [inv({ id: "x", season_id: "s1", due_amount: 100 })];
    const r = reconcileFarmerInvoices(list, null);
    expect(r.rows[0].classification).toBe("due");
    expect(r.dueCharge).toBe(100);
  });

  it("returns zero totals for an empty invoice set", () => {
    const r = reconcileFarmerInvoices([], "s1");
    expect(r.grandTotal).toBe(0);
    expect(r.rows).toHaveLength(0);
  });
});
