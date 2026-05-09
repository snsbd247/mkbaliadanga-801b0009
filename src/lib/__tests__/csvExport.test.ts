import { describe, it, expect } from "vitest";
import { rowsToCsvString, rowsToCsvBlob } from "../csvExport";

describe("rowsToCsvString", () => {
  it("produces headers + escaped cells with Bangla support", () => {
    const text = rowsToCsvString(
      [
        { name: "Alice, A", note: 'He said "hi"' },
        { name: "বাবলু", note: "ok" },
      ],
      [
        { header: "Name", accessor: (r) => r.name },
        { header: "Note", accessor: (r) => r.note },
      ],
    );
    expect(text).toContain("Name,Note");
    expect(text).toContain('"Alice, A"');
    expect(text).toContain('"He said ""hi"""');
    expect(text).toContain("বাবলু");
  });

  it("handles 12k rows without error", () => {
    const rows = Array.from({ length: 12000 }, (_, i) => ({ i }));
    const text = rowsToCsvString(rows, [{ header: "i", accessor: (r) => r.i }]);
    expect(text.split("\n").length).toBeGreaterThan(12000);
  });
});

describe("rowsToCsvBlob", () => {
  it("returns a Blob whose size includes BOM bytes", () => {
    const blob = rowsToCsvBlob([{ a: 1 }], [{ header: "a", accessor: r => r.a }]);
    // header "a\n" = 2 bytes, "1\n" = 2 bytes, BOM = 3 bytes → 7
    expect(blob.size).toBe(7);
    expect(blob.type).toContain("text/csv");
  });
});
