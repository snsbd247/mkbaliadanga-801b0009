import { describe, it, expect, beforeEach } from "vitest";
import jsPDF from "jspdf";
import { applyPdfHeaderFooter, finalizePdf } from "@/lib/exports";

function pdfText(doc: jsPDF): string {
  const uri = doc.output("datauristring");
  const b64 = uri.split(",")[1] ?? "";
  return Buffer.from(b64, "base64").toString("latin1");
}

describe("PDF localization (header/footer)", () => {
  beforeEach(() => {
    // jsdom provides localStorage automatically.
    localStorage.clear();
  });

  it("renders English header/footer when lang=en", async () => {
    localStorage.setItem("lang", "en");
    const doc = new jsPDF();
    await applyPdfHeaderFooter(doc, { title: "Test", range: { from: "2025-01-01", to: "2025-01-31" } });
    finalizePdf(doc);
    const out = pdfText(doc);
    expect(out).toMatch(/Period/);
    expect(out).toMatch(/Printed/);
    expect(out).toMatch(/Page/);
  });

  it("renders Bangla-transliterated header/footer when lang=bn", async () => {
    localStorage.setItem("lang", "bn");
    const doc = new jsPDF();
    await applyPdfHeaderFooter(doc, { title: "Test", range: { from: "2025-01-01", to: "2025-01-31" } });
    finalizePdf(doc);
    const out = pdfText(doc);
    expect(out).toMatch(/Period \(Somoy\)/);
    expect(out).toMatch(/Mudrito/);
    expect(out).toMatch(/Pristha/);
  });
});
