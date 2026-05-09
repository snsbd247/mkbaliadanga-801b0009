// Centralized irrigation invoice export utilities (CSV + XLSX) including
// snapshot data and manual-rate flags. Phase 3 — i18n cleanup & enrichment.
import * as XLSX from "xlsx";
import { formatDagNumbers } from "@/lib/dagNumbers";

export const IRR_BN = {
  invoiceNo: "ইনভয়েস নং",
  farmer: "কৃষক",
  farmerCode: "কৃষক কোড",
  mobile: "মোবাইল",
  mouza: "মৌজা",
  dag: "দাগ নং",
  landSize: "জমির পরিমাণ",
  landType: "জমির ধরন",
  season: "সিজন",
  year: "বছর",
  rate: "প্রতি ইউনিট রেট",
  baseAmount: "মূল চার্জ",
  lateFee: "বিলম্ব ফি",
  maintenance: "রক্ষণাবেক্ষণ চার্জ",
  payable: "প্রদেয়",
  paid: "পরিশোধিত",
  due: "বকেয়া",
  status: "স্ট্যাটাস",
  generatedAt: "ইস্যু তারিখ",
  dueDate: "মেয়াদ",
  isManual: "ম্যানুয়াল রেট",
  manualReason: "ম্যানুয়াল কারণ",
  recalculated: "পুনঃগণনা",
  borga: "বর্গা",
};

const STATUS_BN: Record<string, string> = {
  draft: "খসড়া", generated: "ইস্যু", partial_paid: "আংশিক",
  paid: "পরিশোধিত", overdue: "মেয়াদোত্তীর্ণ", cancelled: "বাতিল",
};

function flatten(inv: any) {
  const snap = inv.calculation_snapshot ?? {};
  return {
    [IRR_BN.invoiceNo]: inv.invoice_no ?? "",
    [IRR_BN.farmer]: inv.farmers?.name_bn ?? inv.farmers?.name_en ?? "",
    [IRR_BN.farmerCode]: inv.farmers?.farmer_code ?? "",
    [IRR_BN.mobile]: inv.farmers?.mobile ?? "",
    [IRR_BN.mouza]: inv.lands?.mouza ?? "",
    [IRR_BN.dag]: formatDagNumbers(inv.lands?.dag_no),
    [IRR_BN.landSize]: inv.lands?.land_size ?? "",
    [IRR_BN.landType]: inv.land_type_name ?? snap.land_type_name ?? "",
    [IRR_BN.season]: inv.seasons?.name ?? inv.seasons?.type ?? "",
    [IRR_BN.year]: inv.seasons?.year ?? "",
    [IRR_BN.rate]: inv.season_rate ?? snap.rate ?? "",
    [IRR_BN.baseAmount]: snap.base_amount ?? inv.base_amount ?? "",
    [IRR_BN.lateFee]: inv.late_fee ?? snap.late_fee ?? 0,
    [IRR_BN.maintenance]: inv.maintenance_fee ?? snap.maintenance_fee ?? 0,
    [IRR_BN.payable]: inv.payable_amount ?? "",
    [IRR_BN.paid]: inv.paid_amount ?? 0,
    [IRR_BN.due]: inv.due_amount ?? 0,
    [IRR_BN.status]: STATUS_BN[inv.invoice_status] ?? inv.invoice_status ?? "",
    [IRR_BN.generatedAt]: inv.generated_at ? new Date(inv.generated_at).toLocaleDateString() : "",
    [IRR_BN.dueDate]: inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "",
    [IRR_BN.isManual]: inv.is_manual_rate ? "হ্যাঁ" : "না",
    [IRR_BN.manualReason]: inv.manual_rate_reason ?? "",
    [IRR_BN.recalculated]: inv.recalculated_at ? new Date(inv.recalculated_at).toLocaleString() : "",
    [IRR_BN.borga]: inv.is_borga ? "হ্যাঁ" : "না",
  };
}

export function exportInvoicesXLSX(invoices: any[], filename = "irrigation-invoices.xlsx") {
  const rows = invoices.map(flatten);
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Invoices");
  XLSX.writeFile(wb, filename);
}

export function exportInvoicesCSV(invoices: any[], filename = "irrigation-invoices.csv") {
  const rows = invoices.map(flatten);
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
