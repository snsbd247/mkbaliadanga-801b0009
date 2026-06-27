import { describe, it, expect, beforeEach } from "vitest";
import { buildReceiptCopyHtmlForTest, type BnReceiptData } from "@/lib/bnReceipts";
import { resolveFieldTypeLabel } from "@/lib/irrigationLandType";
import { setReceiptLayoutSettings, DEFAULT_RECEIPT_LAYOUT } from "@/lib/receiptLayoutSettings";

beforeEach(() => {
  try { localStorage.clear(); } catch { /* noop */ }
  setReceiptLayoutSettings(DEFAULT_RECEIPT_LAYOUT);
});

function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function rowFor(html: string, label: string): string {
  // Cells may contain nested <span> styling and the colon may sit either in the
  // label cell or in its own separator cell. Strip spans, then match the label
  // (with optional trailing colon) and skip an optional colon-only cell.
  const clean = html.replace(/<\/?span[^>]*>/g, "");
  const lbl = esc(label.replace(/:$/, ""));
  const re = new RegExp(
    `<td[^>]*>${lbl}:?</td>\\s*(?:<td[^>]*>\\s*:?\\s*</td>\\s*)?<td[^>]*>([\\s\\S]*?)</td>`,
  );
  const m = clean.match(re);
  return m ? m[1] : "";
}

const base: BnReceiptData = {
  kind: "irrigation",
  receipt_no: "R-EDGE",
  date: "2026-06-20",
  farmer: {
    name: "মোঃ মাসুদ রানা",
    member_no: "1920",
    father_or_husband: "মোঃ তোহিদুল ইসলাম",
    village: "ঘোনটোলা",
    mobile: "01715699767",
    mouza: "রন্দ",
    land_size: 33,
    dag_no: "1.25.25.26.26.24.28.26.264.247.2852",
    field_type_bn: "উচু জমি",
  },
  rate: 3939.39,
  current_season_charge: 1300,
  current_penalty: 130,
  total_outstanding: 1300,
  due_penalty: 130,
  collected_amount: 2860,
  collector_signature_url: null,
  village_union: "বালিয়াডাঙ্গা",
};

describe("irrigation receipt edge cases (overflow prevention)", () => {
  it("renders all dag tokens for a very long dag list", () => {
    const html = buildReceiptCopyHtmlForTest(base, "farmer", "bn");
    const dag = rowFor(html, "দাগ নং:");
    for (const tok of ["১", "২৬৪", "২৪৭", "২৮৫২"]) expect(dag).toContain(tok);
  });

  it("applies consistent wrapping/line-height to every cell so long text cannot overflow", () => {
    const html = buildReceiptCopyHtmlForTest(base, "farmer", "bn");
    expect(html).toContain("overflow-wrap:anywhere");
    expect(html).toContain("word-break:break-word");
    expect(html).toContain("line-height:1.35");
  });

  it("handles very long remark / holding text without throwing", () => {
    const longText = "অতিরিক্ত মন্তব্য ".repeat(60);
    const html = buildReceiptCopyHtmlForTest({ ...base, holding_description: longText }, "farmer", "bn");
    const holding = rowFor(html, "হোল্ডিং এর বিবরন/পাটুয়ারীর নাম ও মোবা নং:");
    expect(holding.length).toBeGreaterThan(100);
  });

  it("shows separate হাল and বকেয়া penalty breakdown alongside totals", () => {
    const html = buildReceiptCopyHtmlForTest(base, "farmer", "bn");
    expect(rowFor(html, "চার্জের পরিমাণ (হাল)/জরিমানা:")).toContain("১৩০০৳/১৩০৳");
    expect(rowFor(html, "চার্জের পরিমাণ (বকেয়া)/জরিমানা:")).toContain("১৩০০৳/১৩০৳");
    expect(rowFor(html, "মোট আদায়ের পরিমাণ:")).toContain("২৮৬০৳");
  });

  it("rate row shows acre rate and bigha rate (acre ÷ 33)", () => {
    const html = buildReceiptCopyHtmlForTest(base, "farmer", "bn");
    const kind = rowFor(html, "জমির ধরন/ চার্জ রেট (একর/বিঘা):");
    expect(kind).toContain("উচু জমি");
    expect(kind).toContain("৩৯৩৯.৩৯"); // একর রেট
    expect(kind).toContain("১১৯.৩৮");   // 3939.39 / 33 = 119.38 বিঘা রেট
  });

  it("land size renders as একর with exactly 4 decimals", () => {
    const html = buildReceiptCopyHtmlForTest({ ...base, farmer: { ...base.farmer, land_size: 50 } }, "farmer", "bn");
    expect(rowFor(html, "জমির পরিমাণ:")).toContain("০.৫০০০ একর");
  });

  it("owner_self shows only the owner's own name (no bargadar/owner split)", () => {
    const html = buildReceiptCopyHtmlForTest({ ...base, owner_self: true }, "farmer", "bn");
    const val = rowFor(html, "কৃষকের নাম ও আইডি/মালিকের নাম ও আইডি:");
    expect(val).toContain("মোঃ মাসুদ রানা");
    expect(val).not.toContain("/"); // self ⇒ single name, no bargadar/owner separator
  });
});

describe("resolveFieldTypeLabel (land type & rate rules)", () => {
  it("rice seasons map to land elevation (উচু/নিচু/মাঝারি)", () => {
    expect(resolveFieldTypeLabel({ categoryName: "আমন", landTypeName: "উচু", seasonName: "আমন-২৬" })).toBe("উচু");
    expect(resolveFieldTypeLabel({ categoryName: "ইরি", landTypeName: "নিচু", seasonName: "ইরি-২৬" })).toBe("নিচু");
    expect(resolveFieldTypeLabel({ categoryName: "Boro", landTypeName: "মাঝারি" })).toBe("মাঝারি");
  });

  it("non-rice types show the category name (পুকুর/সবজি/ভর্তি ফি/বিঘা)", () => {
    expect(resolveFieldTypeLabel({ categoryName: "পুকুর", landTypeName: "উচু" })).toBe("পুকুর");
    expect(resolveFieldTypeLabel({ categoryName: "সবজি", landTypeName: "নিচু" })).toBe("সবজি");
    expect(resolveFieldTypeLabel({ categoryName: "ভর্তি ফি" })).toBe("ভর্তি ফি");
    expect(resolveFieldTypeLabel({ categoryName: "বিঘা" })).toBe("বিঘা");
  });

  it("returns null when nothing is available", () => {
    expect(resolveFieldTypeLabel({})).toBeNull();
  });
});
