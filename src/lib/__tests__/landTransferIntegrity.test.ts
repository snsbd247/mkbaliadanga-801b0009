import { describe, it, expect } from "vitest";
import {
  checkLandTransferIntegrity, summarizeIntegrity,
  KNOWN_TRANSFER_TYPES,
  type IntegrityInput,
} from "@/lib/landTransferIntegrity";

// ---- builders -------------------------------------------------------------
function baseInput(): IntegrityInput {
  // Masud Rana (F1) gives borga of dag 45274 (10 dec) to Rahmat Ali (F2).
  return {
    transfers: [{
      id: "T1",
      source_land_id: "L_src",
      source_farmer_id: "F1",
      transfer_type: "borga_transfer",
      source_dag_no: "45274",
      source_mouza: "Baliadanga",
      source_land_size: 10,
      source_owner_name: "Masud Rana",
      source_owner_code: "F-001",
      transferred_at: "2026-01-01",
    }],
    recipients: [{
      id: "R1", transfer_id: "T1", recipient_farmer_id: "F2",
      new_land_id: "L_new", area_decimal: 10,
    }],
    lands: [
      { id: "L_src", farmer_id: "F1", dag_no: "45274", land_size: 0, deleted_at: "2026-01-01" },
      { id: "L_new", farmer_id: "F2", dag_no: "45274", land_size: 10, deleted_at: null },
    ],
  };
}

describe("landTransferIntegrity — happy path", () => {
  it("known transfer types list is stable", () => {
    expect(KNOWN_TRANSFER_TYPES).toEqual(expect.arrayContaining([
      "inheritance", "sale", "borga_transfer", "borga_return", "split",
    ]));
  });

  it("clean borga transfer has no violations", () => {
    const v = checkLandTransferIntegrity(baseInput());
    expect(v).toEqual([]);
    const s = summarizeIntegrity(baseInput(), v);
    expect(s.allOk).toBe(true);
    expect(s.total).toBe(1);
    expect(s.withRecipients).toBe(1);
  });

  it("split to multiple children within source size is valid", () => {
    const inp = baseInput();
    inp.transfers[0].transfer_type = "split";
    inp.transfers[0].source_land_size = 10;
    inp.recipients = [
      { id: "R1", transfer_id: "T1", recipient_farmer_id: "C1", new_land_id: "Lc1", area_decimal: 6 },
      { id: "R2", transfer_id: "T1", recipient_farmer_id: "C2", new_land_id: "Lc2", area_decimal: 4 },
    ];
    inp.lands.push(
      { id: "Lc1", farmer_id: "C1", dag_no: "45274", land_size: 6, deleted_at: null },
      { id: "Lc2", farmer_id: "C2", dag_no: "45274", land_size: 4, deleted_at: null },
    );
    expect(checkLandTransferIntegrity(inp)).toEqual([]);
  });
});

describe("landTransferIntegrity — violations", () => {
  it("flags unknown transfer type", () => {
    const inp = baseInput();
    inp.transfers[0].transfer_type = "bogus";
    const v = checkLandTransferIntegrity(inp);
    expect(v.some((x) => x.code === "unknown_type")).toBe(true);
  });

  it("flags missing snapshot", () => {
    const inp = baseInput();
    inp.transfers[0].source_dag_no = null;
    inp.transfers[0].source_owner_name = null;
    const v = checkLandTransferIntegrity(inp);
    expect(v.some((x) => x.code === "missing_snapshot")).toBe(true);
  });

  it("flags transfer with no recipients", () => {
    const inp = baseInput();
    inp.recipients = [];
    const v = checkLandTransferIntegrity(inp);
    expect(v.some((x) => x.code === "no_recipients")).toBe(true);
  });

  it("flags recipient without created land row", () => {
    const inp = baseInput();
    inp.recipients[0].new_land_id = null;
    const v = checkLandTransferIntegrity(inp);
    expect(v.some((x) => x.code === "recipient_no_land")).toBe(true);
  });

  it("flags recipient land missing from lands table", () => {
    const inp = baseInput();
    inp.lands = inp.lands.filter((l) => l.id !== "L_new");
    const v = checkLandTransferIntegrity(inp);
    expect(v.some((x) => x.code === "recipient_land_missing")).toBe(true);
  });

  it("warns when recipient land is archived (not visible)", () => {
    const inp = baseInput();
    inp.lands.find((l) => l.id === "L_new")!.deleted_at = "2026-02-01";
    const v = checkLandTransferIntegrity(inp);
    expect(v.find((x) => x.code === "recipient_land_archived")?.severity).toBe("warning");
  });

  it("flags zero/negative recipient area", () => {
    const inp = baseInput();
    inp.recipients[0].area_decimal = 0;
    const v = checkLandTransferIntegrity(inp);
    expect(v.some((x) => x.code === "recipient_no_area")).toBe(true);
  });

  it("flags allocated area exceeding source size", () => {
    const inp = baseInput();
    inp.recipients[0].area_decimal = 25;
    const v = checkLandTransferIntegrity(inp);
    expect(v.some((x) => x.code === "area_exceeds_source")).toBe(true);
  });

  it("warns when recipient equals source farmer for ownership transfer", () => {
    const inp = baseInput();
    inp.transfers[0].transfer_type = "sale";
    inp.recipients[0].recipient_farmer_id = "F1";
    const v = checkLandTransferIntegrity(inp);
    expect(v.some((x) => x.code === "recipient_equals_source")).toBe(true);
  });

  it("summary counts errors vs warnings and flips allOk", () => {
    const inp = baseInput();
    inp.recipients[0].area_decimal = 99;          // error
    inp.lands.find((l) => l.id === "L_new")!.deleted_at = "x"; // warning
    const v = checkLandTransferIntegrity(inp);
    const s = summarizeIntegrity(inp, v);
    expect(s.errors).toBeGreaterThan(0);
    expect(s.warnings).toBeGreaterThan(0);
    expect(s.allOk).toBe(false);
  });
});

describe("landTransferIntegrity — two-profile visibility (regression)", () => {
  it("recipient land belongs to recipient farmer, source archived — both profiles see it", () => {
    const inp = baseInput();
    const srcLand = inp.lands.find((l) => l.id === "L_src")!;
    const newLand = inp.lands.find((l) => l.id === "L_new")!;
    // Source archived (Masud Rana gave full land) -> history via snapshot
    expect(srcLand.deleted_at).not.toBeNull();
    // Recipient (Rahmat Ali) has an ACTIVE land row -> shows on his profile
    expect(newLand.deleted_at).toBeNull();
    expect(newLand.farmer_id).toBe("F2");
    expect(checkLandTransferIntegrity(inp)).toEqual([]);
  });

  it("borga_return does not flag recipient==source (reclaim back to owner)", () => {
    const inp = baseInput();
    inp.transfers[0].transfer_type = "borga_return";
    inp.recipients[0].recipient_farmer_id = "F1"; // reclaimed back to owner
    const v = checkLandTransferIntegrity(inp);
    expect(v.some((x) => x.code === "recipient_equals_source")).toBe(false);
  });
});
