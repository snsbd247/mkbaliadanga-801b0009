import { describe, it, expect } from "vitest";
import { buildLandExportRows, type LandExportRow } from "@/lib/landExport";

describe("land export rows — always use resolved land type label, never 'Others'", () => {
  it("uses field_type_label (resolved from land_type_id) over legacy field_type", () => {
    const lands: LandExportRow[] = [
      { dag_no: "D100", land_size: 33, owner_type: "owner", field_type: "other", field_type_label: "পুকুর" },
      { dag_no: "D101", land_size: 66, owner_type: "owner", field_type: "other", field_type_label: "সবজি" },
    ];
    const rows = buildLandExportRows(lands);
    // Field Type is the last column.
    expect(rows[0][rows[0].length - 1]).toBe("পুকুর");
    expect(rows[1][rows[1].length - 1]).toBe("সবজি");
    expect(rows.map((r) => r[r.length - 1])).not.toContain("other");
  });

  it("falls back to field_type only when no resolved label exists", () => {
    const lands: LandExportRow[] = [
      { dag_no: "D200", land_size: 33, owner_type: "owner", field_type: "high_land" },
    ];
    const rows = buildLandExportRows(lands);
    expect(rows[0][rows[0].length - 1]).toBe("high_land");
  });
});
