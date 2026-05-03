import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import type { CardData, CardDisplayOptions } from "./MembershipCard";
import type { TemplateId } from "./templates";

// CR80 card size — matches MembershipCard preview (85.6mm × 54mm).
const CARD_W_MM = 85.6;
const CARD_H_MM = 54;
const PAGE_MARGIN_MM = 12;
const GAP_MM = 6;

async function captureToImage(el: HTMLElement): Promise<{ data: string; w: number; h: number }> {
  // High-DPI render so text/logo/QR stay crisp at print scale.
  const canvas = await html2canvas(el, {
    scale: 3,
    backgroundColor: "#ffffff",
    useCORS: true,
    allowTaint: false,
    logging: false,
    // Avoid html2canvas re-cloning fonts that may not be available off-DOM.
    foreignObjectRendering: false,
  });
  return {
    data: canvas.toDataURL("image/png"),
    w: canvas.width,
    h: canvas.height,
  };
}

/**
 * Find the front + back sides inside a rendered <MembershipCard /> root.
 * MembershipCard renders both sides as siblings inside a flex wrapper.
 */
function getCardSides(root: HTMLElement): HTMLElement[] {
  // First try: the two direct children of [data-testid=membership-card].
  const wrapper =
    (root.querySelector('[data-testid="membership-card"]') as HTMLElement | null) ?? root;
  const sides = Array.from(wrapper.children).filter(
    (n) => n instanceof HTMLElement,
  ) as HTMLElement[];
  if (sides.length >= 1) return sides;
  return [root];
}

async function addSideToPdf(doc: jsPDF, side: HTMLElement, x: number, y: number) {
  const img = await captureToImage(side);
  doc.addImage(img.data, "PNG", x, y, CARD_W_MM, CARD_H_MM, undefined, "FAST");
}

/**
 * Download a single farmer's membership card as a PDF.
 * The PDF is a *visual capture* of the on-screen <MembershipCard /> so the
 * output always matches the live preview exactly (including Bengali text,
 * accent color, custom text, photo, QR, etc.).
 *
 * `cardRoot` must be the DOM node that wraps the rendered MembershipCard.
 * The legacy positional-args signature is also accepted for backward
 * compatibility but is now ignored — we capture the DOM directly.
 */
export async function downloadCardPdf(
  cardRoot: HTMLElement,
  filename?: string,
): Promise<void>;
// Legacy signature (kept so older callers don't break at compile time).
export async function downloadCardPdf(
  data: CardData,
  qrSvg: SVGElement | null,
  templateId?: TemplateId,
  display?: CardDisplayOptions,
): Promise<void>;
export async function downloadCardPdf(...args: any[]): Promise<void> {
  const first = args[0];
  if (!(first instanceof HTMLElement)) {
    throw new Error(
      "downloadCardPdf now requires the rendered card's DOM element. " +
        "Pass cardRef.current instead of CardData.",
    );
  }
  const cardRoot = first as HTMLElement;
  const filename = (args[1] as string | undefined) ?? "farmer-card.pdf";

  const sides = getCardSides(cardRoot);
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  let y = PAGE_MARGIN_MM;
  const x = (doc.internal.pageSize.getWidth() - CARD_W_MM) / 2;
  for (let i = 0; i < sides.length; i++) {
    if (y + CARD_H_MM > doc.internal.pageSize.getHeight() - PAGE_MARGIN_MM) {
      doc.addPage();
      y = PAGE_MARGIN_MM;
    }
    await addSideToPdf(doc, sides[i], x, y);
    y += CARD_H_MM + GAP_MM;
  }
  doc.save(filename);
}

/**
 * Bulk export — accepts an array of mounted card root elements (one per
 * farmer) and writes them all into a single PDF, two-up per page.
 */
export async function downloadBulkCardsPdf(
  cardRoots: HTMLElement[],
  filename = "farmer-cards.pdf",
): Promise<void> {
  if (cardRoots.length === 0) throw new Error("No cards to export");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const x = (pageW - CARD_W_MM) / 2;

  let y = PAGE_MARGIN_MM;
  let firstOnPage = true;

  for (let i = 0; i < cardRoots.length; i++) {
    const sides = getCardSides(cardRoots[i]);
    for (let s = 0; s < sides.length; s++) {
      if (!firstOnPage && y + CARD_H_MM > pageH - PAGE_MARGIN_MM) {
        doc.addPage();
        y = PAGE_MARGIN_MM;
        firstOnPage = true;
      }
      await addSideToPdf(doc, sides[s], x, y);
      y += CARD_H_MM + GAP_MM;
      firstOnPage = false;
    }
    // Force a page break between farmers so cards don't get split mid-set.
    if (i < cardRoots.length - 1) {
      doc.addPage();
      y = PAGE_MARGIN_MM;
      firstOnPage = true;
    }
  }
  doc.save(filename);
}
