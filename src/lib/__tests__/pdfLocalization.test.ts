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

  it("registers Bangla font and emits BN-mode footer when lang=bn", async () => {
    localStorage.setItem("lang", "bn");
    const doc = new jsPDF();
    const addFont = vi.spyOn(doc as any, "addFont");
    await applyPdfHeaderFooter(doc, { title: "Test", range: { from: "2025-01-01", to: "2025-01-31" } });
    finalizePdf(doc);
    // Font registration is best-effort; if fetch failed we still expect a
    // valid PDF without ASCII fallback labels like "Mudrito" or "Pristha".
    const out = pdfText(doc);
    expect(out).not.toContain("Mudrito");
    expect(out).not.toContain("Pristha");
    expect(addFont).toHaveBeenCalled();
  });
});
