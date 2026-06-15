import { describe, it, expect } from "vitest";
import jsPDF from "jspdf";
import { COLLECTION_RECEIPT_PAPER } from "@/lib/receiptPaper";

describe("collection receipt (loan + savings) print layout", () => {
  it("uses A5 landscape with stable margin/QR settings", () => {
    expect(COLLECTION_RECEIPT_PAPER.format).toBe("a5");
    expect(COLLECTION_RECEIPT_PAPER.orientation).toBe("l");
    expect(COLLECTION_RECEIPT_PAPER.unit).toBe("mm");
    expect(COLLECTION_RECEIPT_PAPER.margin).toBe(14);
    expect(COLLECTION_RECEIPT_PAPER.qrSize).toBe(16);
  });

  it("produces a single A5 landscape page (≈210×148mm)", () => {
    const doc = new jsPDF({
      unit: COLLECTION_RECEIPT_PAPER.unit,
      format: COLLECTION_RECEIPT_PAPER.format,
      orientation: COLLECTION_RECEIPT_PAPER.orientation,
    });
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    // Landscape => width > height, A5 ≈ 210 x 148 mm
    expect(w).toBeGreaterThan(h);
    expect(Math.round(w)).toBe(210);
    expect(Math.round(h)).toBe(148);
    expect(doc.getNumberOfPages()).toBe(1);
  });
});
