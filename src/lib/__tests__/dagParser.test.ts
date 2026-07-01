import { describe, it, expect } from "vitest";
import { parseDagNumbers, analyzeDagNo } from "../dagParser";

describe("parseDagNumbers", () => {
  it("treats a slash dag as a single valid dag", () => {
    expect(parseDagNumbers("1/330")).toEqual(["1/330"]);
  });
  it("splits comma-separated dags", () => {
    expect(parseDagNumbers("1,330")).toEqual(["1", "330"]);
  });
  it("splits semicolon-separated dags", () => {
    expect(parseDagNumbers("1;330")).toEqual(["1", "330"]);
  });
  it("trims surrounding whitespace", () => {
    expect(parseDagNumbers("  1/330  ")).toEqual(["1/330"]);
    expect(parseDagNumbers("1 , 330")).toEqual(["1", "330"]);
  });
  it("parses JSON array", () => {
    expect(parseDagNumbers('["1/330","2/40"]')).toEqual(["1/330", "2/40"]);
  });
  it("returns empty for blank", () => {
    expect(parseDagNumbers("")).toEqual([]);
    expect(parseDagNumbers(null)).toEqual([]);
  });
});

describe("analyzeDagNo", () => {
  it("does not warn or block on slash dag", () => {
    const a = analyzeDagNo("1/330");
    expect(a.separator).toBe("none");
    expect(a.warned).toBe(false);
    expect(a.blocked).toBe(false);
    expect(a.warnMsg).toBeNull();
    expect(a.numbers).toEqual(["1/330"]);
  });
  it("detects comma separator", () => {
    expect(analyzeDagNo("1,330").separator).toBe("comma");
  });
  it("detects semicolon separator", () => {
    expect(analyzeDagNo("1;330").separator).toBe("semicolon");
  });
  it("warns (never blocks) on pipe separator", () => {
    const a = analyzeDagNo("1|330");
    expect(a.separator).toBe("pipe");
    expect(a.warned).toBe(true);
    expect(a.blocked).toBe(false);
    expect(a.warnMsg).toContain("1|330");
  });
});
