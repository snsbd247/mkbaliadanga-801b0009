import { describe, it, expect } from "vitest";
import { landTypeLabel, type LandTypeRow } from "@/components/locations/LandTypeSelect";

const rows: LandTypeRow[] = [
  { id: "lt-high", code: "HIGH", name: "High", name_bn: "উঁচু" },
  { id: "lt-pukur", code: "PUKUR", name: "Pond", name_bn: "পুকুর" },
  { id: "lt-sobji", code: "SOBJI", name: "Vegetable", name_bn: "সবজি" },
];

describe("landTypeLabel regression — never falls back to Others when land_type_id present", () => {
  it("resolves custom catalogue id (পুকুর) instead of field_type 'other'", () => {
    expect(landTypeLabel(rows, "lt-pukur", "other")).toBe("পুকুর");
  });

  it("resolves সবজি by id even though enum is 'other'", () => {
    expect(landTypeLabel(rows, "lt-sobji", "other")).toBe("সবজি");
  });

  it("never returns the literal enum 'other' when a valid land_type_id is given", () => {
    for (const r of rows) {
      const label = landTypeLabel(rows, r.id, "other");
      expect(label).not.toBe("other");
      expect(label).toBe(r.name_bn);
    }
  });

  it("falls back to enum mapping only when land_type_id is missing", () => {
    expect(landTypeLabel(rows, null, "high_land")).toBe("উঁচু");
  });
});
