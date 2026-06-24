import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, FileSpreadsheet, Download } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { downloadBnReceiptPdf } from "@/lib/bnReceipts";
import { loadBranding } from "@/lib/branding";
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
  dag_no: string;
  mouza: string;
  land_size: number | null;
};

export function PaidLandHistory({ farmerId }: Props) {
  const { t, tx } = useLang();
  const [rows, setRows] = useState<PaidRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [farmer, setFarmer] = useState<any>(null);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [farmerId]);

  async function load() {
    setLoading(true);
    const [{ data }, { data: f }] = await Promise.all([
      supabase
        .from("irrigation_invoice_payments")
        .select(
          "collected_amount, created_at, " +
          "invoice:irrigation_invoices!inner(invoice_no, farmer_id, lands(dag_no, mouza, land_size), seasons(name,year,type)), " +
          "payment:payments(receipt_no, created_at)"
        )
        .eq("invoice.farmer_id", farmerId)
        .order("created_at", { ascending: false }),
      supabase.from("farmers").select("name_bn,name_en,member_no,farmer_code,father_name,mobile,village").eq("id", farmerId).maybeSingle(),
    ]);
    const list: PaidRow[] = (data ?? []).map((r: any) => ({
      season: r.invoice?.seasons ? `${r.invoice.seasons.name ?? r.invoice.seasons.type ?? ""} ${r.invoice.seasons.year ?? ""}`.trim() : "—",
      invoice_no: r.invoice?.invoice_no ?? "—",
      receipt_no: r.payment?.receipt_no ?? "—",
      paid_on: r.payment?.created_at ?? r.created_at ?? null,
      amount: Number(r.collected_amount || 0),
      dag_no: r.invoice?.lands?.dag_no ?? "—",
      mouza: r.invoice?.lands?.mouza ?? "—",
      land_size: r.invoice?.lands?.land_size != null ? Number(r.invoice.lands.land_size) : null,
    }));
    setRows(list);
    setFarmer(f ?? null);
    setLoading(false);
  }

  const total = rows.reduce((s, r) => s + r.amount, 0);

  // ১.৯ — শুধুমাত্র payment হওয়ার পর (অর্থাৎ এই Paid History সারিগুলোর) receipt download করা যাবে।
  async function downloadReceipt(r: PaidRow) {
    if (!r.receipt_no || r.receipt_no === "—") {
      toast.error(tx("No receipt available for download.", "ডাউনলোডের জন্য কোনো রসিদ নেই।"));
      return;
    }
    try {
      const branding = await loadBranding().catch(() => null as any);
      await downloadBnReceiptPdf({
        kind: "IRR",
        receipt_no: r.receipt_no,
        date: r.paid_on ?? new Date().toISOString(),
        company_name_bn: branding?.company_name_bn ?? null,
        company_name: branding?.company_name ?? undefined,
        logo_url: branding?.logo_url ?? null,
        farmer: {
          name: farmer?.name_bn || farmer?.name_en || "—",
          member_no: farmer?.member_no ?? farmer?.farmer_code ?? null,
          father_or_husband: farmer?.father_name ?? null,
          village: farmer?.village ?? null,
          mobile: farmer?.mobile ?? null,
          mouza: r.mouza !== "—" ? r.mouza : null,
          land_size: r.land_size,
          dag_no: r.dag_no !== "—" ? r.dag_no : null,
        },
        collected_amount: r.amount,
        verify_url: `${window.location.origin}/r/${r.receipt_no}`,
      });
    } catch (e: any) {
      toast.error(e?.message ?? tx("Receipt download failed", "রসিদ ডাউনলোড ব্যর্থ"));
    }
  }

  function exportExcel() {
    const ws = XLSX.utils.aoa_to_sheet([
      [tx("Season", "সিজন"), tx("Receipt No", "রসিদ নং"), tx("Dag No", "দাগ নং"), tx("Mouza", "মৌজা"), tx("Land (shotok)", "জমি (শতক)"), tx("Collection Date", "আদায়ের তারিখ"), tx("Amount", "পরিমাণ")],
      ...rows.map((r) => [r.season, r.receipt_no, r.dag_no, r.mouza, r.land_size ?? "", r.paid_on ? fmtDate(r.paid_on) : "", r.amount]),
      ["", "", "", "", "", tx("Total", "মোট"), total],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Paid History");
    XLSX.writeFile(wb, `paid-history-${farmerId.slice(0, 8)}.xlsx`);
  }

  function exportPdf() {
    const doc = new jsPDF();
    doc.text("Paid History", 14, 16);
    autoTable(doc, {
      startY: 22,
      head: [["Season", "Receipt No", "Dag", "Mouza", "Land", "Collection Date", "Amount"]],
      body: rows.map((r) => [r.season, r.receipt_no, r.dag_no, r.mouza, r.land_size ?? "", r.paid_on ? fmtDate(r.paid_on) : "", r.amount.toFixed(2)]),
      foot: [["", "", "", "", "", "Total", total.toFixed(2)]],
    });
    doc.save(`paid-history-${farmerId.slice(0, 8)}.pdf`);
  }

  return (
    <Card>
      <div className="flex items-center justify-between p-3 border-b gap-2 flex-wrap">
        <div className="text-sm text-muted-foreground">{tx("Paid History", "পরিশোধিত হিস্ট্রি")}</div>
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
          <TableHead>{tx("Receipt No", "রসিদ নং")}</TableHead>
          <TableHead>{tx("Dag No", "দাগ নং")}</TableHead>
          <TableHead>{tx("Mouza", "মৌজা")}</TableHead>
          <TableHead className="text-right">{tx("Land (shotok)", "জমি (শতক)")}</TableHead>
          <TableHead>{tx("Collection Date", "আদায়ের তারিখ")}</TableHead>
          <TableHead className="text-right">{tx("Amount", "পরিমাণ")}</TableHead>
          <TableHead className="text-right">{tx("Receipt", "রসিদ")}</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              <TableCell>{r.season}</TableCell>
              <TableCell>{r.receipt_no}</TableCell>
              <TableCell>{r.dag_no}</TableCell>
              <TableCell>{r.mouza}</TableCell>
              <TableCell className="text-right">{r.land_size ?? "—"}</TableCell>
              <TableCell>{r.paid_on ? fmtDate(r.paid_on) : "—"}</TableCell>
              <TableCell className="text-right">{r.amount.toFixed(2)}</TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="ghost" onClick={() => downloadReceipt(r)}>
                  <Download className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {!loading && rows.length === 0 && (
            <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">{t("noData")}</TableCell></TableRow>
          )}
          {rows.length > 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-right font-semibold">{tx("Total", "মোট")}</TableCell>
              <TableCell className="text-right font-semibold">{total.toFixed(2)}</TableCell>
              <TableCell />
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
