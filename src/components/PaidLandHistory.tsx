import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, FileSpreadsheet } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { fmtDate } from "@/lib/format";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

interface Props { farmerId: string; }

type PaidRow = {
  season: string;
  invoice_no: string;
  receipt_no: string;
  paid_on: string | null;
  amount: number;
};

export function PaidLandHistory({ farmerId }: Props) {
  const { t, tx } = useLang();
  const [rows, setRows] = useState<PaidRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [farmerId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("irrigation_invoice_payments")
      .select(
        "collected_amount, created_at, " +
        "invoice:irrigation_invoices!inner(invoice_no, farmer_id, seasons(name,year,type)), " +
        "payment:payments(receipt_no, created_at)"
      )
      .eq("invoice.farmer_id", farmerId)
      .order("created_at", { ascending: false });
    const list: PaidRow[] = (data ?? []).map((r: any) => ({
      season: r.invoice?.seasons ? `${r.invoice.seasons.name ?? r.invoice.seasons.type ?? ""} ${r.invoice.seasons.year ?? ""}`.trim() : "—",
      invoice_no: r.invoice?.invoice_no ?? "—",
      receipt_no: r.payment?.receipt_no ?? "—",
      paid_on: r.payment?.created_at ?? r.created_at ?? null,
      amount: Number(r.collected_amount || 0),
    }));
    setRows(list);
    setLoading(false);
  }

  const total = rows.reduce((s, r) => s + r.amount, 0);

  function exportExcel() {
    const ws = XLSX.utils.aoa_to_sheet([
      [tx("Season", "সিজন"), tx("Invoice No", "ইনভয়েস নং"), tx("Receipt No", "রসিদ নং"), tx("Payment Date", "পেমেন্ট তারিখ"), tx("Amount", "পরিমাণ")],
      ...rows.map((r) => [r.season, r.invoice_no, r.receipt_no, r.paid_on ? fmtDate(r.paid_on) : "", r.amount]),
      ["", "", "", tx("Total", "মোট"), total],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Paid Land History");
    XLSX.writeFile(wb, `paid-land-history-${farmerId.slice(0, 8)}.xlsx`);
  }

  function exportPdf() {
    const doc = new jsPDF();
    doc.text("Paid Land History", 14, 16);
    autoTable(doc, {
      startY: 22,
      head: [["Season", "Invoice No", "Receipt No", "Payment Date", "Amount"]],
      body: rows.map((r) => [r.season, r.invoice_no, r.receipt_no, r.paid_on ? fmtDate(r.paid_on) : "", r.amount.toFixed(2)]),
      foot: [["", "", "", "Total", total.toFixed(2)]],
    });
    doc.save(`paid-land-history-${farmerId.slice(0, 8)}.pdf`);
  }

  return (
    <Card>
      <div className="flex items-center justify-between p-3 border-b gap-2 flex-wrap">
        <div className="text-sm text-muted-foreground">{tx("Paid Land History", "পরিশোধিত জমির হিস্ট্রি")}</div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={rows.length === 0} onClick={exportPdf}>
            <FileText className="h-4 w-4 mr-1" />PDF
          </Button>
          <Button size="sm" variant="outline" disabled={rows.length === 0} onClick={exportExcel}>
            <FileSpreadsheet className="h-4 w-4 mr-1" />Excel
          </Button>
        </div>
      </div>
      <Table>
        <TableHeader><TableRow>
          <TableHead>{tx("Season", "সিজন")}</TableHead>
          <TableHead>{tx("Invoice No", "ইনভয়েস নং")}</TableHead>
          <TableHead>{tx("Receipt No", "রসিদ নং")}</TableHead>
          <TableHead>{tx("Payment Date", "পেমেন্ট তারিখ")}</TableHead>
          <TableHead className="text-right">{tx("Amount", "পরিমাণ")}</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              <TableCell>{r.season}</TableCell>
              <TableCell>{r.invoice_no}</TableCell>
              <TableCell>{r.receipt_no}</TableCell>
              <TableCell>{r.paid_on ? fmtDate(r.paid_on) : "—"}</TableCell>
              <TableCell className="text-right">{r.amount.toFixed(2)}</TableCell>
            </TableRow>
          ))}
          {!loading && rows.length === 0 && (
            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">{t("noData")}</TableCell></TableRow>
          )}
          {rows.length > 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-right font-semibold">{tx("Total", "মোট")}</TableCell>
              <TableCell className="text-right font-semibold">{total.toFixed(2)}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
