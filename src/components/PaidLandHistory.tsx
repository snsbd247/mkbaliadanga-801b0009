import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { Badge } from "@/components/ui/badge";
import { FileText, FileSpreadsheet, Download, Eye, Search } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { downloadBnReceiptPdf, normalizeIrrigationRatePerAcre, ratePerBighaFromAcre, type BnReceiptData } from "@/lib/bnReceipts";
import { loadBranding, useBranding } from "@/lib/branding";
import { useReceiptRenderArgs } from "@/lib/receiptOptions";
import { fetchPaymentReceiptData } from "@/lib/buildPaymentReceiptData";
import { IrrigationReceiptPreviewDialog } from "@/components/receipts/IrrigationReceiptPreviewDialog";
import { buildMemberSummary } from "@/lib/receiptMemberSummary";
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
  member_summary: string;
  owner_self: boolean;
  land_owner_label: string | null;
  holding_description: string | null;
  patwari_name: string | null;
  patwari_mobile: string | null;
  verify_token: string | null;
  payment_id: string | null;
};

const money = (v: number) => Number(v || 0).toLocaleString("bn-BD", { maximumFractionDigits: 2 });

export function PaidLandHistory({ farmerId }: Props) {
  const { t, tx } = useLang();
  const brand = useBranding();
  const receiptArgs = useReceiptRenderArgs();
  const [rows, setRows] = useState<PaidRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [farmer, setFarmer] = useState<any>(null);
  const [office, setOffice] = useState<any>(null);
  const [unionName, setUnionName] = useState<string | null>(null);

  // Filters
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Preview (canonical receipt render, identical to Payments page)
  const [previewData, setPreviewData] = useState<BnReceiptData | null>(null);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [farmerId]);

  async function load() {
    setLoading(true);
    const [{ data }, { data: f }] = await Promise.all([
      db
        .from("irrigation_invoice_payments")
        .select(
          "collected_amount, irrigation_collected, maintenance_collected, canal_collected, delay_fee_collected, current_invoice_collected, previous_due_collected, created_at, " +
          "invoice:irrigation_invoices!inner(invoice_no, farmer_id, season_rate, irrigation_amount, land_type_name, due_amount, is_borga, lands(dag_no, mouza, land_size, notes, patwaris(name,name_bn,mobile), owner:farmers!lands_owner_farmer_id_fkey(name_bn,name_en,member_no,farmer_code,account_number,voter_number,savings_inactive,is_voter)), seasons(name,year,type)), " +
          "payment:payments(id, receipt_no, created_at, status, voided_at, verify_token)"
        )
        .eq("invoice.farmer_id", farmerId)
        .order("created_at", { ascending: false }),
      db.from("farmers").select("name_bn,name_en,member_no,farmer_code,account_number,voter_number,savings_inactive,is_voter,father_name,mobile,village,office_id,union_id").eq("id", farmerId).maybeSingle(),
    ]);
    const list: PaidRow[] = (data ?? []).map((r: any) => {
      const acreRate = normalizeIrrigationRatePerAcre(r.invoice?.season_rate, r.invoice?.irrigation_amount, r.invoice?.lands?.land_size);
      const owner = r.invoice?.lands?.owner;
      const ownerMember = owner?.member_no || owner?.farmer_code || null;
      const isBorga = !!r.invoice?.is_borga;
      return {
        season: r.invoice?.seasons ? `${r.invoice.seasons.name ?? r.invoice.seasons.type ?? ""} ${r.invoice.seasons.year ?? ""}`.trim() : "—",
        invoice_no: r.invoice?.invoice_no ?? "—",
        receipt_no: r.payment?.receipt_no ?? "—",
        paid_on: r.payment?.created_at ?? r.created_at ?? null,
        amount: Number(r.collected_amount || 0),
        dag_no: r.invoice?.lands?.dag_no ?? "—",
        mouza: r.invoice?.lands?.mouza ?? "—",
        land_size: r.invoice?.lands?.land_size != null ? Number(r.invoice.lands.land_size) : null,
        land_type: r.invoice?.land_type_name ?? "—",
        acre_rate: acreRate,
        bigha_rate: acreRate != null ? Math.round(ratePerBighaFromAcre(acreRate) ?? 0) : null,
        due: Number(r.invoice?.due_amount || 0),
        irrigation: Number(r.irrigation_collected || 0),
        maintenance: Number(r.maintenance_collected || 0),
        canal: Number(r.canal_collected || 0),
        delay_fee: Number(r.delay_fee_collected || 0),
        current_collected: Number(r.current_invoice_collected || 0),
        previous_collected: Number(r.previous_due_collected || 0),
        cancelled: r.payment?.status === "cancelled" || !!r.payment?.voided_at,
        member_summary: buildMemberSummary({ cultivator: f, owner, isBorga }),
        owner_self: !isBorga,
        land_owner_label: isBorga && owner ? `${owner.name_bn || owner.name_en || ""}${ownerMember ? "-" + ownerMember : ""}` : "নিজ",
        holding_description: r.invoice?.lands?.notes ?? null,
        patwari_name: r.invoice?.lands?.patwaris ? (r.invoice.lands.patwaris.name_bn || r.invoice.lands.patwaris.name) : null,
        patwari_mobile: r.invoice?.lands?.patwaris?.mobile ?? null,
        verify_token: r.payment?.verify_token ?? null,
        payment_id: r.payment?.id ?? null,
      };
    });
    setRows(list);
    setFarmer(f ?? null);
    if (f?.office_id) {
      const { data: o } = await db.from("offices").select("name,name_bn").eq("id", f.office_id).maybeSingle();
      setOffice(o ?? null);
    }
    if (f?.union_id) {
      const { data: u } = await db.from("unions").select("name_bn,name").eq("id", f.union_id).maybeSingle();
      setUnionName(u?.name_bn || u?.name || null);
    } else {
      setUnionName(null);
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

  // Cancelled receipts are excluded from collection totals.
  const total = filtered.reduce((s, r) => s + (r.cancelled ? 0 : r.amount), 0);

  // Build the identical সেচ চার্জ রশিদ used on the Payments page. For rows tied
  // to a real payment we go through the canonical builder; legacy rows without a
  // payment id fall back to the inline data assembled from the invoice.
  async function buildReceiptData(r: PaidRow): Promise<BnReceiptData> {
    if (r.payment_id) {
      return fetchPaymentReceiptData(r.payment_id, { brand, receiptArgs, tx });
    }
    const branding = await loadBranding().catch(() => null as any);
    return {
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
        field_type_bn: r.land_type !== "—" ? r.land_type : null,
        land_size: r.land_size,
        dag_no: r.dag_no !== "—" ? r.dag_no : null,
      },
      village_union: unionName,
      rate: r.acre_rate,
      rate_per_bigha: r.bigha_rate,
      member_summary: r.member_summary,
      owner_self: r.owner_self,
      land_owner_label: r.land_owner_label,
      current_season_charge: r.irrigation || null,
      current_penalty: r.delay_fee || null,
      maintenance_charge: r.maintenance || null,
      canal_charge: r.canal || null,
      penalty_amount: r.delay_fee || null,
      collected_from_outstanding: r.previous_collected || null,
      holding_description: r.holding_description,
      patwari_name: r.patwari_name,
      patwari_mobile: r.patwari_mobile,
      collected_amount: r.amount,
      verify_url: r.verify_token ? `${window.location.origin}/r/${r.verify_token}` : `${window.location.origin}/r/legacy-${encodeURIComponent(r.receipt_no)}`,
    };
  }

  // ১.৯ — receipt download শুধুমাত্র payment হওয়া সারির জন্য (এই তালিকার সব সারিই পরিশোধিত)।
  async function downloadReceipt(r: PaidRow) {
    if (!r.receipt_no || r.receipt_no === "—") {
      toast.error(tx("No receipt available for download.", "ডাউনলোডের জন্য কোনো রসিদ নেই।"));
      return;
    }
    try {
      await downloadBnReceiptPdf(await buildReceiptData(r), "farmer", receiptArgs.options);
    } catch (e: any) {
      toast.error(e?.message ?? tx("Receipt download failed", "রসিদ ডাউনলোড ব্যর্থ"));
    }
  }

  async function openPreview(r: PaidRow) {
    try {
      setPreviewData(await buildReceiptData(r));
    } catch (e: any) {
      toast.error(e?.message ?? tx("Receipt preview failed", "রসিদ প্রিভিউ ব্যর্থ"));
    }
  }

  function exportExcel() {
    const ws = XLSX.utils.aoa_to_sheet([
      [tx("Season", "সিজন"), tx("Receipt No", "রসিদ নং"), tx("Dag No", "দাগ নং"), tx("Mouza", "মৌজা"), tx("Land type", "জমির ধরন"), tx("Land (shotok)", "জমি (শতক)"), tx("Rate (acre)", "রেট (একর)"), tx("Rate (bigha)", "রেট (বিঘা)"), tx("Penalty", "জরিমানা"), tx("Due", "বকেয়া"), tx("Collection Date", "আদায়ের তারিখ"), tx("Total collected", "মোট আদায়"), tx("Status", "স্ট্যাটাস")],
      ...filtered.map((r) => [r.season, r.receipt_no, r.dag_no, r.mouza, r.land_type, r.land_size ?? "", r.acre_rate ?? "", r.bigha_rate ?? "", r.delay_fee, r.due, r.paid_on ? fmtDate(r.paid_on) : "", r.amount, r.cancelled ? tx("Cancelled", "বাতিল") : tx("Paid", "পরিশোধিত")]),
      ["", "", "", "", "", "", "", "", "", "", tx("Total (excl. cancelled)", "মোট (বাতিল বাদে)"), total, ""],
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
      head: [["Season", "Receipt", "Dag", "Mouza", "Type", "Land", "Rate(a/b)", "Penalty", "Due", "Date", "Total", "Status"]],
      body: filtered.map((r) => [r.season, r.receipt_no, r.dag_no, r.mouza, r.land_type, r.land_size ?? "", r.acre_rate != null ? `${r.acre_rate}/${r.bigha_rate}` : "", r.delay_fee.toFixed(2), r.due.toFixed(2), r.paid_on ? fmtDate(r.paid_on) : "", r.amount.toFixed(2), r.cancelled ? "Cancelled" : "Paid"]),
      foot: [["", "", "", "", "", "", "", "", "", "", total.toFixed(2), ""]],
      styles: { fontSize: 7 },
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
          <TableHead>{tx("Land type", "জমির ধরন")}</TableHead>
          <TableHead className="text-right">{tx("Land (shotok)", "জমি (শতক)")}</TableHead>
          <TableHead className="text-right">{tx("Rate (acre/bigha)", "রেট (একর/বিঘা)")}</TableHead>
          <TableHead className="text-right">{tx("Current", "হাল")}</TableHead>
          <TableHead className="text-right">{tx("Penalty", "জরিমানা")}</TableHead>
          <TableHead className="text-right">{tx("Due", "বকেয়া")}</TableHead>
          <TableHead>{tx("Collection Date", "আদায়ের তারিখ")}</TableHead>
          <TableHead className="text-right">{tx("Total collected", "মোট আদায়")}</TableHead>
          <TableHead className="text-right">{tx("Receipt", "রসিদ")}</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {filtered.map((r, i) => (
            <TableRow key={i} className={r.cancelled ? "opacity-60" : undefined}>
              <TableCell>{r.season}</TableCell>
              <TableCell>
                {r.receipt_no}
                {r.cancelled && <Badge variant="destructive" className="ml-1">{tx("Cancelled", "বাতিল")}</Badge>}
              </TableCell>
              <TableCell>{r.dag_no}</TableCell>
              <TableCell>{r.mouza}</TableCell>
              <TableCell>{r.land_type}</TableCell>
              <TableCell className="text-right">{r.land_size ?? "—"}</TableCell>
              <TableCell className="text-right whitespace-nowrap">{r.acre_rate != null ? `${money(r.acre_rate)} / ${money(r.bigha_rate ?? 0)}` : "—"}</TableCell>
              <TableCell className="text-right">{money(r.current_collected)}</TableCell>
              <TableCell className="text-right">{money(r.delay_fee)}</TableCell>
              <TableCell className="text-right">{money(r.due)}</TableCell>
              <TableCell>{r.paid_on ? fmtDate(r.paid_on) : "—"}</TableCell>
              <TableCell className={`text-right ${r.cancelled ? "line-through" : ""}`}>{r.amount.toFixed(2)}</TableCell>
              <TableCell className="text-right whitespace-nowrap">
                <Button size="sm" variant="ghost" title={tx("Preview", "প্রিভিউ")} onClick={() => openPreview(r)}>
                  <Eye className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" title={tx("Download", "ডাউনলোড")} onClick={() => downloadReceipt(r)} disabled={r.cancelled}>
                  <Download className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {!loading && filtered.length === 0 && (
            <TableRow><TableCell colSpan={13} className="text-center text-muted-foreground py-6">{t("noData")}</TableCell></TableRow>
          )}
          {filtered.length > 0 && (
            <TableRow>
              <TableCell colSpan={11} className="text-right font-semibold">{tx("Total (excl. cancelled)", "মোট (বাতিল বাদে)")}</TableCell>
              <TableCell className="text-right font-semibold">{total.toFixed(2)}</TableCell>
              <TableCell />
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Canonical print-ready preview, identical to the Payments page receipt */}
      <IrrigationReceiptPreviewDialog
        open={!!previewData}
        onOpenChange={(o) => !o && setPreviewData(null)}
        data={previewData}
        copy="farmer"
        options={receiptArgs.options}
      />
    </Card>
  );
}
