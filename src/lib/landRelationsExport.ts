import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export type LandRelationExportRow = {
  // Land + location
  dag_no?: string | null;
  land_size?: number | null;
  mouza?: string | null;
  mouza_name?: string | null;
  division_name?: string | null;
  district_name?: string | null;
  upazila_name?: string | null;
  union_name?: string | null;
  ward_name?: string | null;
  village_name?: string | null;
  // Owner / sharecropper
  owner_name?: string | null;
  owner_account?: string | null;
  sc_name?: string | null;
  sc_account?: string | null;
  share_percentage?: number | null;
  valid_from?: string | null;
  valid_to?: string | null;
  status?: "active" | "historic" | string | null;
};

const LOC_KEYS = ["division_name", "district_name", "upazila_name", "union_name", "ward_name", "village_name", "mouza_name"] as const;

function buildLocation(r: LandRelationExportRow): string {
  const chain = LOC_KEYS.map((k) => r[k]).filter(Boolean);
  if (chain.length === 0 && r.mouza) return r.mouza;
  return chain.join(" › ");
}

const headers = ["#", "Location", "Dag No", "Size", "Owner", "Sharecropper", "Share %", "Valid From", "Valid To", "Status"];

function rows(list: LandRelationExportRow[]): (string | number)[][] {
  return list.map((r, i) => [
    i + 1,
    buildLocation(r) || "-",
    r.dag_no ?? "-",
    r.land_size ?? 0,
    r.owner_name ? `${r.owner_name}${r.owner_account ? ` (${r.owner_account})` : ""}` : "-",
    r.sc_name ? `${r.sc_name}${r.sc_account ? ` (${r.sc_account})` : ""}` : "-",
    r.share_percentage ?? 0,
    r.valid_from ?? "-",
    r.valid_to ?? "-",
    r.status ?? (r.valid_to ? "historic" : "active"),
  ]);
}

export function exportLandRelationsPdf(title: string, list: LandRelationExportRow[]) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(14);
  doc.text(`Land Relations — ${title}`, 40, 40);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 40, 56);
  autoTable(doc, {
    head: [headers],
    body: rows(list),
    startY: 72,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [31, 78, 121] },
    columnStyles: { 0: { cellWidth: 24 }, 1: { cellWidth: 240 } },
  });
  doc.save(`land-relations-${Date.now()}.pdf`);
}

export function exportLandRelationsExcel(title: string, list: LandRelationExportRow[]) {
  const wb = XLSX.utils.book_new();
  const data = [["Land Relations", title], [], headers, ...rows(list)];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [{ wch: 4 }, { wch: 50 }, { wch: 10 }, { wch: 8 }, { wch: 28 }, { wch: 28 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws, "LandRelations");
  XLSX.writeFile(wb, `land-relations-${Date.now()}.xlsx`);
}
