// Pure helpers describing how a Lands-import row maps to DB records, so the
// same logic drives (1) the dry-run preview, (2) owner_type validation, and
// (3) reclassification of previously mis-imported records — and can be unit tested.

export const BORGA_TOKENS = ["borga", "borgadar", "বর্গা", "বর্গাদার", "share", "sharecrop"];
export const OWN_TOKENS = ["own", "owner", "নিজে", "মালিক"];

/** True when an owner_type value means the land is share-cropped (borga). */
export function isBorgaOwnerType(v: unknown): boolean {
  return BORGA_TOKENS.includes(String(v ?? "").trim().toLowerCase());
}

/** True when an owner_type value clearly means the owner cultivates it. */
export function isOwnOwnerType(v: unknown): boolean {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "" || OWN_TOKENS.includes(s);
}

/**
 * Validate the owner_type cell. Returns a detailed, bilingual-ready message
 * when the value is unrecognised (neither own nor borga). Empty = own (ok).
 */
export function validateOwnerType(v: unknown): { ok: boolean; recognized: "own" | "borga" | "unknown"; message?: string } {
  if (isBorgaOwnerType(v)) return { ok: true, recognized: "borga" };
  if (isOwnOwnerType(v)) return { ok: true, recognized: "own" };
  return {
    ok: false,
    recognized: "unknown",
    message: `owner_type: চেনা যায়নি (${String(v ?? "")}) — শুধু own/borga গ্রহণযোগ্য`,
  };
}

export type ImportRowMappingInput = {
  owner_farmer_id?: unknown;
  owner_type?: unknown;
  sharecropper_id?: unknown;
  land_size?: unknown;
  borga_area?: unknown;
  share_percentage?: unknown;
};

export type ImportRowMapping = {
  /** owner_type persisted on the land record — ALWAYS "owner" (borga is a relation, never a land flag). */
  landOwnerType: "owner";
  /** Which farmer cultivates + appears in which tab. */
  ownerTab: "Own Land" | "Land";
  /** True when a land_relations (borga) record is also created. */
  createsBorgaRelation: boolean;
  /** Short bilingual description of what the row will produce. */
  summary: { en: string; bn: string };
};

/**
 * Describe exactly what a single import row will create, so the preview can
 * show Owner vs Borga mapping before saving.
 *
 * Invariant: the land record's owner_type is ALWAYS "owner". A borga row does
 * NOT flip the land to borgadar — it keeps the owner's land as owner-owned and
 * additionally records a sharecropper relation. This is what keeps borga-given
 * land in the owner's "Own Land" tab rather than the "Land" (borga-in) tab.
 */
export function classifyImportRow(row: ImportRowMappingInput): ImportRowMapping {
  const borga = isBorgaOwnerType(row.owner_type);
  const owner = String(row.owner_farmer_id ?? "").trim() || "?";
  const sc = String(row.sharecropper_id ?? "").trim() || "?";
  if (borga) {
    return {
      landOwnerType: "owner",
      ownerTab: "Own Land",
      createsBorgaRelation: true,
      summary: {
        en: `Land stays with owner ${owner} (Own Land); sharecropper ${sc} added via relation`,
        bn: `জমি মালিক ${owner}-এর (Own Land) থাকবে; বর্গাদার ${sc} সম্পর্ক হিসেবে যোগ হবে`,
      },
    };
  }
  return {
    landOwnerType: "owner",
    ownerTab: "Own Land",
    createsBorgaRelation: false,
    summary: {
      en: `Owner-cultivated land for ${owner} (Own Land)`,
      bn: `মালিক ${owner}-এর নিজ চাষের জমি (Own Land)`,
    },
  };
}

/**
 * Given an existing land record, decide whether its owner_type was mis-imported
 * and needs reclassification. Any land that has an active borga relation OR was
 * created from an owner row must be owner_type="owner". Returns the corrected
 * value when a change is needed, else null.
 */
export function reclassifyLandOwnerType(land: { owner_type?: unknown }): "owner" | null {
  const current = String(land.owner_type ?? "").trim().toLowerCase();
  // Every land record produced by the import must be owner-owned.
  if (isBorgaOwnerType(current)) return "owner";
  return null;
}
