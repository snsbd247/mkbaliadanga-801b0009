import { db } from "@/lib/db";
import { resolveFieldTypeLabel } from "@/lib/irrigationLandType";
import { normalizeIrrigationRatePerAcre } from "@/lib/bnReceipts";

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

export const IRRIGATION_INVOICE_SELECT =
  "id,invoice_no,payable_amount,paid_amount,due_amount,discount_amount,discount_reason,irrigation_amount,maintenance_amount,canal_amount,delay_fee,other_charge,is_borga,land_id,note,due_date,season_rate,land_type_name,irrigation_category_name,seasons(name,year,status),lands(mouza,dag_no,land_size,field_type,owner_type,owner_farmer_id,notes,patwaris(name,name_bn,mobile),owner:farmers!lands_owner_farmer_id_fkey(name_bn,name_en,member_no,farmer_code))";

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
  land_owner_label: string | null;
  current_season_charge: number;
  penalty_amount: number;
  maintenance_charge: number;
  canal_charge: number;
  total_outstanding: number;
  collected_from_outstanding: number;
  remark: string | null;
  holding_description: string | null;
  patwari_name: string | null;
  patwari_mobile: string | null;
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
  const patwari = invoiceRows.find((inv) => inv?.lands?.patwaris)?.lands?.patwaris ?? null;
  const holdingDescription =
    [
      ...Array.from(
        new Set(invoiceRows.map((inv) => inv?.lands?.notes?.trim()).filter(Boolean)),
      ),
      paymentNote?.trim() || null,
    ]
      .filter(Boolean)
      .join(" / ") || null;

  dbg("resolved fields", {
    mouza,
    dagNo,
    landSize,
    fieldTypeBn,
    ratePerAcre,
    billInfo,
    patwari: patwari?.name_bn || patwari?.name || null,
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
    total_outstanding: totalOutstanding,
    collected_from_outstanding: collectedFromOutstanding || Number(paymentAmount || 0),
    remark: paymentNote ?? primaryCharge?.invoice_no ?? null,
    holding_description: holdingDescription,
    patwari_name: patwari ? patwari.name_bn || patwari.name : null,
    patwari_mobile: patwari?.mobile ?? null,
  };
}
