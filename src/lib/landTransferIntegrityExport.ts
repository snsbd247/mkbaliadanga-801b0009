// Excel / PDF export for the Land Transfer Integrity report.
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import type { IntegrityViolation, IntegritySummary } from "./landTransferIntegrity";

const HEADERS = ["#", "Severity", "Code", "Transfer ID", "Farmer ID", "Recipient", "Issue (EN)"];

function toRows(violations: IntegrityViolation[]): (string | number)[][] {
  return violations.map((v, i) => [
    i + 1,
    v.severity,
    v.code,
    v.transfer_id,
    v.farmer_id ?? "",
    v.recipient_farmer_id ?? v.recipient_id ?? "",
    v.message_en,
  ]);
}

function summaryRows(summary: IntegritySummary | null): (string | number)[][] {
  if (!summary) return [];
  return [
    ["Total transfers", summary.total],
    ["With recipients", summary.withRecipients],
    ["Errors", summary.errors],
    ["Warnings", summary.warnings],
    ["All OK", summary.allOk ? "YES" : "NO"],
  ];
}

const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

export function exportIntegrityExcel(
  violations: IntegrityViolation[],
  summary: IntegritySummary | null,
) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...toRows(violations)]);
  XLSX.utils.book_append_sheet(wb, ws, "Violations");
  const sws = XLSX.utils.aoa_to_sheet([["Metric", "Value"], ...summaryRows(summary)]);
  XLSX.utils.book_append_sheet(wb, sws, "Summary");
  XLSX.writeFile(wb, `land-transfer-integrity-${stamp()}.xlsx`);
}

export function exportIntegrityPdf(
  violations: IntegrityViolation[],
  summary: IntegritySummary | null,
) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text("Land Transfer Integrity Report", 14, 16);
  doc.setFontSize(10);
  doc.text(new Date().toLocaleString(), 14, 22);

  if (summary) {
    autoTable(doc, {
      startY: 28,
      head: [["Metric", "Value"]],
      body: summaryRows(summary).map((r) => r.map(String)),
      theme: "grid",
      styles: { fontSize: 9 },
      tableWidth: 90,
    });
  }

  autoTable(doc, {
    startY: (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 8 : 28,
    head: [HEADERS],
    body: toRows(violations).map((r) => r.map(String)),
    theme: "striped",
    styles: { fontSize: 7, cellWidth: "wrap" },
    headStyles: { fillColor: [30, 64, 90] },
  });

  doc.save(`land-transfer-integrity-${stamp()}.pdf`);
}
