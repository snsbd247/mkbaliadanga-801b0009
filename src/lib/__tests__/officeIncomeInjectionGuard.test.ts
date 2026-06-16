/**
 * @vitest-environment jsdom
 *
 * Integration guard: an office-income receipt (হাওলাত/ভাঙারি/অনুদান, সেচ + সেভিং)
 * must NEVER leak farmer land/mouza/dag/charge data even when a malicious or
 * buggy caller injects those fields. The layout always shows locked "N/A".
 * Mirrors what OfficeIncomeTab's buildBnData enforces, but verifies the
 * rendering layer itself drops the data regardless of input.
 */
import { describe, it, expect } from "vitest";
import { buildReceiptCopyHtmlForTest, type BnReceiptData } from "@/lib/bnReceipts";

// A poisoned payload: someone tries to smuggle land/mouza/dag/charge through.
const poisoned = (stream: "sech" | "saving"): BnReceiptData => ({
  kind: stream === "saving" ? "savings" : "irrigation",
  office_income: true,
  receipt_no: "RCP-2026-06-0011",
  date: "2026-06-16",
  bill_info: "ভাঙারি",
  farmer: {
    name: "অফিস আয়",
    father_or_husband: "পিতা",
    village: "গ্রাম",
    mobile: "01700000000",
    // Injected — must be ignored:
    mouza: "INJECTED-MOUZA",
    land_size: 999,
    dag_no: "123,456",
    field_type_bn: "INJECTED-FIELD",
  },
  // Injected charge/rate/due — must be ignored:
  rate: 555,
  charge_amount: 777,
  previous_due: 888,
  remark: "ভাঙারি বিক্রি",
  collected_amount: 1500,
});

describe("office income receipt — farmer/land injection guard", () => {
  for (const stream of ["sech", "saving"] as const) {
    for (const lang of ["bn", "en"] as const) {
      it(`${stream}/${lang}: suppresses injected land/mouza/dag/charge, keeps N/A`, () => {
        const html = buildReceiptCopyHtmlForTest(poisoned(stream), "farmer", lang);
        // Locked land/mouza must be N/A.
        expect(html).toContain("N/A");
        // None of the injected values may appear anywhere.
        expect(html).not.toContain("INJECTED-MOUZA");
        expect(html).not.toContain("INJECTED-FIELD");
        expect(html).not.toContain("123,456");
        expect(html).not.toContain("555");
        expect(html).not.toContain("777");
        expect(html).not.toContain("888");
        // Manually-entered identity fields are still shown.
        expect(html).toContain("অফিস আয়");
        expect(html).toContain("01700000000");
      });
    }
  }

  it("never renders a dag row for office income", () => {
    const html = buildReceiptCopyHtmlForTest(poisoned("sech"), "farmer", "bn");
    expect(html).not.toContain('data-receipt-row="dag"');
  });
});
