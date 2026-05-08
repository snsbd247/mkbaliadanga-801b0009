#!/usr/bin/env node
/**
 * Build a PDF + XLSX summary from `test-results/responsive/report.json`.
 *
 * Usage:
 *   node scripts/responsive-report.mjs
 *   # outputs:
 *   #   /mnt/documents/responsive-overlap-report.pdf
 *   #   /mnt/documents/responsive-overlap-report.xlsx
 */
import fs from "node:fs";
import path from "node:path";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

const RESULTS_DIR = path.resolve("test-results/responsive");
const REPORT_JSON = path.join(RESULTS_DIR, "report.json");
const OUT_DIR = process.env.REPORT_OUT_DIR || "/mnt/documents";
fs.mkdirSync(OUT_DIR, { recursive: true });

if (!fs.existsSync(REPORT_JSON)) {
  console.error(`✗ ${REPORT_JSON} missing — run \`npx playwright test e2e/responsive-overlap.spec.ts\` first.`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(REPORT_JSON, "utf8"));
const rows = data.results ?? [];

// ---------- Aggregate ----------
const summary = rows.map((r) => ({
  route: r.route,
  viewport: r.viewport,
  issueCount: r.issues?.length ?? 0,
  hardCount: (r.issues ?? []).filter((i) => i.kind === "viewport-overflow").length,
  screenshot: r.screenshot,
}));
const flagged = summary.filter((r) => r.issueCount > 0);

// ---------- XLSX ----------
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb,
  XLSX.utils.json_to_sheet([
    { Metric: "Generated at", Value: data.generatedAt },
    { Metric: "Auth used", Value: data.hasAuth ? "yes" : "no (public routes only)" },
    { Metric: "Total audited", Value: summary.length },
    { Metric: "Pages with issues", Value: flagged.length },
    { Metric: "Viewport-overflow hits", Value: summary.reduce((a, r) => a + r.hardCount, 0) },
  ]), "Summary");
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "All routes");
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flagged), "Flagged");

const issueRows = [];
for (const r of rows)
  for (const i of r.issues ?? [])
    issueRows.push({ route: r.route, viewport: r.viewport, kind: i.kind, selector: i.selector, detail: i.detail });
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(issueRows), "Issues");

const xlsxPath = path.join(OUT_DIR, "responsive-overlap-report.xlsx");
XLSX.writeFile(wb, xlsxPath);
console.log("✓ XLSX →", xlsxPath);

// ---------- PDF ----------
const pdf = new jsPDF({ unit: "pt", format: "a4" });
pdf.setFontSize(16); pdf.text("Responsive Overlap Audit", 40, 40);
pdf.setFontSize(10);
pdf.text(`Generated: ${data.generatedAt}`, 40, 58);
pdf.text(`Auth: ${data.hasAuth ? "yes" : "public routes only"}`, 40, 72);
pdf.text(`Pages audited: ${summary.length}   Flagged: ${flagged.length}`, 40, 86);

autoTable(pdf, {
  startY: 110,
  head: [["Route", "Viewport", "Issues", "Hard overflow"]],
  body: summary.map((r) => [r.route, r.viewport, r.issueCount, r.hardCount]),
  styles: { fontSize: 8 },
  headStyles: { fillColor: [40, 100, 60] },
});

// Embed up to N flagged screenshots
const MAX_SHOTS = 30;
const shots = flagged.slice(0, MAX_SHOTS);
for (const r of shots) {
  pdf.addPage();
  pdf.setFontSize(12);
  pdf.text(`${r.route}  —  ${r.viewport}  (${r.issueCount} issue${r.issueCount === 1 ? "" : "s"})`, 40, 40);
  const file = path.join(RESULTS_DIR, r.screenshot);
  if (fs.existsSync(file)) {
    try {
      const b64 = "data:image/png;base64," + fs.readFileSync(file).toString("base64");
      pdf.addImage(b64, "PNG", 40, 60, 515, 700, undefined, "FAST");
    } catch (e) {
      pdf.text(`(failed to embed ${r.screenshot}: ${e.message})`, 40, 80);
    }
  } else {
    pdf.text(`(screenshot not found: ${r.screenshot})`, 40, 80);
  }
}

const pdfPath = path.join(OUT_DIR, "responsive-overlap-report.pdf");
pdf.save(pdfPath);
console.log("✓ PDF  →", pdfPath);
