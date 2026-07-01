import { describe, it, expect } from "vitest";
import { looksLikeSeason } from "@/pages/LandsImport";

describe("land_type season guard", () => {
  it("flags Bengali season names", () => {
    for (const s of ["আমন২৬", "ইরি২৬", "বোরো২৬", "আউশ", "রবি ২৫"]) {
      expect(looksLikeSeason(s)).toBe(true);
    }
  });

  it("flags English season names", () => {
    for (const s of ["Aman26", "IRI-26", "boro", "Aus 2026"]) {
      expect(looksLikeSeason(s)).toBe(true);
    }
  });

  it("accepts real land types", () => {
    for (const s of ["পুকুর", "সবজি", "বাগান", "pond", "vegetable", "", "  "]) {
      expect(looksLikeSeason(s)).toBe(false);
    }
  });
});
