import { db } from "@/lib/db";
import { resolveFieldTypeLabel } from "@/lib/irrigationLandType";
import { normalizeIrrigationRatePerAcre } from "@/lib/bnReceipts";
import { joinNotes } from "@/lib/irrigationExports";

// Placeholders shown on the receipt when patwari data is missing, so the field
// is never silently blank.
export const PATWARI_NAME_MISSING = "পাটুয়ারী নির্ধারিত নেই";
export const PATWARI_MOBILE_MISSING = "মোবাইল নম্বর নেই";

export type PatwariSource = "land" | "mouza" | null;

export interface PatwariRow {
  name?: string | null;
  name_bn?: string | null;
  mobile?: string | null;
}

/**
 * Pure patwari resolver for irrigation receipts. Priority:
 *  1. Patwari explicitly selected on the land (`patwari_id`).
 *  2. Otherwise the patwari selected for the land's mouza (`mouza_id`).
 *  3. Otherwise none.
 * Returns the resolved row and which source it came from (for debug/indicator).
 */
export function resolveReceiptPatwari(
  land: { patwari_id?: string | null; mouza_id?: string | null } | null | undefined,
  patwariById: Record<string, PatwariRow>,
  patwariByMouza: Record<string, PatwariRow>,
): { patwari: PatwariRow | null; source: PatwariSource } {
  const byLand = land?.patwari_id ? patwariById[land.patwari_id] : null;
  if (byLand) return { patwari: byLand, source: "land" };
  const byMouza = land?.mouza_id ? patwariByMouza[land.mouza_id] : null;
  if (byMouza) return { patwari: byMouza, source: "mouza" };
  return { patwari: null, source: null };
}

/** Display name/mobile with explicit placeholder text when missing. */
export function patwariDisplay(patwari: PatwariRow | null): {
  name: string;
  mobile: string;
} {
  return {
    name: patwari ? patwari.name_bn || patwari.name || PATWARI_NAME_MISSING : PATWARI_NAME_MISSING,
    mobile: patwari?.mobile || PATWARI_MOBILE_MISSING,
  };
}

// Feature flag for tracing where receipt land/charge data comes from.
// Enable in the browser console with: localStorage.setItem("debug:receipt-data", "1")
export function isReceiptDataDebugEnabled(): boolean {
  try {
    return (
      typeof localStorage !== "undefined" &&
      localStorage.getItem("debug:receipt-data") === "1"
    );
  } catch {
    return false;
  }
}

function dbg(...args: unknown[]) {
  if (isReceiptDataDebugEnabled()) {
    // eslint-disable-next-line no-console
    console.log("[receipt-data]", ...args);
  }
}

const tx = (en: string, bn: string) => bn; // receipts are Bengali

// NOTE: We deliberately do NOT nest lands(...)/patwaris(...)/owner(...) embeds
// here. The self-hosted Laravel/MySQL gateway cannot resolve nested-in-nested
// embeds, which silently returned blank mouza/dag/land_size/patwari on the VPS
// build. Land + patwari + owner are fetched with separate queries below so both
// the Lovable Cloud and VPS backends produce identical receipt data.
export const IRRIGATION_INVOICE_SELECT =
  "id,invoice_no,farmer_id,payable_amount,paid_amount,due_amount,discount_amount,discount_reason,irrigation_amount,maintenance_amount,canal_amount,delay_fee,other_charge,is_borga,land_id,note,due_date,season_rate,land_type_name,irrigation_category_name,seasons(name,year,status)";

export interface IrrigationEnrichInput {
  farmerId: string | null;
  refIds?: string[];
  paymentAmount?: number;
  paymentNote?: string | null;
  memberNoFallback?: string | null;
}

export interface IrrigationEnriched {
  farmerExtras: {
    mouza: string | null;
    dag_no: string | null;
    land_size: number | null;
    field_type_bn: string | null;
    owner_type_bn: string;
  };
  bill_info: string;
  rate: number | null;
  member_summary: string;
  owner_self: boolean;
  cultivator_label: string | null;
  land_owner_label: string | null;
  current_season_charge: number;
  penalty_amount: number;
  maintenance_charge: number;
  canal_charge: number;
  discount_amount: number;
  total_outstanding: number;
  collected_from_outstanding: number;
  remark: string | null;
  holding_description: string | null;
  patwari_name: string | null;
  patwari_mobile: string | null;
  patwari_source: PatwariSource;
}

/**
 * Builds the irrigation receipt enrichment (mouza, dag, জমির ধরন, rate, charges,
 * outstanding, holding/patwari) from real invoice + land data.
 *
 * Shared by Payments re-print and DataImport sample receipt preview so both use
 * the exact same data source — no hard-coded or blank fields.
 */
