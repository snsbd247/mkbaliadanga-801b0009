import { describe, it, expect } from "vitest";
import {
  parseDagNumbers,
  validateDagNumbers,
  formatDagNumbers,
  matchesDagSearch,
} from "@/lib/dagNumbers";

describe("dagNumbers — parsing & formatting", () => {
  it("parses single dag", () => {
    expect(parseDagNumbers("123")).toEqual(["123"]);
  });
  it("parses comma-separated dags trimming whitespace", () => {
    expect(parseDagNumbers(" 123 , 124/A , 125-B ")).toEqual(["123", "124/A", "125-B"]);
  });
  it("filters empty tokens", () => {
    expect(parseDagNumbers("123,,124, ,")).toEqual(["123", "124"]);
  });
  it("returns [] for null/empty", () => {
    expect(parseDagNumbers(null)).toEqual([]);
    expect(parseDagNumbers("")).toEqual([]);
    expect(parseDagNumbers("   ")).toEqual([]);
  });
  it("formats to canonical comma-space form", () => {
    expect(formatDagNumbers("123,124/A , 125")).toBe("123, 124/A, 125");
  });
  it("supports custom separator (newline) for receipts", () => {
    expect(formatDagNumbers("123, 124/A", "\n")).toBe("123\n124/A");
  });
});

describe("dagNumbers — validation", () => {
  it("rejects empty input", () => {
    const v = validateDagNumbers("");
    expect(v.ok).toBe(false);
    if (v.ok === false) expect(v.error).toMatch(/আবশ্যক/);
  });
  it("accepts simple numeric", () => {
    expect(validateDagNumbers("123").ok).toBe(true);
  });
  it("accepts alphanumeric with / and -", () => {
    expect(validateDagNumbers("123, 124/A, 125-B").ok).toBe(true);
  });
  it("rejects illegal characters", () => {
    const v = validateDagNumbers("123, 12$4");
    expect(v.ok).toBe(false);
  });
  it("rejects duplicates (case-insensitive)", () => {
    const v = validateDagNumbers("124/A, 124/a");
    expect(v.ok).toBe(false);
    if (v.ok === false) expect(v.error).toMatch(/ডুপ্লিকেট/);
  });
  it("rejects oversize tokens", () => {
    const v = validateDagNumbers("1".repeat(40));
    expect(v.ok).toBe(false);
  });
});

describe("dagNumbers — search matching", () => {
  it("matches any dag in the joined string", () => {
    expect(matchesDagSearch("123, 124/A, 125-B", "124")).toBe(true);
    expect(matchesDagSearch("123, 124/A, 125-B", "125-B")).toBe(true);
  });
  it("partial substring also matches", () => {
    expect(matchesDagSearch("123, 124/A", "/A")).toBe(true);
  });
  it("returns true for empty query", () => {
    expect(matchesDagSearch("123", "")).toBe(true);
  });
  it("does not match unrelated query", () => {
    expect(matchesDagSearch("123, 124/A", "999")).toBe(false);
  });
  it("safely handles null", () => {
    expect(matchesDagSearch(null, "123")).toBe(false);
    expect(matchesDagSearch(undefined, "123")).toBe(false);
  });
});

describe("dagNumbers — module integration regressions", () => {
  it("receipt-style display uses formatted dag list", () => {
    const dag = "123,124/A,125";
    // Simulate bnReceipts mouzaParts join
    const mouza = "Baliadanga";
    const sizeLabel = "1.50 bigha";
    const parts = [mouza, formatDagNumbers(dag) || undefined, sizeLabel].filter(Boolean) as string[];
    expect(parts.join(" / ")).toBe("Baliadanga / 123, 124/A, 125 / 1.50 bigha");
  });

  it("invoice PDF row shows comma-joined dag list", () => {
    const dag = " 123 , 124/A ";
    const row = `Mouza / দাগ ${formatDagNumbers(dag) || "—"} / 1.50 bigha`;
    expect(row).toBe("Mouza / দাগ 123, 124/A / 1.50 bigha");
  });

  it("import roundtrip: parse -> format yields canonical form", () => {
    const csvCell = "123,124/A,  125 ";
    const canonical = formatDagNumbers(csvCell);
    expect(canonical).toBe("123, 124/A, 125");
    // re-parsing canonical yields same array
    expect(parseDagNumbers(canonical)).toEqual(["123", "124/A", "125"]);
  });

  it("client-side search filter works on the dag column for IrrigationInvoices", () => {
    const rows = [
      { lands: { dag_no: "100, 101/A" } },
      { lands: { dag_no: "200" } },
      { lands: { dag_no: null } },
    ];
    const found = rows.filter((r) => matchesDagSearch(r.lands?.dag_no, "101"));
    expect(found).toHaveLength(1);
    expect(found[0].lands.dag_no).toBe("100, 101/A");
  });
});

describe("dagNumbers — save canonicalization", () => {
  it("dv.values.join(', ') matches formatDagNumbers", () => {
    const input = " 123 ,124/A,  125-B ";
    const dv = validateDagNumbers(input);
    expect(dv.ok).toBe(true);
    if (dv.ok) {
      expect(dv.values.join(", ")).toBe(formatDagNumbers(input));
      expect(dv.values.join(", ")).toBe("123, 124/A, 125-B");
    }
  });
  it("server-side regex (matches DB trigger) rejects bad chars", () => {
    const SERVER_PATTERN = /^[A-Za-z0-9০-৯/\-]+$/;
    expect(SERVER_PATTERN.test("123")).toBe(true);
    expect(SERVER_PATTERN.test("124/A")).toBe(true);
    expect(SERVER_PATTERN.test("125-B")).toBe(true);
    expect(SERVER_PATTERN.test("12$4")).toBe(false);
    expect(SERVER_PATTERN.test("12 4")).toBe(false);
  });
});
