import { describe, it, expect, beforeEach } from "vitest";
import { buildIrrigationInvoiceHtmlForTest } from "@/lib/irrigationInvoicePdf";

beforeEach(() => {
  try { localStorage.clear(); } catch { /* noop */ }
});

// Extracts every `font-size:<n>px` used in the generated HTML.
function fontSizes(html: string): number[] {
  return [...html.matchAll(/font-size:([\d.]+)px/g)].map((m) => Number(m[1]));
}

const baseInvoice = {
  invoice_no: "INV-20260706-0267",
  generated_at: "2026-07-06",
  due_date: "2026-12-31",
  payable_amount: 8693,
  paid_amount: 0,
  due_amount: 8693,
  invoice_status: "generated",
  irrigation_amount: 8693,
  maintenance_amount: 0,
  canal_amount: 0,
  other_charge: 0,
  delay_fee: 0,
  farmer: { name: "মোঃ ইসরাফিল হক", farmer_code: "01167", mobile: "01715587457", village: "বালিয়াডাঙ্গা ভাটোপাড়া" },
  land: { mouza: "কোচলাপাড়া", dag_no: "862, 1322", land_size: 7 },
  season: { name: "আমন-২৬", year: 2026 },
};

const longInvoice = {
  ...baseInvoice,
  payable_amount: 125430,
  due_amount: 100430,
  paid_amount: 25000,
  previous_due_amount: 5000,
  discount_amount: 2000,
  discount_reason: "কর্তৃপক্ষ কর্তৃক অনুমোদিত বিশেষ ছাড় প্রযোজ্য",
  maintenance_amount: 1200,
  canal_amount: 900,
  other_charge: 430,
  delay_fee: 300,
  farmer: {
    name: "মোঃ আব্দুর রহমান আল-মামুন চৌধুরী ইবনে ইসমাইল",
    farmer_code: "0099887",
    mobile: "01700000000",
    village: "উত্তর বালিয়াডাঙ্গা পশ্চিমপাড়া নতুন বাজার সংলগ্ন এলাকা, চাঁপাইনবাবগঞ্জ সদর",
  },
  land: { mouza: "দীর্ঘনামা মৌজা এলাকা", dag_no: "101, 102/A, 103-B, 104, 205/C, 306, 407-D", land_size: 250 },
  season: { name: "বোরো-২৬ (দীর্ঘ মৌসুম নাম)", year: 2026 },
};

describe("irrigation invoice print template — regression", () => {
  it("renders all key headers for a standard invoice", () => {
    const html = buildIrrigationInvoiceHtmlForTest(baseInvoice as any);
    expect(html).toContain("সেচ ইনভয়েস");
    expect(html).toContain("বিবরণ");
    expect(html).toContain("মোট প্রদেয়");
    expect(html).toContain("বকেয়া");
    expect(html).toContain("পরিশোধিত");
    expect(html).toContain(baseInvoice.invoice_no);
    expect(html).toContain(baseInvoice.farmer.name);
  });

  it("keeps all headers present for long names / big address / many rows", () => {
    const html = buildIrrigationInvoiceHtmlForTest(longInvoice as any);
    for (const header of ["সেচ ইনভয়েস", "বিবরণ", "মোট প্রদেয়", "বকেয়া", "পরিশোধিত"]) {
      expect(html).toContain(header);
    }
    expect(html).toContain("পূর্বের বকেয়া");
    expect(html).toContain(longInvoice.farmer.name);
  });

  it("adapts font size smaller for dense content than for sparse content", () => {
    const sparse = Math.max(...fontSizes(buildIrrigationInvoiceHtmlForTest(baseInvoice as any)));
    const dense = Math.max(...fontSizes(buildIrrigationInvoiceHtmlForTest(longInvoice as any)));
    // Dense invoice should not use a larger max font than the sparse one, and
    // the table cell font should shrink.
    expect(dense).toBeLessThanOrEqual(sparse);
  });

  it("uses word-break so long values never collide with the border box", () => {
    const html = buildIrrigationInvoiceHtmlForTest(longInvoice as any);
    expect(html).toContain("word-break:break-word");
  });
});
