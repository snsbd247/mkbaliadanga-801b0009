import { describe, it, expect } from "vitest";
import {
  PAPER_PRESETS,
  PAGE_MARGIN_MM,
  computeReceiptFit,
  getPaperPreset,
} from "../legacyReceiptLayout";

const EPS = 1e-6;

describe("legacy receipt layout fit", () => {
  const presets = Object.values(PAPER_PRESETS);
  // A spread of realistic rendered-canvas aspect ratios (tall receipts, wide
  // receipts, near-square) at html2canvas scale=2.
  const canvases: Array<[number, number]> = [
    [1440, 900],
    [1440, 1800],
    [1440, 2600],
    [1440, 700],
    [900, 1440],
    [2000, 500],
  ];

  for (const paper of presets) {
    for (const [w, h] of canvases) {
      it(`${paper.id} keeps ${w}x${h} inside the printable area`, () => {
        const fit = computeReceiptFit(paper, w, h);
        // Never exceeds the printable area (no clipping).
        expect(fit.imgW).toBeLessThanOrEqual(fit.availW + EPS);
        expect(fit.imgH).toBeLessThanOrEqual(fit.availH + EPS);
        // Stays within page bounds including margins.
        expect(fit.x).toBeGreaterThanOrEqual(PAGE_MARGIN_MM - EPS);
        expect(fit.y).toBeGreaterThanOrEqual(PAGE_MARGIN_MM - EPS);
        expect(fit.x + fit.imgW).toBeLessThanOrEqual(paper.widthMm - PAGE_MARGIN_MM + EPS);
        expect(fit.y + fit.imgH).toBeLessThanOrEqual(paper.heightMm - PAGE_MARGIN_MM + EPS);
        // Aspect ratio preserved.
        expect(fit.imgH / fit.imgW).toBeCloseTo(h / w, 4);
      });
    }
  }

  it("defaults to a valid preset for unknown ids", () => {
    expect(getPaperPreset("nope").format).toBe("a5");
    expect(getPaperPreset(null).id).toBeTruthy();
  });
});
