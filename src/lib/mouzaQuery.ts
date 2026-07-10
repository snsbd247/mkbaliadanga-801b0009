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
export const LAND_MOUZA_FIELDS = "dag_no,land_size,mouza,notes,mouzas(name_bn,name)";

/** Full `lands(...)` embed for invoice/payment queries. */
export const LANDS_EMBED = `lands(${LAND_MOUZA_FIELDS})`;

type MouzaObj = { name?: string | null; name_bn?: string | null };
type MouzaRelation = MouzaObj | MouzaObj[] | null | undefined;

export type LandLike = {
  id?: string | null;
  mouza_id?: string | null;
  farmer_id?: string | null;
  mouza?: string | null;
  mouzas?: MouzaRelation;
} | null | undefined;

export type RowWithLand = { lands?: LandLike } | null | undefined;

/** Normalize the embedded mouza relation (object or array form) to a name. */
function relationName(rel: MouzaRelation): string {
  if (!rel) return "";
  const obj = Array.isArray(rel) ? rel[0] : rel;
  return ((obj?.name_bn ?? "") || (obj?.name ?? "")).toString().trim();
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

/**
 * All name variants (name_bn, name, text fallback) for a land row.
 * Used for filtering, since a MouzaSelect may emit the English `name` while
 * display uses `name_bn` — matching on any variant keeps them in sync.
 */
export function resolveMouzaAllNames(land: LandLike): string[] {
  if (!land) return [];
  const rel = land.mouzas;
  const obj = Array.isArray(rel) ? rel[0] : rel;
  const names = [obj?.name_bn, obj?.name, land.mouza]
    .map((n) => (n ?? "").toString().trim())
    .filter(Boolean);
  return Array.from(new Set(names));
}

/** True when any name variant matches the filter (case-insensitive substring). */
export function namesMatchMouza(names: string[], filter: string): boolean {
  if (!filter || filter === "all") return true;
  const f = filter.trim().toLowerCase();
  return names.some((n) => n.toLowerCase().includes(f));
}

export type PaymentLikeForMouza = {
  id: string;
  kind?: string | null;
  farmer_id?: string | null;
  reference_id?: string | null;
};

export type PaymentMouzaResolution = {
  paymentId: string;
  name: string;
  variants: string[];
  mouzaId: string | null;
  source: "invoice-payment" | "reference-invoice" | "farmer-invoice" | "farmer-land";
};

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(values.map((v) => (v ?? "").toString().trim()).filter(Boolean)),
  );
}

function attachMouzaRelation(land: any, mouzaById: Record<string, MouzaObj>): LandLike {
  if (!land) return null;
  return {
    ...land,
    mouzas: land.mouza_id ? mouzaById[land.mouza_id] ?? null : null,
  };
}

function resolveFromLands(
  lands: LandLike[],
  source: PaymentMouzaResolution["source"],
  paymentId: string,
): PaymentMouzaResolution | null {
  const usable = lands.filter((land) => resolveMouzaAllNames(land).length > 0);
  if (!usable.length) return null;
  const names = uniqueStrings(usable.map((land) => resolveMouzaName(land)));
  const variants = uniqueStrings(usable.flatMap((land) => resolveMouzaAllNames(land)));
  const mouzaId = usable.find((land) => land?.mouza_id)?.mouza_id ?? null;
  return { paymentId, name: names.join(", "), variants, mouzaId, source };
}

async function fetchMouzasById(ids: string[]): Promise<Record<string, MouzaObj>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (!unique.length) return {};
  const { data } = await db.from("mouzas").select("id,name,name_bn").in("id", unique);
  const out: Record<string, MouzaObj> = {};
  for (const row of data ?? []) out[(row as any).id] = row as MouzaObj;
  return out;
}

async function fetchLandsById(ids: string[]): Promise<Record<string, LandLike>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (!unique.length) return {};
  const { data: lands } = await db
    .from("lands")
    .select("id,farmer_id,mouza,mouza_id,created_at,deleted_at")
    .in("id", unique);
  const mouzaById = await fetchMouzasById(
    ((lands as any[]) ?? []).map((land) => land?.mouza_id).filter(Boolean),
  );
  const out: Record<string, LandLike> = {};
  for (const land of lands ?? []) out[(land as any).id] = attachMouzaRelation(land, mouzaById);
  return out;
}

async function fetchInvoicesById(ids: string[]): Promise<Record<string, any>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (!unique.length) return {};
  const { data } = await db
    .from("irrigation_invoices")
    .select("id,farmer_id,land_id,due_date,created_at,invoice_status,deleted_at")
    .in("id", unique);
  const out: Record<string, any> = {};
  for (const inv of data ?? []) out[(inv as any).id] = inv;
  return out;
}

/**
 * Resolve receipt-list/filter Mouzas with the same safe lookup style used by
 * receipt preview: payment→invoice links first, then farmer invoice fallback,
 * then nearest farmer land. This intentionally avoids nested-in-nested embeds
 * so the Lovable preview and VPS backend behave the same.
 */
