import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Guards against hardcoded single-language menu labels in the sidebar.
// Every `label:` must be either a translation key (`t(...)`) or an inline
// bilingual expression (`lang === "bn" ? ... : ...` / `tx(...)`), so labels
// always switch correctly between English and Bangla.
describe("AppSidebar i18n labels", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(resolve(here, "../AppSidebar.tsx"), "utf8");

  const labelLines = src
    .split("\n")
    .map((l, i) => ({ l, i: i + 1 }))
    .filter(({ l }) => /\blabel:\s*/.test(l));

  it("has menu labels to check", () => {
    expect(labelLines.length).toBeGreaterThan(20);
  });

  it("contains no hardcoded Bengali-only labels", () => {
    const bengali = /[\u0980-\u09FF]/;
    const offenders = labelLines.filter(({ l }) => {
      const m = l.match(/\blabel:\s*(.+?)(?:,\s*(?:permKey|superOnly|developerOnly|adminOnly):|,?\s*\})/);
      const value = m ? m[1] : l;
      // Allowed: bilingual ternary or tx() — these carry both languages.
      if (/lang\s*===\s*"bn"\s*\?/.test(value) || /\btx\(/.test(value)) return false;
      // A bare Bengali string literal with no English alternative is an offender.
      return bengali.test(value) && !/\bt\(/.test(value);
    });
    expect(offenders.map((o) => `L${o.i}: ${o.l.trim()}`)).toEqual([]);
  });
});
