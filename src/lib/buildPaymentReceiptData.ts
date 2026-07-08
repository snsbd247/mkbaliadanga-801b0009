import { db } from "@/lib/db";
import { autoReceiptNo } from "@/lib/receiptNo";
import { buildIrrigationReceiptEnrichment } from "@/lib/irrigationReceiptData";
import type { BnReceiptData } from "@/lib/bnReceipts";

type Tx = (en: string, bn: string) => string;

export type ReceiptBuildContext = {
  brand: { company_name: string; company_name_bn?: string | null; logo_url?: string | null };
  receiptArgs: { org: any; signatureUrl: string | null; options: any };
  tx: Tx;
};

/**
 * Build the Bangla receipt payload for a payment row. Shared by the Payments
 * page and the dedicated Receipts page so the printed / previewed receipt is
 * identical everywhere.
 */
export async function buildPaymentReceiptData(p: any, ctx: ReceiptBuildContext): Promise<BnReceiptData> {
  const { brand, receiptArgs, tx } = ctx;
  const k = (p.kind as string) || "savings";
  const kind = (k === "loan" ? "loan" : k === "irrigation" ? "irrigation" : "savings") as "loan" | "irrigation" | "savings";
  const prefix = kind === "loan" ? "LOAN" : kind === "irrigation" ? "IRR" : "SAV";
  const description = p.note
    ?? (kind === "loan" ? tx("Loan installment received", "ঋণের কিস্তি গ্রহণ")
      : kind === "savings" ? tx("Savings deposit received", "সঞ্চয় জমা গ্রহণ")
        : tx("Irrigation charge received", "সেচ চার্জ গ্রহণ"));

  const memberTypeBn = (f: any) => (f?.is_voter ? "ভোটার নং" : f?.account_number ? "সঞ্চয়ী নং" : null);
  const memberRefNo = (f: any) => f?.voter_number ?? f?.account_number ?? null;

  let irrEnriched: any = {};
  if (kind === "irrigation") {
    const irrAllocs = (p.payment_allocations ?? []).filter((a: any) => a.kind === "irrigation");
    const refIds = irrAllocs.map((a: any) => a.reference_id).filter(Boolean);
    const collectedFromOutstanding = irrAllocs.reduce((s: number, a: any) => s + Number(a.amount || 0), 0) || Number(p.amount || 0);
    irrEnriched = await buildIrrigationReceiptEnrichment({
      farmerId: p.farmer_id ?? null,
      refIds,
      paymentAmount: collectedFromOutstanding,
      paymentNote: p.note ?? null,
      memberNoFallback: p.farmers?.member_no ?? p.farmers?.farmer_code ?? null,
      manualPatwariId: p.patwari_id ?? null,
      manualPatwari: p.patwaris ?? null,
    });
  }

  const miscLabels: Record<string, string> = {
    hawlat: "হাওলাত গ্রহণ", bank: "ভাংড়ী বিক্রি", donation: "অনুদান", misc: "বিবিধ",
  };
  const catBn = miscLabels[(p.category as string) ?? ""] ?? null;
  const isMiscCollection = kind === "irrigation" && !!catBn;
  let villageUnion: string | null = null;
  if (kind === "irrigation" && p.farmers?.union_id) {
    const { data: u } = await db.from("unions").select("name_bn,name").eq("id", p.farmers.union_id).maybeSingle();
    villageUnion = u?.name_bn || u?.name || null;
  }

  const rd: BnReceiptData = {
    kind,
    company_name: brand.company_name,
    company_name_bn: brand.company_name_bn,
    logo_url: brand.logo_url ?? null,
    org: receiptArgs.org,
    receipt_no: p.receipt_no || autoReceiptNo(prefix as any, p.id, new Date(p.created_at)),
    date: p.created_at,
    misc_collection: isMiscCollection || undefined,
    bill_info: kind === "irrigation" ? (catBn ?? irrEnriched.bill_info ?? "সেচ চার্জ") : undefined,
    farmer: {
      name: p.farmers?.name_bn || p.farmers?.name_en || "—",
      member_no: p.farmers?.member_no ?? p.farmers?.farmer_code ?? null,
      mobile: p.farmers?.mobile ?? null,
      village: p.farmers?.village ?? null,
      father_or_husband: p.farmers?.father_name ?? null,
      member_type_bn: memberTypeBn(p.farmers),
      member_ref_no: memberRefNo(p.farmers),
      ...(irrEnriched.farmerExtras ?? {}),
    },
    ...(kind === "irrigation"
      ? {
          owner_self: irrEnriched.owner_self,
          cultivator_label: irrEnriched.cultivator_label,
          land_owner_label: irrEnriched.land_owner_label,
          village_union: villageUnion,
          rate: irrEnriched.rate,
          member_summary: irrEnriched.member_summary,
          current_season_charge: irrEnriched.current_season_charge,
          penalty_amount: irrEnriched.penalty_amount,
          maintenance_charge: irrEnriched.maintenance_charge,
          canal_charge: irrEnriched.canal_charge,
          discount_amount: irrEnriched.discount_amount,
          total_outstanding: irrEnriched.total_outstanding,
          collected_from_outstanding: irrEnriched.collected_from_outstanding,
          remark: irrEnriched.remark,
          holding_description: irrEnriched.holding_description,
          patwari_name: irrEnriched.patwari_name,
          patwari_mobile: irrEnriched.patwari_mobile,
        }
      : {}),
    collected_amount: Number(p.amount),
    description,
    collector_signature_url: receiptArgs.signatureUrl,
    office_collector_signature_url: receiptArgs.signatureUrl,
    verify_url: p.verify_token ? `${window.location.origin}/r/${p.verify_token}` : null,
  };
  return rd;
}

/**
 * Canonical select used to load a payment row with everything the receipt
 * builder needs. Keep in sync with the Payments/Receipts pages so every
 * module renders the identical সেচ চার্জ ও বিবিধ আদায় রশিদ.
 */
export const RECEIPT_PAY_SELECT =
  "*, farmers(name_en,name_bn,farmer_code,member_no,mobile,village,father_name,voter_number,account_number,savings_inactive,is_voter,union_id), patwaris(name,name_bn,mobile), payment_allocations(*)";

/**
 * Fetch a payment row by id and build the identical receipt payload used on the
 * Payments page. Use this everywhere a সেচ চার্জ রশিদ must be downloaded or
 * previewed so the output is consistent across the whole app.
 */
export async function fetchPaymentReceiptData(
  paymentId: string,
  ctx: ReceiptBuildContext,
): Promise<BnReceiptData> {
  if (!paymentId) throw new Error("Payment id is required for receipt");
  const { data, error } = await db
    .from("payments")
    .select(RECEIPT_PAY_SELECT)
    .eq("id", paymentId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Payment not found for receipt");
  // Guarantee the canonical shape even if some joins came back null so every
  // entry point (Payments, Farmer profile, Scan) renders identical output.
  const normalized = {
    ...data,
    payment_allocations: Array.isArray((data as any).payment_allocations)
      ? (data as any).payment_allocations
      : [],
    farmers: (data as any).farmers ?? null,
    patwaris: (data as any).patwaris ?? null,
  };
  return buildPaymentReceiptData(normalized, ctx);
}
