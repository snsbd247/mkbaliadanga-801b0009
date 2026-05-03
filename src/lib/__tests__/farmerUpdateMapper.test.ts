import { describe, it, expect } from "vitest";
import { toFarmerUpdatePayload, FARMER_WRITABLE_COLUMNS } from "../farmerUpdateMapper";
import { validateLocationChain } from "../locationValidation";

describe("toFarmerUpdatePayload", () => {
  const baseRow = {
    id: "abc",
    farmer_code: "F-1",
    created_at: "x",
    updated_at: "x",
    name_en: "John",
    name_bn: "জন",
    voter_number: "12345",
    is_voter: true,
    office_id: "o1",
    // Joined relations that must be stripped:
    offices: { name: "HQ" },
    villages: { name: "V", name_bn: "ভ" },
    divisions: { name: "D" },
    districts: { name: "D" },
    upazilas: { name: "U" },
    unions: { name: "U" },
    wards: { name: "W" },
    mouzas: { name: "M" },
  };

  it("strips joined relations and read-only columns", () => {
    const payload = toFarmerUpdatePayload(baseRow);
    for (const banned of [
      "id", "farmer_code", "created_at", "updated_at",
      "offices", "villages", "divisions", "districts",
      "upazilas", "unions", "wards", "mouzas",
    ]) {
      expect(payload).not.toHaveProperty(banned);
    }
  });

  it("includes voter_number when present (first-assignment case)", () => {
    const payload = toFarmerUpdatePayload(baseRow);
    expect(payload.voter_number).toBe("12345");
    expect(payload.is_voter).toBe(true);
  });

  it("drops empty voter_number to avoid nullifying immutable value", () => {
    const payload = toFarmerUpdatePayload({ ...baseRow, voter_number: "" });
    expect(payload).not.toHaveProperty("voter_number");
  });

  it("normalises empty office_id to null", () => {
    const payload = toFarmerUpdatePayload({ ...baseRow, office_id: "" });
    expect(payload.office_id).toBeNull();
  });

  it("merges extras (e.g. fresh photo_url) without leaking unknown keys", () => {
    const payload = toFarmerUpdatePayload(baseRow, { photo_url: "https://x" });
    expect(payload.photo_url).toBe("https://x");
    expect(Object.keys(payload).every((k) => (FARMER_WRITABLE_COLUMNS as readonly string[]).includes(k))).toBe(true);
  });

  it("only emits whitelisted columns regardless of locale-specific extra keys", () => {
    // Simulate a row with stray bilingual joined fields
    const noisy = { ...baseRow, district_bn: "জেলা", random: "junk", __ts__: 1 };
    const payload = toFarmerUpdatePayload(noisy);
    expect(payload).not.toHaveProperty("district_bn");
    expect(payload).not.toHaveProperty("random");
    expect(payload).not.toHaveProperty("__ts__");
  });
});

describe("validateLocationChain (locale-agnostic required-field enforcement)", () => {
  it("passes when full chain present", () => {
    expect(
      validateLocationChain({
        division_id: "d", district_id: "ds", upazila_id: "u",
        union_id: "un", ward_id: "w", village_id: "v", mouza_id: "m",
      })
    ).toEqual({ ok: true });
  });

  it("flags the missing parent level when a child is selected without ancestors", () => {
    const r = validateLocationChain({
      division_id: null, district_id: "ds", upazila_id: null,
      union_id: null, ward_id: null, village_id: null, mouza_id: null,
    });
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.level).toBe("division");
  });

  it("treats Bangla-locale empty strings as missing", () => {
    const r = validateLocationChain({
      division_id: "d", district_id: "ds", upazila_id: "u",
      union_id: "un", ward_id: "w", village_id: "" as any, mouza_id: "m",
    });
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.level).toBe("village");
  });
});
