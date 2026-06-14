import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import QRCode from "qrcode";
import { getReceiptLayoutSettings, getDefaultPaperSize } from "@/lib/receiptLayoutSettings";

/**
 * Export a loan statement to PDF using the SAME rendering settings as the
 * irrigation receipt: shared watermark (getReceiptLayoutSettings), shared
 * paper size (getDefaultPaperSize), QR verify code, and section-based
 * pagination (logical sections are never split across pages).
 */
export async function downloadLoanStatementPdf(
  rootEl: HTMLElement,
  opts: { fileName?: string; verifyUrl?: string | null } = {}
): Promise<void> {
  const layout = getReceiptLayoutSettings();
  const paper = getDefaultPaperSize(); // "a4" | "a5"
  const pdf = new jsPDF({ orientation: "p", unit: "mm", format: paper === "a5" ? "a5" : "a4" });

  const PAGE_W = pdf.internal.pageSize.getWidth();
  const PAGE_H = pdf.internal.pageSize.getHeight();
  const MARGIN = 10;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  const GAP = 4;
  let cursorY = MARGIN;

  // Watermark — identical source/flag as receipts
  const watermark =
    layout.watermarkEnabled && layout.watermarkText ? layout.watermarkText : "";

  const drawWatermark = () => {
    if (!watermark) return;
    pdf.saveGraphicsState();
    // @ts-ignore - GState is available at runtime
    pdf.setGState(new (pdf as any).GState({ opacity: 0.08 }));
    pdf.setFontSize(48);
    pdf.setTextColor(120, 120, 120);
    pdf.text(watermark, PAGE_W / 2, PAGE_H / 2, { align: "center", angle: 45 });
    pdf.restoreGraphicsState();
    pdf.setTextColor(0, 0, 0);
  };

  drawWatermark();

  const sections = Array.from(
    rootEl.querySelectorAll<HTMLElement>("[data-pdf-section]")
  );
  const targets = sections.length ? sections : [rootEl];

  for (const section of targets) {
    const canvas = await html2canvas(section, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
    });
    const imgH = (canvas.height / canvas.width) * CONTENT_W;
    const remaining = PAGE_H - MARGIN - cursorY;
    if (imgH > remaining && cursorY > MARGIN) {
      pdf.addPage();
      drawWatermark();
      cursorY = MARGIN;
    }
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", MARGIN, cursorY, CONTENT_W, imgH);
    cursorY += imgH + GAP;
  }

  // QR verify code (same verify mechanism as receipts), bottom-right of last page
  if (opts.verifyUrl) {
    try {
      const qr = await QRCode.toDataURL(opts.verifyUrl, { margin: 0, width: 256 });
      const qrSize = 22;
      pdf.addImage(qr, "PNG", PAGE_W - MARGIN - qrSize, PAGE_H - MARGIN - qrSize, qrSize, qrSize);
      pdf.setFontSize(7);
      pdf.text("যাচাই করুন", PAGE_W - MARGIN - qrSize / 2, PAGE_H - MARGIN + 2, { align: "center" });
    } catch {
      /* ignore QR failures */
    }
  }

  pdf.save(opts.fileName || "loan-statement.pdf");
}
