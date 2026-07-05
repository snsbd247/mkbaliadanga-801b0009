import { describe, it, expect } from "vitest";
import { buildOfficialIrrigationReceiptHtml } from "@/lib/bnReceipts";
import { mapLegacyToReceiptData } from "@/lib/legacyReceiptPdf";
import type { LegacyIrrigationRecord } from "@/lib/api/legacyIrrigation";

const rec: LegacyIrrigationRecord = {
  id: "1",
  office_id: "o1",
  import_batch_id: "b1",
  legacy_farmer_code: "2473",
  farmer_name: "মো আকবর আলী",
  father_name: "মো ইয়াসিন আলী",
  village: "পুরাতন কাউন্সিল",
  mobile_no: "1714232228",
  mouza_name: "মানপুর",
  season_year: "আমন-2025",
  land_shatak: 34,
  dag_no: "159.160.42",
  rate: 1300,
  owner_id_name: "মো আকবর আলী",
  due_amount: 0,
  paid_amount: 1339,
  owner_type_name: "মালিক",
  owner_father_name: null,
  owner_village: null,
  owner_mobile_no: null,
  owner_fid: null,
  receipt_no: "1",
  collection_date: "2025-07-03",
} as unknown as LegacyIrrigationRecord;

describe("legacy receipt shares the official irrigation template", () => {
  const legacyHtml = buildOfficialIrrigationReceiptHtml(mapLegacyToReceiptData(rec, {
    company_name_bn: "মহাম্মদখানী সেচ প্রকল্প",
    company_name: null,
    logo_url: null,
    editor_signature_url: null,
  }));

  it("renders the official receipt title", () => {
    expect(legacyHtml).toContain("সেচ চার্জ ও বিবিধ আদায় রশিদ");
  });

  it("uses the single wide bordered table (2px border)", () => {
    expect(legacyHtml).toContain("border:2px solid #111");
  });

  it("keeps the editor/collector signature row on the right side", () => {
    // Member signature label on the left, collector/editor signature on the right.
    expect(legacyHtml).toContain("সদস্যের স্বাক্ষর/প্রদানকারীর স্বাক্ষর");
    expect(legacyHtml).toContain("আদায়কারীর স্বাক্ষর");
    // The signature block must come after the table so it always lands at the bottom.
    expect(legacyHtml.indexOf("</table>")).toBeLessThan(legacyHtml.indexOf("আদায়কারীর স্বাক্ষর"));
  });

  it("falls back to the company name when no logo is set", () => {
    expect(legacyHtml).toContain("মহাম্মদখানী সেচ প্রকল্প");
  });
});
