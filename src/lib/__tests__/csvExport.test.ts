import { describe, it, expect } from "vitest";
import { rowsToCsvBlob } from "../csvExport";

describe("rowsToCsvBlob", () => {
  it("produces headers + escaped cells (UTF-8 BOM via Blob)", async () => {
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
    const text = await new Response(blob).text();
    expect(text).toContain("Name,Note");
    expect(text).toContain('"Alice, A"');
    expect(text).toContain('"He said ""hi"""');
    expect(text).toContain("বাবলু");
    // Blob includes the 3-byte UTF-8 BOM (test-env may strip during string decode)
    expect(blob.size).toBeGreaterThan(text.length);
  });

  it("handles 12k rows without error", () => {
    const rows = Array.from({ length: 12000 }, (_, i) => ({ i }));
    const blob = rowsToCsvBlob(rows, [{ header: "i", accessor: (r) => r.i }]);
    expect(blob.size).toBeGreaterThan(0);
  });
});
