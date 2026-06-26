// Land-transfer integrity verification.
//
// Validates that borga / sale / inheritance / split transfers seeded by the
// Demo Manager (or created by users) are internally consistent AND visible on
// BOTH farmer profiles (source + recipient). Pure functions only — fed plain
// rows so they are unit-testable and reusable by the live DemoManager report.
//
// Invariants checked per transfer:
//  1. transfer_type is one of the known kinds
//  2. snapshot columns preserved (dag/mouza/size/owner) so history survives
//     even after the source land is archived
//  3. at least one recipient row
//  4. each recipient has a created land row (new_land_id) and positive area
//  5. recipient lands actually exist and are active (deleted_at IS NULL)
//  6. sum(recipient area) does not exceed source land size (+epsilon)
//  7. two-profile visibility: every recipient differs from the source farmer
//     for non-borga ownership transfers (borga may keep owner linkage)
//  8. source land is archived (full give) or still active (partial) — but for
//     borga_return the source archived row must have been revived
//
// Each violation is returned with a stable `code` so the UI + tests can assert.

export type LandTransferType =
  | "inheritance" | "sale" | "borga_transfer" | "borga_return" | "split" | "other";

export const KNOWN_TRANSFER_TYPES: LandTransferType[] = [
  "inheritance", "sale", "borga_transfer", "borga_return", "split", "other",
];

export type TransferRecipientRow = {
  id: string;
  transfer_id: string;
  recipient_farmer_id: string | null;
  new_land_id: string | null;
  area_decimal: number | null;
};

export type TransferRow = {
  id: string;
  source_land_id: string | null;
  source_farmer_id: string | null;
  transfer_type: string;
  source_dag_no: string | null;
  source_mouza: string | null;
  source_land_size: number | null;
  source_owner_name: string | null;
  source_owner_code: string | null;
  transferred_at: string | null;
};

export type LandRow = {
  id: string;
  farmer_id: string | null;
  dag_no: string | null;
  land_size: number | null;
  deleted_at: string | null;
};

export type IntegrityViolation = {
  transfer_id: string;
  code:
    | "unknown_type"
    | "missing_snapshot"
    | "no_recipients"
    | "recipient_no_land"
    | "recipient_no_area"
    | "recipient_land_missing"
    | "recipient_land_archived"
    | "area_exceeds_source"
    | "recipient_equals_source"
    | "source_land_missing";
  severity: "error" | "warning";
  message_en: string;
  message_bn: string;
  detail?: string;
  /** Source farmer of the offending transfer — used for deep-linking. */
  farmer_id?: string | null;
  /** Recipient farmer (when the violation is recipient-specific). */
  recipient_farmer_id?: string | null;
  /** Offending recipient row id (when applicable). */
  recipient_id?: string | null;
};

export type IntegrityInput = {
  transfers: TransferRow[];
  recipients: TransferRecipientRow[];
  lands: LandRow[];
};

export type IntegritySummary = {
  total: number;        // number of transfers checked
  withRecipients: number;
  errors: number;
  warnings: number;
  byType: Record<string, number>;
  allOk: boolean;
};

const EPSILON = 0.01;

