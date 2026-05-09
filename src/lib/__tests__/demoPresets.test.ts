import { describe, it, expect } from "vitest";
import {
  DEMO_PRESETS, ALL_MODULES, MODULE_VERIFY,
  expectedTablesForModules, buildRowCountReport, summarizeReport,
} from "@/lib/demoPresets";

describe("demoPresets — preset configuration", () => {
  it("provides small / medium / large + module-only presets", () => {
    const ids = DEMO_PRESETS.map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining([
      "small", "medium", "large", "loans_only", "savings_only", "irrigation_only",
    ]));
  });

  it("size presets cover all 8 modules", () => {
    for (const id of ["small", "medium", "large"]) {
      const p = DEMO_PRESETS.find((x) => x.id === id)!;
      expect(p.modules.length).toBe(ALL_MODULES.length);
    }
  });

  it("module-only presets always include farmers + accounting + locations", () => {
    for (const id of ["loans_only", "savings_only", "irrigation_only"]) {
      const p = DEMO_PRESETS.find((x) => x.id === id)!;
      expect(p.modules).toEqual(expect.arrayContaining(["farmers", "accounting", "locations"]));
    }
  });

  it("size is between 5 and 500 (server clamp range)", () => {
    for (const p of DEMO_PRESETS) {
      expect(p.size).toBeGreaterThanOrEqual(5);
      expect(p.size).toBeLessThanOrEqual(500);
    }
  });
});

describe("demoPresets — verification mapping", () => {
  it("every module has at least one required table", () => {
    for (const m of ALL_MODULES) {
      const entries = MODULE_VERIFY[m];
      expect(entries.some((e) => e.required), `module ${m} has no required table`).toBe(true);
    }
  });

  it("every required table maps to a non-empty page route", () => {
    for (const m of ALL_MODULES) {
      for (const e of MODULE_VERIFY[m]) {
        expect(e.page.startsWith("/")).toBe(true);
        expect(e.page_label.length).toBeGreaterThan(0);
      }
    }
  });

  it("expectedTablesForModules returns combined entries", () => {
    const out = expectedTablesForModules(["loans", "savings"]);
    const tables = out.map((x) => x.table);
    expect(tables).toEqual(expect.arrayContaining(["loans", "loan_installments", "savings_plans", "savings_transactions"]));
  });

  it("ignores unknown modules", () => {
    expect(expectedTablesForModules(["bogus"]).length).toBe(0);
  });
});

describe("demoPresets — buildRowCountReport (no module empty after seed)", () => {
  it("flags zero-row required tables as empty_required", () => {
    const counts: Record<string, number> = {
      loans: 10, loan_installments: 0, loan_plans: 3, loan_delay_fee_settings: 1, loan_payments: 5,
    };
    const rows = buildRowCountReport(["loans"], counts);
    const inst = rows.find((r) => r.table === "loan_installments");
    expect(inst?.status).toBe("empty_required");
  });

  it("flags zero-row optional tables as empty_optional (warning)", () => {
    const counts: Record<string, number> = {
      farmers: 50, lands: 50, patwaris: 0, land_relations: 0,
    };
    const rows = buildRowCountReport(["farmers"], counts);
    expect(rows.find((r) => r.table === "patwaris")?.status).toBe("empty_optional");
    expect(rows.find((r) => r.table === "land_relations")?.status).toBe("empty_optional");
  });

  it("marks ok when actual > 0", () => {
    const counts = { farmers: 10, lands: 10, patwaris: 4, land_relations: 2 };
    const rows = buildRowCountReport(["farmers"], counts);
    expect(rows.every((r) => r.status === "ok")).toBe(true);
  });

  it("summarizeReport.allOk is false when any required table is empty", () => {
    const rows = buildRowCountReport(["loans"], { loans: 1, loan_installments: 0, loan_plans: 1, loan_delay_fee_settings: 1 });
    const s = summarizeReport(rows);
    expect(s.allOk).toBe(false);
    expect(s.failed).toBeGreaterThan(0);
  });

  it("summarizeReport.allOk is true when all required tables have rows", () => {
    // simulate a full successful seed with every required table populated
    const counts: Record<string, number> = {};
    for (const m of ALL_MODULES) for (const e of MODULE_VERIFY[m]) counts[e.table] = 5;
    const rows = buildRowCountReport(ALL_MODULES, counts);
    const s = summarizeReport(rows);
    expect(s.allOk).toBe(true);
    expect(s.failed).toBe(0);
  });
});
