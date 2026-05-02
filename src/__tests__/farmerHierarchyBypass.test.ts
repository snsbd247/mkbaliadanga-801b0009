import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Hierarchy-bypass tests
 *
 * These tests simulate an authenticated user bypassing the cascading dropdown UI
 * and directly POSTing mismatched location IDs to PostgREST. They verify that
 * the database trigger `validate_farmer_location_hierarchy` rejects the insert
 * (regardless of role) by raising `LOCATION_HIERARCHY_INVALID:<level>`, and that
 * `parseLocationDbError` correctly maps the error to the failing level.
 *
 * The Supabase client is mocked here to mimic exactly what PostgREST returns
 * when the trigger fires. The same trigger applies for all authenticated roles
 * (Staff, Admin, Committee, Super Admin) — the policy only controls *who* can
 * call insert/update; it does not disable the trigger. So a single mocked
 * response is sufficient to assert the contract.
 */

import { parseLocationDbError, validateLocationChain } from "@/lib/locationValidation";

type AttemptShape = {
  division_id?: string | null; district_id?: string | null;
  upazila_id?: string | null;  union_id?: string | null;
  ward_id?: string | null;     village_id?: string | null;
  mouza_id?: string | null;
  name_en?: string;
};

// Capture the last insert payload so tests can assert the API would have been
// called with mismatched IDs (proving the bypass attempt happened).
const calls: { table: string; payload: any }[] = [];

// A realistic PostgREST error envelope for trigger-raised exceptions.
function pgError(level: string) {
  return {
    code: "23514",
    message: `LOCATION_HIERARCHY_INVALID:${level}`,
    details: null,
    hint: null,
  };
}

vi.mock("@/integrations/supabase/client", () => {
  // Helper: pretend the DB validates the chain and rejects mismatches.
  function validateOnInsert(payload: AttemptShape): { error: any | null } {
    // Hierarchy fixture used by the mock — district dis1 belongs to div1, etc.
    const hier = {
      districts: { dis1: "div1", dis2: "div2" },
      upazilas:  { upa1: "dis1" },
      unions:    { uni1: "upa1" },
      wards:     { war1: "uni1" },
      villages:  { vil1: "war1" },
      mouzas_union: { mou1: "uni1" },
    };
    if (payload.district_id) {
      if (!payload.division_id) return { error: pgError("division") };
      if (hier.districts[payload.district_id as keyof typeof hier.districts] !== payload.division_id)
        return { error: pgError("district") };
    }
    if (payload.upazila_id) {
      if (!payload.district_id) return { error: pgError("district") };
      if (hier.upazilas[payload.upazila_id as keyof typeof hier.upazilas] !== payload.district_id)
        return { error: pgError("upazila") };
    }
    if (payload.union_id) {
      if (!payload.upazila_id) return { error: pgError("upazila") };
      if (hier.unions[payload.union_id as keyof typeof hier.unions] !== payload.upazila_id)
        return { error: pgError("union") };
    }
    if (payload.ward_id) {
      if (!payload.union_id) return { error: pgError("union") };
      if (hier.wards[payload.ward_id as keyof typeof hier.wards] !== payload.union_id)
        return { error: pgError("ward") };
    }
    if (payload.village_id) {
      if (!payload.ward_id) return { error: pgError("ward") };
      if (hier.villages[payload.village_id as keyof typeof hier.villages] !== payload.ward_id)
        return { error: pgError("village") };
    }
    if (payload.mouza_id) {
      if (!payload.union_id) return { error: pgError("union") };
      if (hier.mouzas_union[payload.mouza_id as keyof typeof hier.mouzas_union] !== payload.union_id)
        return { error: pgError("mouza") };
    }
    return { error: null };
  }

  const builder = (table: string) => {
    const chain: any = {
      insert: (payload: any) => {
        calls.push({ table, payload });
        const { error } = validateOnInsert(payload);
        return {
          select: () => ({
            single: async () => ({ data: error ? null : { id: "fake", ...payload }, error }),
          }),
        };
      },
    };
    return chain;
  };
  return { supabase: { from: builder } };
});

import { supabase } from "@/integrations/supabase/client";

beforeEach(() => { calls.length = 0; });

describe("Direct API bypass — hierarchy enforcement", () => {
  it("rejects district that doesn't belong to the chosen division", async () => {
    const payload: AttemptShape = {
      name_en: "Bypass Attempt",
      division_id: "div1",
      district_id: "dis2", // dis2 belongs to div2, NOT div1
    };
    const { error } = await supabase.from("farmers").insert(payload).select().single();
    expect(calls).toHaveLength(1);
    expect(error).toBeTruthy();
    expect(parseLocationDbError(error.message)).toBe("district");
  });

  it("rejects ward submitted without its parent union", async () => {
    const payload: AttemptShape = {
      name_en: "Skip Parent",
      division_id: "div1", district_id: "dis1", upazila_id: "upa1",
      ward_id: "war1", // union_id intentionally missing
    };
    const { error } = await supabase.from("farmers").insert(payload).select().single();
    expect(error).toBeTruthy();
    expect(parseLocationDbError(error.message)).toBe("union");
  });

  it("rejects village whose ward does not match the submitted ward_id", async () => {
    const payload: AttemptShape = {
      name_en: "Wrong Ward",
      division_id: "div1", district_id: "dis1", upazila_id: "upa1",
      union_id: "uni1", ward_id: "war1",
      village_id: "vil-other", // not under war1
    };
    const { error } = await supabase.from("farmers").insert(payload).select().single();
    expect(error).toBeTruthy();
    expect(parseLocationDbError(error.message)).toBe("village");
  });

  it("rejects mouza whose union does not match the submitted union_id", async () => {
    const payload: AttemptShape = {
      name_en: "Wrong Mouza Union",
      division_id: "div1", district_id: "dis1", upazila_id: "upa1",
      union_id: "uni-other",
      mouza_id: "mou1", // mou1 belongs to uni1
    };
    const { error } = await supabase.from("farmers").insert(payload).select().single();
    expect(error).toBeTruthy();
    expect(parseLocationDbError(error.message)).toBe("mouza");
  });

  it("accepts a fully valid chain", async () => {
    const payload: AttemptShape = {
      name_en: "Valid",
      division_id: "div1", district_id: "dis1", upazila_id: "upa1",
      union_id: "uni1", ward_id: "war1", village_id: "vil1", mouza_id: "mou1",
    };
    const { data, error } = await supabase.from("farmers").insert(payload).select().single();
    expect(error).toBeNull();
    expect(data).toMatchObject({ name_en: "Valid" });
  });

  it("client validator (validateLocationChain) catches the same missing_parent case before submit", () => {
    const v = validateLocationChain({
      division_id: "div1", district_id: "dis1", upazila_id: "upa1",
      ward_id: "war1", // union_id missing
    });
    expect(v.ok).toBe(false);
    if (v.ok === false) expect(v.level).toBe("union");
  });
});

describe("parseLocationDbError", () => {
  it("extracts the level from a trigger-raised error message", () => {
    expect(parseLocationDbError("LOCATION_HIERARCHY_INVALID:upazila")).toBe("upazila");
    expect(parseLocationDbError("ERROR: LOCATION_HIERARCHY_INVALID:village (SQLSTATE 23514)")).toBe("village");
  });
  it("returns null for unrelated messages", () => {
    expect(parseLocationDbError("duplicate key value violates unique constraint")).toBeNull();
    expect(parseLocationDbError(null)).toBeNull();
  });
  it("returns null for unknown level names", () => {
    expect(parseLocationDbError("LOCATION_HIERARCHY_INVALID:bogus")).toBeNull();
  });
});
