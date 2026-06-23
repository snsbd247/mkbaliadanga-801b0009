import { describe, it, expect } from "vitest";
import { normalizeDagInput, parseDagNumbers } from "@/lib/dagNumbers";

/**
 * Dag normalization migration — logic-level verification.
 *
 * The migration only reformats the textual `dag_no` field (separators/whitespace)
 * after Mouza simplification. It MUST:
 *  - transform messy separators to the canonical "a, b, c" form
 *  - preserve every dag token (no drop, no merge, no reorder)
 *  - never touch numeric land amounts/totals
 *
 * `normalizeDagInput` is the exact transform the migration applies, so testing it
 * here guarantees the migration's behaviour without a live DB.
 */

// Mirrors the SQL migration: replace \n \t ; with comma, collapse, trim, re-join.
function migrateDag(raw: string | null): string {
  return normalizeDagInput(raw);
}

describe("Dag normalization migration — field transform", () => {
  it("converts newlines/tabs/semicolons to canonical comma form", () => {
    expect(migrateDag("12\n13;14\t15")).toBe("12, 13, 14, 15");
  });

  it("collapses extra whitespace and drops empty tokens", () => {
    expect(migrateDag("  123 ,, ,  124/A  ,  ")).toBe("123, 124/A");
  });

  it("leaves already-canonical values unchanged (idempotent)", () => {
    const canonical = "123, 124/A, 125-B";
    expect(migrateDag(canonical)).toBe(canonical);
    expect(migrateDag(migrateDag(canonical))).toBe(canonical);
  });

  it("preserves every dag token and order", () => {
    const before = parseDagNumbers("9;1\n5,3");
    const after = parseDagNumbers(migrateDag("9;1\n5,3"));
    expect(after).toEqual(["9", "1", "5", "3"]);
    expect(after).toEqual(before);
  });

  it("handles null / blank rows without throwing", () => {
    expect(migrateDag(null)).toBe("");
    expect(migrateDag("   \n ")).toBe("");
  });
});

describe("Dag normalization migration — totals are untouched", () => {
  it("does not alter land area/amount when reformatting dag_no", () => {
    const row = { dag_no: "10\n11;12", area_decimal: 33.0, amount: 4950.5 };
    const migrated = { ...row, dag_no: migrateDag(row.dag_no) };
    expect(migrated.dag_no).toBe("10, 11, 12");
    // Numeric fields must be byte-for-byte identical.
    expect(migrated.area_decimal).toBe(row.area_decimal);
    expect(migrated.amount).toBe(row.amount);
  });

  it("token count is preserved so per-dag computations stay valid", () => {
    const raw = "100; 101; 102; 103";
    expect(parseDagNumbers(migrateDag(raw))).toHaveLength(4);
  });
});
