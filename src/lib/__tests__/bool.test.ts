import { describe, it, expect, vi } from "vitest";
import { toBool } from "../bool";

describe("toBool", () => {
  it("coerces real booleans", () => {
    expect(toBool(true)).toBe(true);
    expect(toBool(false)).toBe(false);
  });

  it("coerces 0/1 numbers (the is_voter=0 case)", () => {
    expect(toBool(0)).toBe(false);
    expect(toBool(1)).toBe(true);
  });

  it("coerces string flags", () => {
    expect(toBool("0")).toBe(false);
    expect(toBool("false")).toBe(false);
    expect(toBool("")).toBe(false);
    expect(toBool("1")).toBe(true);
    expect(toBool("true")).toBe(true);
  });

  it("treats null/undefined as false", () => {
    expect(toBool(null)).toBe(false);
    expect(toBool(undefined)).toBe(false);
  });

  it("never returns a number so JSX `x && ...` cannot render 0", () => {
    // Simulate: {toBool(is_voter) && <X/>} with is_voter = 0
    const rendered = toBool(0) && "X";
    expect(rendered).toBe(false); // not 0 -> React renders nothing
  });

  it("warns and falls back on unexpected types", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(toBool({} as unknown)).toBe(true);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
