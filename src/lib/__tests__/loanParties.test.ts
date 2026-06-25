import { describe, it, expect } from "vitest";
import {
  emptyParty,
  splitParties,
  validateParties,
  buildPartyRows,
  isValidNid,
  type Party,
} from "../loanParties";

const mk = (over: Partial<Party>): Party => ({ ...emptyParty(), ...over });

describe("loanParties.isValidNid", () => {
  it("accepts 10, 13 and 17 digit NIDs", () => {
    expect(isValidNid("1234567890")).toBe(true);
    expect(isValidNid("1234567890123")).toBe(true);
    expect(isValidNid("12345678901234567")).toBe(true);
  });
  it("rejects wrong lengths and non-digits", () => {
    expect(isValidNid("123")).toBe(false);
    expect(isValidNid("12345678901")).toBe(false);
    expect(isValidNid("12345abcde")).toBe(false);
  });
});

describe("loanParties.splitParties (load)", () => {
  it("splits guarantors and nominees and round-trips fields", () => {
    const { guarantors, nominees } = splitParties([
      { name: "G1", nid: "1234567890", role: "guarantor", mobile: "017" },
      { name: "N1", role: "nominee", village: "Vill" },
      { name: "G2", role: null }, // null role defaults to guarantor
    ]);
    expect(guarantors.map((g) => g.name)).toEqual(["G1", "G2"]);
    expect(nominees.map((n) => n.name)).toEqual(["N1"]);
    expect(guarantors[0].mobile).toBe("017");
    expect(nominees[0].village).toBe("Vill");
  });
  it("handles empty/undefined", () => {
    expect(splitParties(undefined)).toEqual({ guarantors: [], nominees: [] });
  });
});

describe("loanParties.validateParties", () => {
  it("passes for valid multiple combinations", () => {
    expect(
      validateParties([
        mk({ name: "A", nid: "1234567890" }),
        mk({ name: "B", nid: "1234567890123" }),
      ]),
    ).toEqual([]);
  });
  it("skips fully empty rows", () => {
    expect(validateParties([emptyParty(), emptyParty()])).toEqual([]);
  });
  it("flags empty name when other fields present", () => {
    const errs = validateParties([mk({ nid: "1234567890" })]);
    expect(errs).toContainEqual({ index: 0, field: "name", code: "empty" });
  });
  it("flags invalid NID", () => {
    const errs = validateParties([mk({ name: "A", nid: "12" })]);
    expect(errs).toContainEqual({ index: 0, field: "nid", code: "invalid_nid" });
  });
  it("flags duplicate name+nid on later occurrence", () => {
    const errs = validateParties([
      mk({ name: "Dup", nid: "1234567890" }),
      mk({ name: "Dup", nid: "1234567890" }),
    ]);
    expect(errs).toContainEqual({ index: 1, field: "name", code: "duplicate" });
    expect(errs.filter((e) => e.code === "duplicate")).toHaveLength(1);
  });
  it("does NOT treat same name with different NID as duplicate", () => {
    const errs = validateParties([
      mk({ name: "Same", nid: "1234567890" }),
      mk({ name: "Same", nid: "1234567890123" }),
    ]);
    expect(errs.filter((e) => e.code === "duplicate")).toHaveLength(0);
  });
});

describe("loanParties.buildPartyRows (save)", () => {
  it("builds rows for multiple guarantors + nominees with roles and office", () => {
    const rows = buildPartyRows(
      "loan-1",
      [mk({ name: "G1", nid: "1234567890" }), mk({ name: "G2" })],
      [mk({ name: "N1", mobile: "018" })],
      "office-9",
    );
    expect(rows).toHaveLength(3);
    expect(rows.filter((r) => r.role === "guarantor")).toHaveLength(2);
    expect(rows.filter((r) => r.role === "nominee")).toHaveLength(1);
    expect(rows.every((r) => r.loan_id === "loan-1" && r.office_id === "office-9")).toBe(true);
    expect(rows[2].mobile).toBe("018");
  });
  it("drops rows without a name and nulls blank optional fields", () => {
    const rows = buildPartyRows("loan-1", [mk({ name: "" }), mk({ name: "Keep" })], [], null);
    expect(rows).toHaveLength(1);
    expect(rows[0].father_name).toBeNull();
    expect(rows[0].office_id).toBeNull();
  });

  it("save -> load round trip preserves grouping", () => {
    const rows = buildPartyRows(
      "loan-1",
      [mk({ name: "G1", nid: "1234567890" })],
      [mk({ name: "N1" }), mk({ name: "N2" })],
      null,
    );
    const { guarantors, nominees } = splitParties(rows);
    expect(guarantors.map((g) => g.name)).toEqual(["G1"]);
    expect(nominees.map((n) => n.name)).toEqual(["N1", "N2"]);
  });
});
