import type { LocationValue } from "@/components/locations/LocationPicker";

export type LocationLevel =
  | "division" | "district" | "upazila" | "union" | "ward" | "village" | "mouza";

export type LocationValidation =
  | { ok: true }
  | { ok: false; level: LocationLevel; reason: "missing_parent" | "mismatch" };

/** Mirror of the DB trigger — validates the chain client-side for instant feedback. */
export function validateLocationChain(v: LocationValue): LocationValidation {
  // If a child is selected, every ancestor must also be selected.
  const order: { level: LocationLevel; id?: string | null; parents: LocationLevel[] }[] = [
    { level: "division", id: v.division_id, parents: [] },
    { level: "district", id: v.district_id, parents: ["division"] },
    { level: "upazila",  id: v.upazila_id,  parents: ["division", "district"] },
    { level: "union",    id: v.union_id,    parents: ["division", "district", "upazila"] },
    { level: "ward",     id: v.ward_id,     parents: ["division", "district", "upazila", "union"] },
    { level: "village",  id: v.village_id,  parents: ["division", "district", "upazila", "union", "ward"] },
    { level: "mouza",    id: v.mouza_id,    parents: ["division", "district", "upazila", "union", "ward", "village"] },
  ];
  const idMap: Record<LocationLevel, string | null | undefined> = {
    division: v.division_id, district: v.district_id, upazila: v.upazila_id,
    union: v.union_id, ward: v.ward_id, village: v.village_id, mouza: v.mouza_id,
  };
  for (const step of order) {
    if (!step.id) continue;
    for (const p of step.parents) {
      if (!idMap[p]) return { ok: false, level: p, reason: "missing_parent" };
    }
  }
  return { ok: true };
}

/** Parses Postgres errors raised by the validate_farmer_location_hierarchy trigger. */
export function parseLocationDbError(message?: string | null): LocationLevel | null {
  if (!message) return null;
  const m = /LOCATION_HIERARCHY_INVALID:(\w+)/.exec(message);
  if (!m) return null;
  const lvl = m[1] as LocationLevel;
  const valid: LocationLevel[] = ["division","district","upazila","union","ward","village","mouza"];
  return valid.includes(lvl) ? lvl : null;
}
