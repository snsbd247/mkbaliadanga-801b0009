import { describe, it, expect } from "vitest";
import { findDuplicateDagInMouza, validateDagNumbers } from "../dagNumbers";

describe("findDuplicateDagInMouza", () => {
  it("returns null when no overlap", () => {
    expect(findDuplicateDagInMouza(["10", "11"], ["12, 13", "14"])).toBeNull();
  });

  it("detects a colliding dag (case-insensitive)", () => {
    expect(findDuplicateDagInMouza(["124/a"], ["123, 124/A"])).toBe("124/a");
  });

  it("handles null/empty existing rows", () => {
    expect(findDuplicateDagInMouza(["5"], [null, "", undefined])).toBeNull();
  });

  it("matches any token in a multi-dag incoming list", () => {
    expect(findDuplicateDagInMouza(["100", "200"], ["50", "200"])).toBe("200");
  });
});

describe("validateDagNumbers format guard", () => {
  it("rejects illegal characters", () => {
    const r = validateDagNumbers("12@3");
    expect(r.ok).toBe(false);
  });
  it("accepts numeric, slash and dash forms", () => {
    const r = validateDagNumbers("123, 124/A, 125-B");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.values).toEqual(["123", "124/A", "125-B"]);
  });
});
