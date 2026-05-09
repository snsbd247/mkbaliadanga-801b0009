import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { shatakToBigha } from "./irrigationCalc";

export type LandExportRow = {
  division_name?: string | null;
  district_name?: string | null;
  upazila_name?: string | null;
  union_name?: string | null;
  ward_name?: string | null;
  village_name?: string | null;
  mouza_name?: string | null;
  mouza?: string | null; // legacy text fallback
  dag_no?: string | null;
  land_size?: number | null;
  owner_type?: string | null;
  field_type?: string | null;
};

export type FarmerHeader = {
  name_en: string;
  account_number?: string | null;
  farmer_code: string;
};

const LOCATION_KEYS = ["division_name", "district_name", "upazila_name", "union_name", "ward_name", "village_name", "mouza_name"] as const;

function buildLocation(r: LandExportRow): string {
  const chain = LOCATION_KEYS.map((k) => r[k]).filter(Boolean);
  if (chain.length === 0 && r.mouza) return r.mouza;
  return chain.join(" › ");
}

const headers = ["#", "Location", "Mouza", "Dag No", "Bigha", "Shatak", "Owner Type", "Field Type"];

function rows(lands: LandExportRow[]): (string | number)[][] {
  return lands.map((l, i) => {
    const sh = Number(l.land_size ?? 0);
    return [
      i + 1,
      buildLocation(l) || "-",
      l.mouza_name ?? l.mouza ?? "-",
      l.dag_no ?? "-",
      Number(shatakToBigha(sh).toFixed(2)),
      Number(sh.toFixed(2)),
      l.owner_type ?? "-",
      l.field_type ?? "-",
    ];
  });
}

export function exportLandsPdf(farmer: FarmerHeader, lands: LandExportRow[]) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(14);
  doc.text(`Lands — ${farmer.name_en}`, 40, 40);
  doc.setFontSize(10);
  doc.text(`Account: ${farmer.account_number ?? farmer.farmer_code}`, 40, 58);
  autoTable(doc, {
    head: [headers],
    body: rows(lands),
    startY: 75,
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [31, 78, 121] },
    columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 280 } },
  });
  doc.save(`lands-${farmer.account_number ?? farmer.farmer_code}.pdf`);
}

export function exportLandsExcel(farmer: FarmerHeader, lands: LandExportRow[]) {
  const wb = XLSX.utils.book_new();
  const meta = [["Farmer", farmer.name_en], ["Account No", farmer.account_number ?? farmer.farmer_code], []];
  const data = [...meta, headers, ...rows(lands)];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [{ wch: 4 }, { wch: 60 }, { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws, "Lands");
  XLSX.writeFile(wb, `lands-${farmer.account_number ?? farmer.farmer_code}.xlsx`);
}
