import { describe, it, expect } from "vitest";
import { joinInvoiceNotes, flattenInvoiceForExport, IRR_BN, IRR_EN } from "@/lib/irrigationExports";

describe("joinInvoiceNotes", () => {
  it("joins invoice note and land note with ' || '", () => {
    expect(joinInvoiceNotes({ note: "জমি ১ নোট", lands: { notes: "জমি ২ নোট" } }))
      .toBe("জমি ১ নোট || জমি ২ নোট");
  });

  it("returns single note when only one is present", () => {
    expect(joinInvoiceNotes({ note: "শুধু ইনভয়েস নোট", lands: {} })).toBe("শুধু ইনভয়েস নোট");
    expect(joinInvoiceNotes({ note: "", lands: { notes: "শুধু জমি নোট" } })).toBe("শুধু জমি নোট");
  });

  it("returns empty string with no stray separators when no notes exist", () => {
    expect(joinInvoiceNotes({ note: null, lands: { notes: null } })).toBe("");
    expect(joinInvoiceNotes({})).toBe("");
    expect(joinInvoiceNotes({ note: "   ", lands: { notes: "  " } })).toBe("");
  });

  it("drops blank values so no ' || ' surrounds empty notes", () => {
    expect(joinInvoiceNotes({ note: "আছে", lands: { notes: "   " } })).toBe("আছে");
    expect(joinInvoiceNotes({ note: "  ", lands: { notes: "আছে" } })).toBe("আছে");
  });
});

describe("flattenInvoiceForExport note column", () => {
  it("includes the note column (BN + EN)", () => {
    const inv = { note: "ক", lands: { notes: "খ" } };
    expect(flattenInvoiceForExport(inv, "bn")[IRR_BN.note]).toBe("ক || খ");
    expect(flattenInvoiceForExport(inv, "en")[IRR_EN.note]).toBe("ক || খ");
  });

  it("shows empty string in the note column when there is no note", () => {
    expect(flattenInvoiceForExport({}, "bn")[IRR_BN.note]).toBe("");
  });
});
