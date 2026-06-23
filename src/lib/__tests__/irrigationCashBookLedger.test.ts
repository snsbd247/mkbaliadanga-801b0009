import { describe, it, expect } from "vitest";
import {
  buildCashBook,
  summarizeCashBook,
  validateHistoricalEntry,
} from "../irrigationCashBookLedger";

const entries = [
  { date: "2026-01-03", direction: "out" as const, amount: 200, head: "ডিজেল" },
  { date: "2026-01-01", direction: "in" as const, amount: 1000, head: "সেচ আদায়" },
  { date: "2026-01-02", direction: "in" as const, amount: 500, head: "সেচ আদায়" },
];

describe("buildCashBook", () => {
  it("sorts chronologically and keeps a running balance from opening", () => {
    const rows = buildCashBook(entries, 100);
    expect(rows.map((r) => r.date)).toEqual(["2026-01-01", "2026-01-02", "2026-01-03"]);
    expect(rows[0].balance).toBe(1100);
    expect(rows[1].balance).toBe(1600);
    expect(rows[2].balance).toBe(1400);
  });
});

describe("summarizeCashBook", () => {
  it("reconciles totals and closing balance", () => {
    const rows = buildCashBook(entries, 100);
    const rep = summarizeCashBook(rows, 100);
    expect(rep.total_in).toBe(1500);
    expect(rep.total_out).toBe(200);
    expect(rep.net).toBe(1300);
    expect(rep.closing).toBe(1400);
    expect(rep.closing).toBe(rows[rows.length - 1].balance);
  });
});

describe("validateHistoricalEntry", () => {
  it("accepts a valid past-but-unlocked entry", () => {
    expect(validateHistoricalEntry({ date: "2026-01-05", amount: 100, direction: "in" }, "2025-12-31", "2026-02-01").ok).toBe(true);
  });
  it("rejects entries within a closed period (bilingual)", () => {
    const r = validateHistoricalEntry({ date: "2025-12-15", amount: 100, direction: "in" }, "2025-12-31", "2026-02-01");
    expect(r.ok).toBe(false);
    expect(r.error!.bn).toContain("বন্ধ");
  });
  it("rejects future dates and non-positive amounts", () => {
    expect(validateHistoricalEntry({ date: "2030-01-01", amount: 100, direction: "in" }, null, "2026-02-01").ok).toBe(false);
    expect(validateHistoricalEntry({ date: "2026-01-01", amount: 0, direction: "in" }, null, "2026-02-01").ok).toBe(false);
  });
});