export async function buildIrrigationReceiptEnrichment(
  input: IrrigationEnrichInput,
): Promise<IrrigationEnriched> {
  const { farmerId, refIds, paymentAmount, paymentNote, memberNoFallback } = input;

  const collectedFromOutstanding = Number(paymentAmount || 0);
  let invoiceRows: any[] = [];

  if (refIds && refIds.length) {
    const { data: invs } = await db
      .from("irrigation_invoices")
      .select(IRRIGATION_INVOICE_SELECT)
      .in("id", refIds);
    invoiceRows = invs ?? [];
    dbg("source=refIds", { refIds, found: invoiceRows.length });
  } else if (farmerId) {
    const { data: invs } = await db
      .from("irrigation_invoices")
      .select(IRRIGATION_INVOICE_SELECT)
      .eq("farmer_id", farmerId)
      .is("deleted_at", null)
      .neq("invoice_status", "cancelled")
      .order("due_date", { ascending: true });
    invoiceRows = invs ?? [];
    dbg("source=farmer_id fallback", { farmerId, found: invoiceRows.length });
  }

  // Attach land + patwari + owner via separate queries (works on both Cloud and
  // the self-hosted Laravel backend, which cannot resolve nested-in-nested embeds).
  const landIds = Array.from(
    new Set(invoiceRows.map((inv) => inv?.land_id).filter(Boolean)),
  ) as string[];
  if (landIds.length) {
    const { data: landRows } = await db
      .from("lands")
      .select("id,mouza,mouza_id,dag_no,land_size,field_type,owner_type,owner_farmer_id,patwari_id,notes")
      .in("id", landIds);
    const lands = landRows ?? [];

    const patwariIds = Array.from(
      new Set(lands.map((l: any) => l?.patwari_id).filter(Boolean)),
    ) as string[];
    const patwariById: Record<string, any> = {};
    if (patwariIds.length) {
      const { data: patwariRows } = await db
        .from("patwaris")
        .select("id,name,name_bn,mobile")
        .in("id", patwariIds);
      for (const p of patwariRows ?? []) patwariById[(p as any).id] = p;
    }

    // Fallback: for lands without an explicit patwari_id, use the patwari
    // assigned to the land's mouza (patwaris.mouza_id).
    const mouzaIdsNeedingPatwari = Array.from(
      new Set(
        lands
          .filter((l: any) => !l?.patwari_id && l?.mouza_id)
          .map((l: any) => l.mouza_id),
      ),
    ) as string[];
    const patwariByMouza: Record<string, any> = {};
    if (mouzaIdsNeedingPatwari.length) {
      const { data: mouzaPatwariRows } = await db
        .from("patwaris")
        .select("id,name,name_bn,mobile,mouza_id,is_active")
        .in("mouza_id", mouzaIdsNeedingPatwari);
      for (const p of mouzaPatwariRows ?? []) {
        const mid = (p as any).mouza_id;
        // Prefer an active patwari; keep the first match otherwise.
        if (!patwariByMouza[mid] || (p as any).is_active) {
          patwariByMouza[mid] = p;
        }
      }
    }


    const ownerIds = Array.from(
      new Set(lands.map((l: any) => l?.owner_farmer_id).filter(Boolean)),
    ) as string[];
    const ownerById: Record<string, any> = {};
    if (ownerIds.length) {
      const { data: ownerRows } = await db
        .from("farmers")
        .select("id,name_bn,name_en,member_no,farmer_code")
        .in("id", ownerIds);
      for (const o of ownerRows ?? []) ownerById[(o as any).id] = o;
    }

    const landById: Record<string, any> = {};
    for (const l of lands) {
      const { patwari, source } = resolveReceiptPatwari(l as any, patwariById, patwariByMouza);
      landById[(l as any).id] = {
        ...(l as any),
        patwaris: patwari,
        patwari_source: source,
        owner: (l as any).owner_farmer_id ? ownerById[(l as any).owner_farmer_id] ?? null : null,
      };
    }
    for (const inv of invoiceRows) {
      inv.lands = inv?.land_id ? landById[inv.land_id] ?? null : null;
    }
  }

  const primaryCharge = invoiceRows[0] ?? null;
  dbg("primary invoice", primaryCharge?.invoice_no, "land_id", primaryCharge?.land_id);

  let totalOutstanding = 0;
  if (farmerId) {
    const { data: allDues } = await db
      .from("irrigation_invoices")
      .select("due_amount")
      .eq("farmer_id", farmerId)
      .is("deleted_at", null)
      .neq("invoice_status", "cancelled");
    totalOutstanding = (allDues ?? []).reduce(
      (s: number, r: any) => s + Number(r.due_amount || 0),
      0,
    );
  }

  const anyBorga = invoiceRows.some((inv) => !!inv?.is_borga);
  const ownerInvoice =
    invoiceRows.find((inv) => inv?.is_borga && inv?.lands?.owner) ?? primaryCharge;
  const ownerFarmer = ownerInvoice?.lands?.owner;
  const isSelf = !anyBorga;

  const fieldTypeBn =
    Array.from(
      new Set(
        invoiceRows
          .map((inv) =>
            resolveFieldTypeLabel({
              categoryName: inv?.irrigation_category_name,
              landTypeName: inv?.land_type_name,
              seasonName: inv?.seasons?.name,
            }) ||
            (({
              high_land: tx("High land", "উঁচু জমি"),
              medium_land: tx("Medium land", "মাঝারি জমি"),
              low_land: tx("Low land", "নিচু জমি"),
              other: tx("Other", "অন্যান্য"),
            } as Record<string, string>)[inv?.lands?.field_type as string] ?? null),
          )
          .filter(Boolean),
      ),
    ).join("/") || null;

  const ratePerAcre = normalizeIrrigationRatePerAcre(
    primaryCharge?.season_rate,
    primaryCharge?.irrigation_amount,
    primaryCharge?.lands?.land_size,
  );
  const ownerMember = ownerFarmer?.member_no || ownerFarmer?.farmer_code || null;
  const memberSummary = `${memberNoFallback ?? "N/A"}/${
    anyBorga && ownerMember ? ownerMember : "N/A"
  }`;
  const mouza = invoiceRows.find((inv) => inv?.lands?.mouza)?.lands?.mouza ?? null;
  const dagNo =
    Array.from(
      new Set(
        invoiceRows
          .map((inv) => (inv?.lands?.dag_no ?? "").trim())
          .filter(Boolean)
          .flatMap((s: string) => s.split(/[,;\s]+/))
          .filter(Boolean),
      ),
    ).join(", ") || null;
  const landSize =
    invoiceRows.reduce((s, inv) => s + Number(inv?.lands?.land_size || 0), 0) || null;
  const billInfo =
    Array.from(
      new Set(
        invoiceRows
          .map(
            (inv) =>
              inv?.seasons?.name ||
              inv?.irrigation_category_name ||
              inv?.land_type_name ||
              null,
          )
          .filter(Boolean),
      ),
    ).join("/") || "সেচ চার্জ";
  const patwariInv = invoiceRows.find((inv) => inv?.lands?.patwaris) ?? null;
  const patwari = patwariInv?.lands?.patwaris ?? null;
  const patwariSource: PatwariSource = patwari ? patwariInv?.lands?.patwari_source ?? null : null;
  const patwariDisp = patwariDisplay(patwari);
  const landNotes = joinNotes(
    ...invoiceRows.map((inv) => (inv?.lands?.notes ?? "").trim()),
  );
  const holdingDescription = joinNotes(landNotes, paymentNote?.trim()) || null;

  dbg("resolved fields", {
    mouza,
    dagNo,
    landSize,
    fieldTypeBn,
    ratePerAcre,
    billInfo,
    patwari: patwari?.name_bn || patwari?.name || null,
    patwariSource,
    holdingDescription,
  });

  return {
    farmerExtras: {
      mouza,
      dag_no: dagNo,
      land_size: landSize,
      field_type_bn: fieldTypeBn,
      owner_type_bn: anyBorga ? "বর্গাদার" : "মালিক",
    },
    bill_info: billInfo,
    rate: ratePerAcre,
    member_summary: memberSummary,
    owner_self: isSelf,
    land_owner_label: isSelf
      ? "নিজ"
      : ownerFarmer
        ? `${ownerFarmer.name_bn || ownerFarmer.name_en}${
            ownerMember ? "-" + ownerMember : ""
          }`
        : null,
    current_season_charge: invoiceRows.reduce(
      (s, inv) => s + Number(inv?.irrigation_amount || 0),
      0,
    ),
    penalty_amount: invoiceRows.reduce((s, inv) => s + Number(inv?.delay_fee || 0), 0),
    maintenance_charge: invoiceRows.reduce(
      (s, inv) => s + Number(inv?.maintenance_amount || 0),
      0,
    ),
    canal_charge: invoiceRows.reduce((s, inv) => s + Number(inv?.canal_amount || 0), 0),
    discount_amount: invoiceRows.reduce((s, inv) => s + Number(inv?.discount_amount || 0), 0),
    total_outstanding: totalOutstanding,
    collected_from_outstanding: collectedFromOutstanding || Number(paymentAmount || 0),
    remark: paymentNote ?? primaryCharge?.invoice_no ?? null,
    holding_description: holdingDescription,
    patwari_name: patwariDisp.name,
    patwari_mobile: patwariDisp.mobile,
    patwari_source: patwariSource,
  };
}
