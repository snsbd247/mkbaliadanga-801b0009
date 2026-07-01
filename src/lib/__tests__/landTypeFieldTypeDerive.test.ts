import { describe, it, expect } from "vitest";
import { deriveFieldType, looksLikeSeason } from "@/pages/LandsImport";

describe("field_type derivation from land_type", () => {
  it("maps Bengali land types to DB enum", () => {
    expect(deriveFieldType("উচু")).toBe("high_land");
    expect(deriveFieldType("উঁচু")).toBe("high_land");
    expect(deriveFieldType("নিচু")).toBe("low_land");
    expect(deriveFieldType("মাঝারি")).toBe("medium_land");
  });

  it("maps English land types to DB enum", () => {
    expect(deriveFieldType("high")).toBe("high_land");
    expect(deriveFieldType("LOW")).toBe("low_land");
    expect(deriveFieldType("Medium")).toBe("medium_land");
  });

  it("falls back to medium_land for unknown/empty types (e.g. পুকুর/সবজি)", () => {
    expect(deriveFieldType("পুকুর")).toBe("medium_land");
    expect(deriveFieldType("সবজি")).toBe("medium_land");
    expect(deriveFieldType("")).toBe("medium_land");
    expect(deriveFieldType(null)).toBe("medium_land");
  });
});

describe("season names are blocked as land_type", () => {
  it("rejects season names but accepts real land types", () => {
    for (const s of ["আমন২৬", "ইরি২৬", "বোরো২৬", "Aman26", "boro"]) {
      expect(looksLikeSeason(s)).toBe(true);
    }
    for (const s of ["উচু", "নিচু", "পুকুর", "সবজি", "pond"]) {
      expect(looksLikeSeason(s)).toBe(false);
    }
  });
});
