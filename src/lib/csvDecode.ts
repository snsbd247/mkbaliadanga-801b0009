// Smart decoder for spreadsheet text exports.
// Handles:
//  - UTF-8 (with or without BOM) — "CSV UTF-8 (Comma delimited)"
//  - UTF-16 LE/BE (with BOM) — Excel "Unicode Text (*.txt)" (tab-delimited)
//  - Windows-1252 fallback — legacy "CSV (Comma delimited)" without BOM
//
// Returns a JS string with BOM stripped. The caller can pass the result to
// XLSX.read(text, { type: "string", raw: true }).
export function decodeSpreadsheetBuffer(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);

  // UTF-16 LE BOM: FF FE
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(buf).replace(/^\uFEFF/, "");
  }
  // UTF-16 BE BOM: FE FF
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(buf).replace(/^\uFEFF/, "");
  }
  // UTF-8 BOM: EF BB BF
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(buf).slice(1);
  }
  // Try strict UTF-8, fall back to Windows-1252.
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder("windows-1252").decode(buf);
  }
}
