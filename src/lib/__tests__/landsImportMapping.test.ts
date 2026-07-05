import { describe, it, expect } from "vitest";
import {
  classifyImportRow,
  validateOwnerType,
  reclassifyLandOwnerType,
  isBorgaOwnerType,
} from "@/lib/landsImportMapping";

describe("lands import owner/borga mapping", () => {
  it("owner row → owner-owned land in Own Land tab, no relation", () => {
    const m = classifyImportRow({ owner_farmer_id: "00001", owner_type: "own" });
    expect(m.landOwnerType).toBe("owner");
    expect(m.ownerTab).toBe("Own Land");
    expect(m.createsBorgaRelation).toBe(false);
  });

  it("borga row keeps land owner_type=owner and creates a relation", () => {
    const m = classifyImportRow({
      owner_farmer_id: "00002",
      owner_type: "borga",
      sharecropper_id: "00003",
    });
    // Regression guard: borga must NEVER flip the land record to borgadar.
    expect(m.landOwnerType).toBe("owner");
    expect(m.ownerTab).toBe("Own Land");
    expect(m.createsBorgaRelation).toBe(true);
    expect(m.summary.bn).toContain("00003");
  });

  it("recognises all borga aliases", () => {
    for (const v of ["borga", "borgadar", "বর্গা", "বর্গাদার", "share"]) {
      expect(isBorgaOwnerType(v)).toBe(true);
      expect(classifyImportRow({ owner_type: v }).createsBorgaRelation).toBe(true);
    }
  });

  it("validateOwnerType: own/borga/empty ok, garbage rejected with detail", () => {
    expect(validateOwnerType("own").ok).toBe(true);
    expect(validateOwnerType("borga").recognized).toBe("borga");
    expect(validateOwnerType("").recognized).toBe("own");
    const bad = validateOwnerType("mixed");
    expect(bad.ok).toBe(false);
    expect(bad.message).toContain("mixed");
  });

  it("reclassify flags legacy borga-flagged land back to owner", () => {
    expect(reclassifyLandOwnerType({ owner_type: "borgadar" })).toBe("owner");
    expect(reclassifyLandOwnerType({ owner_type: "owner" })).toBeNull();
  });
});
