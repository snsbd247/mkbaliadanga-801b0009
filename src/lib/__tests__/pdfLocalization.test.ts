import { describe, it, expect, beforeEach, vi } from "vitest";
import jsPDF from "jspdf";
import { applyPdfHeaderFooter, finalizePdf } from "@/lib/exports";

function pdfText(doc: jsPDF): string {
  const uri = doc.output("datauristring");
  const b64 = uri.split(",")[1] ?? "";
  return Buffer.from(b64, "base64").toString("latin1");
}

describe("PDF localization (header/footer)", () => {
  beforeEach(() => {
    localStorage.clear();
    // Stub fetch for the Bangla font so the test never hits the network.
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(0),
    })));
  });

  it("renders English header/footer when lang=en", async () => {
    localStorage.setItem("lang", "en");
    const doc = new jsPDF();
    await applyPdfHeaderFooter(doc, { title: "Test", range: { from: "2025-01-01", to: "2025-01-31" } });
    finalizePdf(doc);
    const out = pdfText(doc);
    expect(out).toContain("Period");
    expect(out).toContain("Printed");
    expect(out).toContain("Page");
  });

  it("emits BN-mode header without transliterated fallback when lang=bn", async () => {
    localStorage.setItem("lang", "bn");
    const doc = new jsPDF();
    await applyPdfHeaderFooter(doc, { title: "Test", range: { from: "2025-01-01", to: "2025-01-31" } });
    finalizePdf(doc);
    const out = pdfText(doc);
    // Font fetch is stubbed to return empty → ensureBanglaFont returns false
    // → exports.ts falls back to plain English labels (NOT the old
    // "(Mudrito)"/"(Pristha)" transliteration).
    expect(out).not.toContain("Mudrito");
    expect(out).not.toContain("Pristha");
    expect(out).not.toContain("Somoy");
    expect((globalThis as any).fetch).toHaveBeenCalled();
  });
});
