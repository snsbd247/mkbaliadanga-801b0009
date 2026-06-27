import { describe, it, expect } from "vitest";
import { landTypeLabel, type LandTypeRow } from "@/components/locations/LandTypeSelect";

// Mirror of the active land_types catalogue (Irrigation Settings).
const ROWS: LandTypeRow[] = [
  { id: "id-pukur", code: "pukur", name: "Pukur", name_bn: "পুকুর" },
  { id: "id-high", code: "HIGH", name: "High Land", name_bn: "উঁচু জমি" },
  { id: "id-medium", code: "MEDIUM", name: "Medium Land", name_bn: "মাঝারি জমি" },
  { id: "id-low", code: "LOW", name: "Low Land", name_bn: "নিচু জমি" },
  { id: "id-vorti", code: "vorti_fee", name: "Bharti Fee", name_bn: "ভর্তি ফি" },
  { id: "id-bighat", code: "bighat", name: "Bighat", name_bn: "বিঘাত" },
  { id: "id-shobji", code: "shobji", name: "Vegetable", name_bn: "সবজি" },
  { id: "id-bagan", code: "bagan", name: "Garden", name_bn: "বাগান" },
  { id: "id-other", code: "other", name: "Other", name_bn: "অন্যান্য" },
];

const OTHERS = new Set(["অন্যান্য", "Other", "other"]);

describe("landTypeLabel — always resolves from land_type_id", () => {
  // The 5 new types must NEVER collapse to "Others" when their land_type_id is set,
  // even though their legacy field_type maps to the "other" enum.
  it.each([
    ["id-vorti", "ভর্তি ফি"],
    ["id-bighat", "বিঘাত"],
    ["id-shobji", "সবজি"],
    ["id-bagan", "বাগান"],
    ["id-pukur", "পুকুর"],
  ])("%s resolves by id (legacy field_type=other) → %s", (id, label) => {
    // field_type is the legacy enum "other" — id must win.
    const out = landTypeLabel(ROWS, id, "other", true);
    expect(out).toBe(label);
    expect(OTHERS.has(out)).toBe(false);
  });

  it("every catalogue row resolves to its own label by id", () => {
    for (const r of ROWS) {
      expect(landTypeLabel(ROWS, r.id, "other", true)).toBe(r.name_bn);
      expect(landTypeLabel(ROWS, r.id, null, false)).toBe(r.name);
    }
  });

  it("the real 'other' row still resolves to অন্যান্য", () => {
    expect(landTypeLabel(ROWS, "id-other", "other", true)).toBe("অন্যান্য");
  });

  it("legacy rows without id fall back via field_type enum (HIGH/MEDIUM/LOW)", () => {
    expect(landTypeLabel(ROWS, null, "high_land", true)).toBe("উঁচু জমি");
    expect(landTypeLabel(ROWS, null, "medium_land", true)).toBe("মাঝারি জমি");
    expect(landTypeLabel(ROWS, null, "low_land", true)).toBe("নিচু জমি");
  });

  it("unknown id does not crash and falls back to field_type", () => {
    expect(landTypeLabel(ROWS, "missing", "low_land", true)).toBe("নিচু জমি");
  });
});