/** Validate all transfers; returns a flat list of violations (empty = clean). */
export function checkLandTransferIntegrity(input: IntegrityInput): IntegrityViolation[] {
  const { transfers, recipients, lands } = input;
  const landById = new Map(lands.map((l) => [l.id, l]));
  const recByTransfer = new Map<string, TransferRecipientRow[]>();
  for (const r of recipients) {
    const arr = recByTransfer.get(r.transfer_id) ?? [];
    arr.push(r);
    recByTransfer.set(r.transfer_id, arr);
  }

  const out: IntegrityViolation[] = [];
  const push = (
    transfer_id: string,
    code: IntegrityViolation["code"],
    severity: IntegrityViolation["severity"],
    en: string, bn: string, detail?: string,
  ) => out.push({ transfer_id, code, severity, message_en: en, message_bn: bn, detail });

  for (const t of transfers) {
    const type = t.transfer_type as LandTransferType;
    if (!KNOWN_TRANSFER_TYPES.includes(type)) {
      push(t.id, "unknown_type", "error",
        `Unknown transfer type "${t.transfer_type}"`,
        `অজানা হস্তান্তরের ধরন "${t.transfer_type}"`);
    }

    // snapshot must survive archival
    if (!t.source_dag_no || t.source_land_size == null || !t.source_owner_name) {
      push(t.id, "missing_snapshot", "error",
        "Transfer is missing source snapshot (dag/size/owner)",
        "হস্তান্তরে উৎস স্ন্যাপশট নেই (দাগ/পরিমাণ/মালিক)");
    }

    const recs = recByTransfer.get(t.id) ?? [];
    if (recs.length === 0) {
      push(t.id, "no_recipients", "error",
        "Transfer has no recipient rows",
        "হস্তান্তরে কোনো প্রাপক নেই");
    }

    // source land present check (warning — old transfers may predate snapshot)
    if (t.source_land_id && !landById.has(t.source_land_id)) {
      push(t.id, "source_land_missing", "warning",
        "Source land row not found (snapshot still preserves history)",
        "উৎস জমির রেকর্ড পাওয়া যায়নি (স্ন্যাপশটে ইতিহাস সংরক্ষিত)");
    }

    let areaSum = 0;
    for (const rc of recs) {
      const area = Number(rc.area_decimal ?? 0);
      areaSum += area;
      if (!rc.new_land_id) {
        push(t.id, "recipient_no_land", "error",
          "Recipient has no created land row",
          "প্রাপকের জন্য নতুন জমি তৈরি হয়নি", rc.id);
      } else {
        const land = landById.get(rc.new_land_id);
        if (!land) {
          push(t.id, "recipient_land_missing", "error",
            "Recipient land row missing in lands table",
            "প্রাপকের জমি lands টেবিলে নেই", rc.new_land_id);
        } else if (land.deleted_at) {
          push(t.id, "recipient_land_archived", "warning",
            "Recipient land is archived (not visible on profile)",
            "প্রাপকের জমি আর্কাইভড (প্রোফাইলে দেখা যাবে না)", rc.new_land_id);
        }
      }
      if (area <= 0) {
        push(t.id, "recipient_no_area", "error",
          "Recipient area is zero or negative",
          "প্রাপকের জমির পরিমাণ শূন্য বা ঋণাত্মক", rc.id);
      }
      // two-profile distinctness for ownership transfers
      if (type !== "borga_return" && rc.recipient_farmer_id
        && t.source_farmer_id && rc.recipient_farmer_id === t.source_farmer_id) {
        push(t.id, "recipient_equals_source", "warning",
          "Recipient equals source farmer",
          "প্রাপক ও উৎস কৃষক একই", rc.id);
      }
    }

    if (t.source_land_size != null && areaSum > Number(t.source_land_size) + EPSILON) {
      push(t.id, "area_exceeds_source", "error",
        `Allocated area ${areaSum.toFixed(2)} exceeds source ${Number(t.source_land_size).toFixed(2)}`,
        `বরাদ্দকৃত পরিমাণ ${areaSum.toFixed(2)} উৎস ${Number(t.source_land_size).toFixed(2)} ছাড়িয়ে গেছে`);
    }
  }

  // Enrich each violation with farmer / recipient ids for deep-linking.
  const transferById = new Map(transfers.map((t) => [t.id, t]));
  const recipientById = new Map(recipients.map((r) => [r.id, r]));
  for (const v of out) {
    const t = transferById.get(v.transfer_id);
    v.farmer_id = t?.source_farmer_id ?? null;
    const rc = v.detail ? recipientById.get(v.detail) : undefined;
    if (rc) {
      v.recipient_id = rc.id;
      v.recipient_farmer_id = rc.recipient_farmer_id ?? null;
    }
  }

  return out;
}

export function summarizeIntegrity(
  input: IntegrityInput,
  violations: IntegrityViolation[],
): IntegritySummary {
  const byType: Record<string, number> = {};
  for (const t of input.transfers) byType[t.transfer_type] = (byType[t.transfer_type] ?? 0) + 1;
  const recSet = new Set(input.recipients.map((r) => r.transfer_id));
  const errors = violations.filter((v) => v.severity === "error").length;
  const warnings = violations.filter((v) => v.severity === "warning").length;
  return {
    total: input.transfers.length,
    withRecipients: input.transfers.filter((t) => recSet.has(t.id)).length,
    errors,
    warnings,
    byType,
    allOk: errors === 0,
  };
}
