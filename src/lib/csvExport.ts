/**
 * UTF-8 BOM CSV exporter with chunked streaming for large datasets.
 * Compatible with Excel and Bangla text.
 */

export type CsvColumn<T> = {
  header: string;
  accessor: (row: T) => string | number | null | undefined;
};

function escapeCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Build CSV body string (without BOM). Useful for testing/in-memory work. */
export function rowsToCsvString<T>(
  rows: T[],
  columns: CsvColumn<T>[],
  chunkSize = 5000,
): string {
  const out: string[] = [];
  out.push(columns.map((c) => escapeCell(c.header)).join(",") + "\n");
  for (let i = 0; i < rows.length; i += chunkSize) {
    const slice = rows.slice(i, i + chunkSize);
    let buf = "";
    for (const row of slice) {
      buf += columns.map((c) => escapeCell(c.accessor(row))).join(",") + "\n";
    }
    out.push(buf);
  }
  return out.join("");
}

export function rowsToCsvBlob<T>(
  rows: T[],
  columns: CsvColumn<T>[],
  chunkSize = 5000,
): Blob {
  const body = rowsToCsvString(rows, columns, chunkSize);
  // UTF-8 BOM as bytes for Excel compatibility
  const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
  return new Blob([bom, body], { type: "text/csv;charset=utf-8;" });
}

export function downloadCsv<T>(
  filename: string,
  rows: T[],
  columns: CsvColumn<T>[],
): void {
  const blob = rowsToCsvBlob(rows, columns);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
