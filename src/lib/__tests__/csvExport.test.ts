import { describe, it, expect } from "vitest";
import { rowsToCsvBlob } from "../csvExport";

describe("rowsToCsvBlob", () => {
  it("produces UTF-8 BOM + headers + escaped cells", async () => {
    const blob = rowsToCsvBlob(
      [
        { name: "Alice, A", note: 'He said "hi"' },
        { name: "বাবলু", note: "ok" },
      ],
      [
        { header: "Name", accessor: (r) => r.name },
        { header: "Note", accessor: (r) => r.note },
      ],
    );
    const text = await blob.text();
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text).toContain('"Alice, A"');
    expect(text).toContain('"He said ""hi"""');
    expect(text).toContain("বাবলু");
  });

  it("handles 12k rows without error", () => {
    const rows = Array.from({ length: 12000 }, (_, i) => ({ i }));
    const blob = rowsToCsvBlob(rows, [{ header: "i", accessor: (r) => r.i }]);
    expect(blob.size).toBeGreaterThan(0);
  });
});
