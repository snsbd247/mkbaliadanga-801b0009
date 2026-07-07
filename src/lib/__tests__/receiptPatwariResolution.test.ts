import { describe, it, expect } from "vitest";
import {
  resolveReceiptPatwari,
  patwariDisplay,
  PATWARI_NAME_MISSING,
  PATWARI_MOBILE_MISSING,
  type PatwariRow,
} from "@/lib/irrigationReceiptData";

const landPatwari: PatwariRow = { name: "Land Patwari", name_bn: "জমি পাটুয়ারী", mobile: "01711000000" };
const mouzaPatwari: PatwariRow = { name: "Mouza Patwari", name_bn: "মৌজা পাটুয়ারী", mobile: "01822000000" };

const patwariById = { "p-land": landPatwari };
const patwariByMouza = { "m-1": mouzaPatwari };

describe("resolveReceiptPatwari", () => {
  it("uses the patwari selected on the land when present", () => {
    const res = resolveReceiptPatwari(
      { patwari_id: "p-land", mouza_id: "m-1" },
      patwariById,
      patwariByMouza,
    );
    expect(res.source).toBe("land");
    expect(res.patwari).toBe(landPatwari);
  });

  it("falls back to the mouza patwari when the land has none selected", () => {
    const res = resolveReceiptPatwari(
      { patwari_id: null, mouza_id: "m-1" },
      patwariById,
      patwariByMouza,
    );
    expect(res.source).toBe("mouza");
    expect(res.patwari).toBe(mouzaPatwari);
  });

  it("falls back to the mouza patwari when land patwari_id points to nothing", () => {
    const res = resolveReceiptPatwari(
      { patwari_id: "missing", mouza_id: "m-1" },
      patwariById,
      patwariByMouza,
    );
    expect(res.source).toBe("mouza");
    expect(res.patwari).toBe(mouzaPatwari);
  });

  it("returns none when neither land nor mouza has a patwari", () => {
    const res = resolveReceiptPatwari(
      { patwari_id: null, mouza_id: "m-unknown" },
      patwariById,
      patwariByMouza,
    );
    expect(res.source).toBeNull();
    expect(res.patwari).toBeNull();
  });

  it("returns none for a null land", () => {
    const res = resolveReceiptPatwari(null, patwariById, patwariByMouza);
    expect(res.source).toBeNull();
    expect(res.patwari).toBeNull();
  });

  it("never leaks the wrong mouza patwari when land patwari exists", () => {
    // land patwari selected but a different mouza also has one — land wins.
    const res = resolveReceiptPatwari(
      { patwari_id: "p-land", mouza_id: "m-1" },
      patwariById,
      patwariByMouza,
    );
    expect(res.patwari).not.toBe(mouzaPatwari);
  });
});

describe("patwariDisplay placeholders", () => {
  it("prefers Bengali name and shows mobile", () => {
    expect(patwariDisplay(landPatwari)).toEqual({
      name: "জমি পাটুয়ারী",
      mobile: "01711000000",
    });
  });

  it("falls back to English name when Bengali missing", () => {
    expect(patwariDisplay({ name: "Only EN", name_bn: null, mobile: "019" }).name).toBe("Only EN");
  });

  it("shows explicit placeholder text when patwari is missing", () => {
    expect(patwariDisplay(null)).toEqual({
      name: PATWARI_NAME_MISSING,
      mobile: PATWARI_MOBILE_MISSING,
    });
  });

  it("shows mobile placeholder when only the number is missing", () => {
    const d = patwariDisplay({ name: "X", name_bn: "এক্স", mobile: null });
    expect(d.name).toBe("এক্স");
    expect(d.mobile).toBe(PATWARI_MOBILE_MISSING);
  });
});
