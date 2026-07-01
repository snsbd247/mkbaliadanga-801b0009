import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_RECEIPT_LAYOUT,
  getReceiptLayoutSettings,
  setReceiptLayoutSettings,
  resetReceiptLayoutSettings,
  getReceiptFitToPage,
} from "@/lib/receiptLayoutSettings";

describe("receipt reset + fit-to-page", () => {
  beforeEach(() => resetReceiptLayoutSettings());

  it("defaults fitToPage to true", () => {
    expect(getReceiptFitToPage()).toBe(true);
    expect(DEFAULT_RECEIPT_LAYOUT.fitToPage).toBe(true);
  });

  it("persists fitToPage toggle", () => {
    setReceiptLayoutSettings({ fitToPage: false });
    expect(getReceiptFitToPage()).toBe(false);
    expect(getReceiptLayoutSettings().fitToPage).toBe(false);
  });

  it("reset restores all layout fields to defaults", () => {
    setReceiptLayoutSettings({
      fitToPage: false,
      irrigationBottomPaddingPx: 90,
      irrigationPagePaddingPx: 70,
      defaultPaperSize: "a4",
    });
    const s = resetReceiptLayoutSettings();
    expect(s).toEqual(DEFAULT_RECEIPT_LAYOUT);
    expect(getReceiptLayoutSettings()).toEqual(DEFAULT_RECEIPT_LAYOUT);
  });
});
