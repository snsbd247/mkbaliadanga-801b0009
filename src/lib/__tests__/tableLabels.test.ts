import { describe, it, expect } from "vitest";
import { tableLabel, KNOWN_TABLE_KEYS } from "@/lib/tableLabels";

describe("tableLabel i18n mapping", () => {
  it("never returns the raw internal key for known tables", () => {
    for (const key of KNOWN_TABLE_KEYS) {
      expect(tableLabel(key, "bn")).not.toBe(key);
      expect(tableLabel(key, "en")).not.toBe(key);
    }
  });

  it("maps common keys to Bengali labels", () => {
    expect(tableLabel("shares", "bn")).toBe("শেয়ার");
    expect(tableLabel("loans", "bn")).toBe("ঋণ");
  });

  it("falls back to the key for unknown names", () => {
    expect(tableLabel("some_unknown_table", "bn")).toBe("some_unknown_table");
  });
});
