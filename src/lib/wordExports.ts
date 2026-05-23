/**
 * Lightweight "Word" export — emits an HTML file with a .doc extension
 * that opens cleanly in MS Word, Google Docs (via upload), and LibreOffice.
 * No external dependency, supports Bangla via system fonts.
 */
import { loadBranding } from "./branding";

function escapeHtml(v: any): string {
  if (v === null || v === undefined) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function download(filename: string, html: string) {
  const blob = new Blob(
    ["\ufeff", html],
    { type: "application/msword;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface WordTableOptions {
  range?: { from?: string | null; to?: string | null };
  summary?: Array<{ label: string; value: string | number }>;
  filename?: string;
}

export async function exportTableDoc(
  title: string,
  headers: string[],
  rows: Array<Array<string | number>>,
  opts: WordTableOptions = {},
): Promise<void> {
  const brand = await loadBranding().catch(() => null);
  const period = opts.range?.from || opts.range?.to
    ? `${opts.range?.from ?? ""} → ${opts.range?.to ?? ""}`
    : "";
  const summaryRows = (opts.summary ?? [])
    .map(
      (s) =>
        `<tr><td style="padding:4px 8px;border:1px solid #ccc"><b>${escapeHtml(s.label)}</b></td><td style="padding:4px 8px;border:1px solid #ccc;text-align:right">${escapeHtml(s.value)}</td></tr>`,
    )
    .join("");
  const head =
    "<tr>" +
    headers
      .map(
        (h) =>
          `<th style="padding:6px 8px;border:1px solid #999;background:#eef">${escapeHtml(h)}</th>`,
      )
      .join("") +
    "</tr>";
  const body = rows
    .map(
      (r) =>
        "<tr>" +
        r
          .map(
            (c) =>
              `<td style="padding:4px 8px;border:1px solid #ccc">${escapeHtml(c)}</td>`,
          )
          .join("") +
        "</tr>",
    )
    .join("");

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: "Nirmala UI", "SolaimanLipi", Arial, sans-serif; font-size: 11pt; color:#111; }
  h1 { font-size: 16pt; margin:0; text-align:center; }
  h2 { font-size: 13pt; margin:8px 0; text-align:center; }
  .meta { text-align:center; color:#555; font-size: 9pt; margin-bottom: 10px; }
  table { width:100%; border-collapse: collapse; margin-top: 8px; }
</style>
</head>
<body>
  <h1>${escapeHtml(brand?.company_name || "Report")}</h1>
  ${brand?.address ? `<div class="meta">${escapeHtml(brand.address)}</div>` : ""}
  <h2>${escapeHtml(title)}</h2>
  ${period ? `<div class="meta">Period: ${escapeHtml(period)}</div>` : ""}
  ${summaryRows ? `<table>${summaryRows}</table>` : ""}
  <table><thead>${head}</thead><tbody>${body}</tbody></table>
  <div class="meta" style="margin-top:14px">Printed: ${new Date().toLocaleString()}</div>
</body>
</html>`;
  const fname =
    opts.filename ||
    `${title.replace(/[^a-z0-9\-_ ]/gi, "_")}-${new Date().toISOString().slice(0, 10)}.doc`;
  download(fname, html);
}
