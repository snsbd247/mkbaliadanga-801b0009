import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, FileSpreadsheet, Download, Eye, Search } from "lucide-react";
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
  land_type: string;
  acre_rate: number | null;
  bigha_rate: number | null;
  due: number;
  irrigation: number;
  maintenance: number;
  canal: number;
  delay_fee: number;
  current_collected: number;
  previous_collected: number;
  cancelled: boolean;
};

const money = (v: number) => Number(v || 0).toLocaleString("bn-BD", { maximumFractionDigits: 2 });

export function PaidLandHistory({ farmerId }: Props) {
  const { t, tx } = useLang();
  const [rows, setRows] = useState<PaidRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [farmer, setFarmer] = useState<any>(null);
  const [office, setOffice] = useState<any>(null);

  // Filters
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Preview
  const [preview, setPreview] = useState<PaidRow | null>(null);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [farmerId]);

  async function load() {
    setLoading(true);
    const [{ data }, { data: f }] = await Promise.all([
      supabase
        .from("irrigation_invoice_payments")
        .select(
          "collected_amount, irrigation_collected, maintenance_collected, canal_collected, delay_fee_collected, current_invoice_collected, previous_due_collected, created_at, " +
          "invoice:irrigation_invoices!inner(invoice_no, farmer_id, lands(dag_no, mouza, land_size), seasons(name,year,type)), " +
          "payment:payments(receipt_no, created_at)"
        )
        .eq("invoice.farmer_id", farmerId)
        .order("created_at", { ascending: false }),
      supabase.from("farmers").select("name_bn,name_en,member_no,farmer_code,father_name,mobile,village,office_id").eq("id", farmerId).maybeSingle(),
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
      irrigation: Number(r.irrigation_collected || 0),
      maintenance: Number(r.maintenance_collected || 0),
      canal: Number(r.canal_collected || 0),
      delay_fee: Number(r.delay_fee_collected || 0),
      current_collected: Number(r.current_invoice_collected || 0),
      previous_collected: Number(r.previous_due_collected || 0),
    }));
    setRows(list);
    setFarmer(f ?? null);
    if (f?.office_id) {
      const { data: o } = await supabase.from("offices").select("name,name_bn").eq("id", f.office_id).maybeSingle();
      setOffice(o ?? null);
    }
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (needle) {
        const hay = `${r.receipt_no} ${r.season} ${r.dag_no} ${r.mouza} ${r.invoice_no} ${farmer?.name_bn ?? ""} ${farmer?.name_en ?? ""} ${farmer?.member_no ?? ""} ${office?.name ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      const d = r.paid_on ? r.paid_on.slice(0, 10) : "";
      if (from && (!d || d < from)) return false;
      if (to && (!d || d > to)) return false;
      return true;
    });
  }, [rows, q, from, to, farmer, office]);

  const total = filtered.reduce((s, r) => s + r.amount, 0);

  // ১.৯ — receipt download শুধুমাত্র payment হওয়া সারির জন্য (এই তালিকার সব সারিই পরিশোধিত)।
  async function downloadReceipt(r: PaidRow) {
    if (!r.receipt_no || r.receipt_no === "—") {
      toast.error(tx("No receipt available for download.", "ডাউনলোডের জন্য কোনো রসিদ নেই।"));
      return;
    }
    try {
      const branding = await loadBranding().catch(() => null as any);
      await downloadBnReceiptPdf({
        kind: "irrigation",
        receipt_no: r.receipt_no,
        date: r.paid_on ?? new Date().toISOString(),
        bill_info: r.season,
        company_name_bn: branding?.company_name_bn ?? office?.name_bn ?? null,
        company_name: branding?.company_name ?? office?.name ?? undefined,
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
        current_season_charge: r.irrigation || null,
        maintenance_charge: r.maintenance || null,
        canal_charge: r.canal || null,
        penalty_amount: r.delay_fee || null,
        collected_from_outstanding: r.previous_collected || null,
        collected_amount: r.amount,
        verify_url: `${window.location.origin}/r/${r.receipt_no}`,
      }, "farmer");
    } catch (e: any) {
      toast.error(e?.message ?? tx("Receipt download failed", "রসিদ ডাউনলোড ব্যর্থ"));
    }
  }

  function exportExcel() {
    const ws = XLSX.utils.aoa_to_sheet([
      [tx("Season", "সিজন"), tx("Receipt No", "রসিদ নং"), tx("Dag No", "দাগ নং"), tx("Mouza", "মৌজা"), tx("Land (shotok)", "জমি (শতক)"), tx("Collection Date", "আদায়ের তারিখ"), tx("Amount", "পরিমাণ")],
      ...filtered.map((r) => [r.season, r.receipt_no, r.dag_no, r.mouza, r.land_size ?? "", r.paid_on ? fmtDate(r.paid_on) : "", r.amount]),
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
      body: filtered.map((r) => [r.season, r.receipt_no, r.dag_no, r.mouza, r.land_size ?? "", r.paid_on ? fmtDate(r.paid_on) : "", r.amount.toFixed(2)]),
      foot: [["", "", "", "", "", "Total", total.toFixed(2)]],
    });
    doc.save(`paid-history-${farmerId.slice(0, 8)}.pdf`);
  }

  return (
    <Card>
      <div className="flex items-center justify-between p-3 border-b gap-2 flex-wrap">
        <div className="text-sm text-muted-foreground">{tx("Paid History", "পরিশোধিত হিস্ট্রি")}</div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={filtered.length === 0} onClick={exportPdf}>
            <FileText className="h-4 w-4 mr-1" />PDF
          </Button>
          <Button size="sm" variant="outline" disabled={filtered.length === 0} onClick={exportExcel}>
            <FileSpreadsheet className="h-4 w-4 mr-1" />Excel
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 p-3 border-b bg-muted/30">
        <div className="flex-1 min-w-[180px]">
          <Label className="text-xs">{tx("Search (receipt / farmer / office / dag / mouza)", "খুঁজুন (রসিদ / কৃষক / অফিস / দাগ / মৌজা)")}</Label>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
            <Input className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx("Type to filter…", "ফিল্টার করতে লিখুন…")} />
          </div>
        </div>
        <div>
          <Label className="text-xs">{tx("From", "শুরু")}</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">{tx("To", "শেষ")}</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        {(q || from || to) && (
          <Button size="sm" variant="ghost" onClick={() => { setQ(""); setFrom(""); setTo(""); }}>
            {tx("Clear", "মুছুন")}
          </Button>
        )}
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
          {filtered.map((r, i) => (
            <TableRow key={i}>
              <TableCell>{r.season}</TableCell>
              <TableCell>{r.receipt_no}</TableCell>
              <TableCell>{r.dag_no}</TableCell>
              <TableCell>{r.mouza}</TableCell>
              <TableCell className="text-right">{r.land_size ?? "—"}</TableCell>
              <TableCell>{r.paid_on ? fmtDate(r.paid_on) : "—"}</TableCell>
              <TableCell className="text-right">{r.amount.toFixed(2)}</TableCell>
              <TableCell className="text-right whitespace-nowrap">
                <Button size="sm" variant="ghost" title={tx("Preview", "প্রিভিউ")} onClick={() => setPreview(r)}>
                  <Eye className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" title={tx("Download", "ডাউনলোড")} onClick={() => downloadReceipt(r)}>
                  <Download className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {!loading && filtered.length === 0 && (
            <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">{t("noData")}</TableCell></TableRow>
          )}
          {filtered.length > 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-right font-semibold">{tx("Total", "মোট")}</TableCell>
              <TableCell className="text-right font-semibold">{total.toFixed(2)}</TableCell>
              <TableCell />
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Per-row print preview before download */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{tx("Receipt Preview", "রসিদ প্রিভিউ")}</DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="text-sm space-y-2">
              <div className="text-center font-semibold">{office?.name_bn || office?.name || branding_fallback()}</div>
              <div className="text-center text-muted-foreground">{tx("Irrigation Receipt", "সেচ রসিদ")}</div>
              <div className="flex justify-between"><span>{tx("Receipt No", "রসিদ নং")}</span><span className="font-medium">{preview.receipt_no}</span></div>
              <div className="flex justify-between"><span>{tx("Date", "তারিখ")}</span><span>{preview.paid_on ? fmtDate(preview.paid_on) : "—"}</span></div>
              <div className="flex justify-between"><span>{tx("Farmer", "কৃষক")}</span><span>{farmer?.name_bn || farmer?.name_en || "—"}</span></div>
              <div className="flex justify-between"><span>{tx("Member No", "সদস্য নং")}</span><span>{farmer?.member_no ?? farmer?.farmer_code ?? "—"}</span></div>
              <div className="flex justify-between"><span>{tx("Season", "সিজন")}</span><span>{preview.season}</span></div>
              <div className="flex justify-between"><span>{tx("Dag / Mouza", "দাগ / মৌজা")}</span><span>{preview.dag_no} / {preview.mouza}</span></div>
              <div className="flex justify-between"><span>{tx("Land (shotok)", "জমি (শতক)")}</span><span>{preview.land_size ?? "—"}</span></div>
              <hr />
              <div className="font-medium">{tx("Payment breakdown", "পেমেন্ট বিভাজন")}</div>
              <div className="flex justify-between"><span>{tx("Irrigation", "সেচ")}</span><span>{money(preview.irrigation)}</span></div>
              <div className="flex justify-between"><span>{tx("Maintenance", "রক্ষণাবেক্ষণ")}</span><span>{money(preview.maintenance)}</span></div>
              <div className="flex justify-between"><span>{tx("Canal", "নালা")}</span><span>{money(preview.canal)}</span></div>
              <div className="flex justify-between"><span>{tx("Delay fee", "বিলম্ব ফি")}</span><span>{money(preview.delay_fee)}</span></div>
              <div className="flex justify-between"><span>{tx("From previous due", "পূর্বের বকেয়া থেকে")}</span><span>{money(preview.previous_collected)}</span></div>
              <hr />
              <div className="flex justify-between font-semibold"><span>{tx("Total collected", "মোট আদায়")}</span><span>{money(preview.amount)}</span></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreview(null)}>{tx("Close", "বন্ধ")}</Button>
            <Button onClick={() => preview && downloadReceipt(preview)}>
              <Download className="h-4 w-4 mr-1" />{tx("Download PDF", "পিডিএফ ডাউনলোড")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );

  function branding_fallback() {
    return "";
  }
}
