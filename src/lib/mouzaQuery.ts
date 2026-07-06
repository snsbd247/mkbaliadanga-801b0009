import { db } from "@/lib/db";
/**
 * Shared Mouza relation helpers.
 *
 * Single source of truth for how every module embeds and resolves the
 * `lands -> mouzas` relation. Use these instead of hand-writing
 * `lands(..., mouzas(name))` selects so embeds never drift between modules.
 *
 * A real FK (`lands_mouza_id_fkey`) backs the embed; `mouzas(name)` only
 * resolves through PostgREST when that FK exists. `resolveMouzaName` keeps a
 * text fallback (`lands.mouza`) so legacy rows without `mouza_id` still render.
 *
 * The Laravel/MySQL gateway does not support the `mouzas(name)` embed, but the
 * `db` adapter strips unsupported embeds automatically (see sanitizeEmbedSelect),
 * so callers can use one embed string for both backends with no conditional logic.
 */

/** Embed fragment for selecting a land row together with its mouza name. */
export const LAND_MOUZA_FIELDS = "dag_no,land_size,mouza,mouzas(name)";

/** Full `lands(...)` embed for invoice/payment queries. */
export const LANDS_EMBED = `lands(${LAND_MOUZA_FIELDS})`;

type MouzaRelation = { name?: string | null } | { name?: string | null }[] | null | undefined;

export type LandLike = {
  mouza?: string | null;
  mouzas?: MouzaRelation;
} | null | undefined;

export type RowWithLand = { lands?: LandLike } | null | undefined;

/** Normalize the embedded mouza relation (object or array form) to a name. */
function relationName(rel: MouzaRelation): string {
  if (!rel) return "";
  const obj = Array.isArray(rel) ? rel[0] : rel;
  return (obj?.name ?? "").toString().trim();
}

/** Resolve a mouza name from a land row, preferring the joined relation. */
export function resolveMouzaName(land: LandLike): string {
  if (!land) return "";
  return relationName(land.mouzas) || (land.mouza ?? "").toString().trim();
}

/** Resolve a mouza name from a row that embeds a land (e.g. invoices/payments). */
export function resolveRowMouzaName(row: RowWithLand): string {
  return resolveMouzaName(row?.lands);
}

/** True when a row matches the selected mouza filter ("all" matches everything). */
export function rowMatchesMouza(row: RowWithLand, filter: string): boolean {
  if (!filter || filter === "all") return true;
  return resolveRowMouzaName(row) === filter;
}

/** Build a sorted, de-duplicated list of mouza names from rows. */
export function buildMouzaOptions<T>(rows: T[], accessor: (row: T) => string): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    const name = accessor(r);
    if (name) set.add(name);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "bn"));
}

export type MouzaFkVerification = {
  ok: boolean;
  fkExists: boolean;
  orphanCount: number;
  reason?: string;
};

/**
 * Verify the `lands.mouza_id -> mouzas.id` FK exists and no orphan land rows
 * reference a missing mouza. Call before relying on `mouzas(name)` filters.
 * Accepts the supabase client; safe to no-op if RPCs are unavailable.
 */
export async function verifyMouzaRelation(
  supabase: { from: (t: string) => any }
): Promise<MouzaFkVerification> {
  try {
    // Embed probe: if the FK is missing, PostgREST rejects the mouzas(name) embed.
    const { error: embedError } = await db
      .from("lands")
      .select("id, mouzas(name)")
      .limit(1);
    const fkExists = !embedError;

    // Orphan probe: land rows whose mouza_id has no matching mouza.
    const { data: orphans, error: orphanError } = await db
      .from("lands")
      .select("id, mouza_id, mouzas(id)")
      .not("mouza_id", "is", null)
      .is("deleted_at", null);

    let orphanCount = 0;
    if (!orphanError && Array.isArray(orphans)) {
      orphanCount = orphans.filter((r: any) => !r.mouzas).length;
    }

    return {
      ok: fkExists && orphanCount === 0,
      fkExists,
      orphanCount,
      reason: !fkExists ? "missing_fk" : orphanCount > 0 ? "orphan_lands" : undefined,
    };
  } catch (e: any) {
    return { ok: false, fkExists: false, orphanCount: -1, reason: e?.message ?? "error" };
  }
}
