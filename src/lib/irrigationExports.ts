// Centralized irrigation invoice export utilities (CSV + XLSX) including
// snapshot data and manual-rate flags. Phase 3 — i18n cleanup & enrichment.
import * as XLSX from "xlsx";
import { parseDagNumbers } from "@/lib/dagNumbers";
import { getReceiptLayoutSettings, dagSeparatorString } from "@/lib/receiptLayoutSettings";
import { roundTaka } from "@/lib/rounding";

const r = (v: any) => (v === "" || v === null || v === undefined) ? v : roundTaka(Number(v));

type Lang = "en" | "bn";

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
  rateSource: "রেট উৎস",
  category: "ক্যাটেগরি",
  appliedRate: "প্রযোজ্য রেট",
  standardRate: "মানক রেট",
  overrideReason: "ওভাররাইড কারণ",
};

export const IRR_EN: typeof IRR_BN = {
  invoiceNo: "Invoice No",
  farmer: "Farmer",
  farmerCode: "Farmer Code",
  mobile: "Mobile",
  mouza: "Mouza",
  dag: "Dag No",
  landSize: "Land Size",
  landType: "Land Type",
  season: "Season",
  year: "Year",
  rate: "Rate / Unit",
  baseAmount: "Base Amount",
  lateFee: "Late Fee",
  maintenance: "Maintenance",
  payable: "Payable",
  paid: "Paid",
  due: "Due",
  status: "Status",
  generatedAt: "Generated At",
  dueDate: "Due Date",
  isManual: "Manual Rate",
  manualReason: "Manual Reason",
  recalculated: "Recalculated",
  borga: "Borga",
  rateSource: "Rate Source",
  category: "Category",
  appliedRate: "Applied Rate",
  standardRate: "Standard Rate",
  overrideReason: "Override Reason",
};

const STATUS_BN: Record<string, string> = {
  draft: "খসড়া", generated: "ইস্যু", partial_paid: "আংশিক",
  paid: "পরিশোধিত", overdue: "মেয়াদোত্তীর্ণ", cancelled: "বাতিল",
};
const STATUS_EN: Record<string, string> = {
  draft: "Draft", generated: "Generated", partial_paid: "Partial",
  paid: "Paid", overdue: "Overdue", cancelled: "Cancelled",
};

export function flattenInvoiceForExport(inv: any, lang: Lang = "bn") {
  const snap = inv.calculation_snapshot ?? {};
  const L = lang === "en" ? IRR_EN : IRR_BN;
  const status = lang === "en" ? STATUS_EN : STATUS_BN;
  const yes = lang === "en" ? "Yes" : "হ্যাঁ";
  const no = lang === "en" ? "No" : "না";
  const locale = lang === "en" ? "en-GB" : "bn-BD";
  return {
    [L.invoiceNo]: inv.invoice_no ?? "",
    [L.farmer]: (lang === "en" ? inv.farmers?.name_en : inv.farmers?.name_bn) ?? inv.farmers?.name_en ?? inv.farmers?.name_bn ?? "",
    [L.farmerCode]: inv.farmers?.farmer_code ?? "",
    [L.mobile]: inv.farmers?.mobile ?? "",
    [L.mouza]: inv.lands?.mouza ?? "",
    [L.dag]: parseDagNumbers(inv.lands?.dag_no).join(dagSeparatorString(getReceiptLayoutSettings().dagSeparator)),
    [L.landSize]: inv.lands?.land_size ?? "",
    [L.landType]: inv.land_type_name ?? snap.land_type_name ?? "",
    [L.season]: inv.seasons?.name ?? inv.seasons?.type ?? "",
    [L.year]: inv.seasons?.year ?? "",
    [L.rate]: r(inv.season_rate ?? snap.rate ?? ""),
    [L.baseAmount]: r(snap.base_amount ?? inv.base_amount ?? ""),
    [L.lateFee]: r(inv.late_fee ?? snap.late_fee ?? 0),
    [L.maintenance]: r(inv.maintenance_fee ?? snap.maintenance_fee ?? 0),
    [L.payable]: r(inv.payable_amount ?? ""),
    [L.paid]: r(inv.paid_amount ?? 0),
    [L.due]: r(inv.due_amount ?? 0),
    [L.status]: status[inv.invoice_status] ?? inv.invoice_status ?? "",
    [L.generatedAt]: inv.generated_at ? new Date(inv.generated_at).toLocaleDateString(locale) : "",
    [L.dueDate]: inv.due_date ? new Date(inv.due_date).toLocaleDateString(locale) : "",
    [L.isManual]: inv.is_manual_rate ? yes : no,
    [L.manualReason]: inv.manual_rate_reason ?? "",
    [L.recalculated]: inv.recalculated_at ? new Date(inv.recalculated_at).toLocaleString(locale) : "",
    [L.borga]: inv.is_borga ? yes : no,
  };
}

export function exportInvoicesXLSX(invoices: any[], filename = "irrigation-invoices.xlsx", lang: Lang = "bn") {
  const rows = invoices.map((inv) => flattenInvoiceForExport(inv, lang));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Invoices");
  XLSX.writeFile(wb, filename);
}

export function exportInvoicesCSV(invoices: any[], filename = "irrigation-invoices.csv", lang: Lang = "bn") {
  const rows = invoices.map((inv) => flattenInvoiceForExport(inv, lang));
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
