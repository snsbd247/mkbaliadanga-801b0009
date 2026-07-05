// Shared layout rules for the legacy irrigation receipt so the on-screen
// preview and the exported PDF always use identical paper size, margins and
// aspect-preserving scaling. Keeping this in one place is what prevents the
// print layout from "drifting" away from what the user sees in the preview.

export type PaperOrientation = "portrait" | "landscape";

export interface PaperPreset {
  id: string;
  labelEn: string;
  labelBn: string;
  format: "a4" | "a5";
  orientation: PaperOrientation;
  widthMm: number;
  heightMm: number;
}

const A4_SHORT = 210; // mm
const A4_LONG = 297; // mm
const A5_SHORT = 148; // mm
const A5_LONG = 210; // mm

export const PAPER_PRESETS: Record<string, PaperPreset> = {
  "a5-landscape": {
    id: "a5-landscape",
    labelEn: "A5 Landscape",
    labelBn: "এ৫ ল্যান্ডস্কেপ",
    format: "a5",
    orientation: "landscape",
    widthMm: A5_LONG,
    heightMm: A5_SHORT,
  },
  "a5-portrait": {
    id: "a5-portrait",
    labelEn: "A5 Portrait",
    labelBn: "এ৫ পোর্ট্রেট",
    format: "a5",
    orientation: "portrait",
    widthMm: A5_SHORT,
    heightMm: A5_LONG,
  },
  "a4-landscape": {
    id: "a4-landscape",
    labelEn: "A4 Landscape",
    labelBn: "এ৪ ল্যান্ডস্কেপ",
    format: "a4",
    orientation: "landscape",
    widthMm: A4_LONG,
    heightMm: A4_SHORT,
  },
  "a4-portrait": {
    id: "a4-portrait",
    labelEn: "A4 Portrait",
    labelBn: "এ৪ পোর্ট্রেট",
    format: "a4",
    orientation: "portrait",
    widthMm: A4_SHORT,
    heightMm: A4_LONG,
  },
};

export const DEFAULT_PAPER_ID = "a5-landscape";

/** Fixed CSS pixel width the receipt HTML is authored at. */
export const RECEIPT_WIDTH_PX = 720;

/** Uniform printable margin (mm) on every side, shared by preview + export. */
export const PAGE_MARGIN_MM = 10;

export function getPaperPreset(id?: string | null): PaperPreset {
  return PAPER_PRESETS[id ?? DEFAULT_PAPER_ID] ?? PAPER_PRESETS[DEFAULT_PAPER_ID];
}

export interface ReceiptFit {
  /** Placed image size, in mm. */
  imgW: number;
  imgH: number;
  /** Top-left offset of the placed image, in mm (centered). */
  x: number;
  y: number;
  /** Printable area (page minus margins), in mm. */
  availW: number;
  availH: number;
}

/**
 * Compute a centered, aspect-ratio-preserving placement of a rendered receipt
 * canvas (`canvasW` × `canvasH` px) inside the printable area of `paper`.
 * The result never exceeds the printable area, so the receipt can never clip.
 */
export function computeReceiptFit(
  paper: PaperPreset,
  canvasW: number,
  canvasH: number,
  marginMm: number = PAGE_MARGIN_MM,
): ReceiptFit {
  const availW = Math.max(0, paper.widthMm - marginMm * 2);
  const availH = Math.max(0, paper.heightMm - marginMm * 2);
  const ratio = canvasW > 0 ? canvasH / canvasW : 1;

  let imgW = availW;
  let imgH = imgW * ratio;
  if (imgH > availH) {
    imgH = availH;
    imgW = ratio > 0 ? imgH / ratio : availW;
  }

  const x = (paper.widthMm - imgW) / 2;
  const y = (paper.heightMm - imgH) / 2;
  return { imgW, imgH, x, y, availW, availH };
}
