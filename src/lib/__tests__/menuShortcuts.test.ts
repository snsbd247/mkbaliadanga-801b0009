import { describe, it, expect } from "vitest";
import { MENU_SHORTCUTS } from "@/lib/menuShortcuts";
import { translations } from "@/i18n/translations";

describe("menu shortcuts", () => {
  it("has unique codes", () => {
    const codes = MENU_SHORTCUTS.map(s => s.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
  it("every labelKey exists in EN and BN dictionaries", () => {
    for (const s of MENU_SHORTCUTS) {
      expect((translations.en as any)[s.labelKey], `EN missing: ${s.labelKey}`).toBeTruthy();
      expect((translations.bn as any)[s.labelKey], `BN missing: ${s.labelKey}`).toBeTruthy();
    }
  });
  it("M11 maps to /farmers", () => {
    const m11 = MENU_SHORTCUTS.find(s => s.code === "M11");
    expect(m11?.url).toBe("/farmers");
  });
});
