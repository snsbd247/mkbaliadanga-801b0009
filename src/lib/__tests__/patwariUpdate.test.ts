import { describe, it, expect } from "vitest";
import { computePatwariUpdateTargets, type PatwariUpdateInvoice } from "@/lib/patwariUpdate";

const inv = (over: Partial<PatwariUpdateInvoice>): PatwariUpdateInvoice => ({
  invoice_no: "INV-1",
  land_id: "land-1",
  lands: { mouza: "M", dag_no: "10", patwari_id: null },
  ...over,
});

describe("computePatwariUpdateTargets", () => {
  it("returns [] when no manual patwari is selected", () => {
    expect(computePatwariUpdateTargets([inv({})], "")).toEqual([]);
    expect(computePatwariUpdateTargets([inv({})], null)).toEqual([]);
  });

  it("single invoice: targets the land with no patwari", () => {
    const out = computePatwariUpdateTargets([inv({ land_id: "L1" })], "pat-1");
    expect(out).toHaveLength(1);
    expect(out[0].land_id).toBe("L1");
  });

  it("skips a land that already has the selected patwari", () => {
    const out = computePatwariUpdateTargets(
      [inv({ land_id: "L1", lands: { mouza: "M", dag_no: "1", patwari_id: "pat-1" } })],
      "pat-1",
    );
    expect(out).toEqual([]);
  });

  it("multiple invoices: updates every distinct land, dedupes shared land", () => {
    const out = computePatwariUpdateTargets(
      [
        inv({ invoice_no: "INV-A", land_id: "L1" }),
        inv({ invoice_no: "INV-B", land_id: "L2" }),
        inv({ invoice_no: "INV-C", land_id: "L1" }), // same land as A → deduped
      ],
      "pat-9",
    );
    expect(out.map((r) => r.land_id).sort()).toEqual(["L1", "L2"]);
  });

  it("ignores invoices without a land_id", () => {
    const out = computePatwariUpdateTargets(
      [inv({ land_id: null }), inv({ invoice_no: "INV-B", land_id: "L2" })],
      "pat-1",
    );
    expect(out.map((r) => r.land_id)).toEqual(["L2"]);
  });

  it("mixes changed and unchanged lands correctly", () => {
    const out = computePatwariUpdateTargets(
      [
        inv({ invoice_no: "INV-A", land_id: "L1", lands: { mouza: "M", dag_no: "1", patwari_id: "pat-1" } }),
        inv({ invoice_no: "INV-B", land_id: "L2", lands: { mouza: "N", dag_no: "2", patwari_id: null } }),
      ],
      "pat-1",
    );
    expect(out.map((r) => r.land_id)).toEqual(["L2"]);
  });
});