export async function resolvePaymentMouzas(
  payments: PaymentLikeForMouza[],
): Promise<Record<string, PaymentMouzaResolution>> {
  const rows = payments.filter((p) => p?.id);
  const irrigationRows = rows.filter((p) => (p.kind ?? "") === "irrigation");
  const resolved: Record<string, PaymentMouzaResolution> = {};
  if (!irrigationRows.length) return resolved;

  const paymentIds = irrigationRows.map((p) => p.id);

  // Primary path: exact payment→invoice links.
  const { data: links } = await db
    .from("irrigation_invoice_payments")
    .select("payment_id,invoice_id")
    .in("payment_id", paymentIds);
  const invoiceIdsByPayment: Record<string, string[]> = {};
  for (const link of links ?? []) {
    const pid = (link as any).payment_id;
    const iid = (link as any).invoice_id;
    if (!pid || !iid) continue;
    (invoiceIdsByPayment[pid] ||= []).push(iid);
  }

  const exactInvoiceById = await fetchInvoicesById(
    Object.values(invoiceIdsByPayment).flat(),
  );
  const exactLandById = await fetchLandsById(
    Object.values(exactInvoiceById).map((inv: any) => inv?.land_id).filter(Boolean),
  );
  for (const payment of irrigationRows) {
    const lands = (invoiceIdsByPayment[payment.id] ?? [])
      .map((invoiceId) => exactInvoiceById[invoiceId]?.land_id)
      .filter(Boolean)
      .map((landId) => exactLandById[landId])
      .filter(Boolean) as LandLike[];
    const hit = resolveFromLands(lands, "invoice-payment", payment.id);
    if (hit) resolved[payment.id] = hit;
  }

  // Secondary path: some imported/legacy payments store the invoice in reference_id.
  const refIds = irrigationRows
    .filter((p) => !resolved[p.id] && p.reference_id)
    .map((p) => p.reference_id!)
    .filter(Boolean);
  if (refIds.length) {
    const refInvoiceById = await fetchInvoicesById(refIds);
    const refLandById = await fetchLandsById(
      Object.values(refInvoiceById).map((inv: any) => inv?.land_id).filter(Boolean),
    );
    for (const payment of irrigationRows) {
      if (resolved[payment.id] || !payment.reference_id) continue;
      const inv = refInvoiceById[payment.reference_id];
      const hit = resolveFromLands(
        inv?.land_id ? [refLandById[inv.land_id]].filter(Boolean) as LandLike[] : [],
        "reference-invoice",
        payment.id,
      );
      if (hit) resolved[payment.id] = hit;
    }
  }

  // Preview fallback: if a payment has no payment→invoice row, preview uses the
  // farmer's active invoices. Batch that same rule so list display/filter matches.
  const unresolvedAfterExact = irrigationRows.filter((p) => !resolved[p.id] && p.farmer_id);
  const farmerIds = Array.from(new Set(unresolvedAfterExact.map((p) => p.farmer_id!).filter(Boolean)));
  if (farmerIds.length) {
    const { data: farmerInvoices } = await db
      .from("irrigation_invoices")
      .select("id,farmer_id,land_id,due_date,created_at,invoice_status,deleted_at")
      .in("farmer_id", farmerIds)
      .is("deleted_at", null)
      .neq("invoice_status", "cancelled")
      .order("due_date", { ascending: true });
    const farmerLandById = await fetchLandsById(
      ((farmerInvoices as any[]) ?? []).map((inv) => inv?.land_id).filter(Boolean),
    );
    const landsByFarmer: Record<string, LandLike[]> = {};
    for (const inv of farmerInvoices ?? []) {
      const fid = (inv as any).farmer_id;
      const land = (inv as any).land_id ? farmerLandById[(inv as any).land_id] : null;
      if (fid && land) (landsByFarmer[fid] ||= []).push(land);
    }
    for (const payment of unresolvedAfterExact) {
      const hit = resolveFromLands(landsByFarmer[payment.farmer_id!] ?? [], "farmer-invoice", payment.id);
      if (hit) resolved[payment.id] = hit;
    }
  }

  // Last fallback: nearest land relation for the farmer, even if invoice links are absent.
  const stillUnresolved = irrigationRows.filter((p) => !resolved[p.id] && p.farmer_id);
  const fallbackFarmerIds = Array.from(new Set(stillUnresolved.map((p) => p.farmer_id!).filter(Boolean)));
  if (fallbackFarmerIds.length) {
    const { data: farmerLands } = await db
      .from("lands")
      .select("id,farmer_id,mouza,mouza_id,created_at,deleted_at")
      .in("farmer_id", fallbackFarmerIds)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    const mouzaById = await fetchMouzasById(
      ((farmerLands as any[]) ?? []).map((land) => land?.mouza_id).filter(Boolean),
    );
    const landsByFarmer: Record<string, LandLike[]> = {};
    for (const land of farmerLands ?? []) {
      const withMouza = attachMouzaRelation(land, mouzaById);
      const fid = (withMouza as any)?.farmer_id;
      if (fid) (landsByFarmer[fid] ||= []).push(withMouza);
    }
    for (const payment of stillUnresolved) {
      const hit = resolveFromLands(landsByFarmer[payment.farmer_id!] ?? [], "farmer-land", payment.id);
      if (hit) resolved[payment.id] = hit;
    }
  }

  return resolved;
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
