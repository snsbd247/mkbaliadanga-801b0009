import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { money, fmtDate } from "@/lib/format";
import { useLang } from "@/i18n/LanguageProvider";
import { exportTablePDF, exportExcel } from "@/lib/exports";

/**
 * Category-wise irrigation collection report.
 *
 * Aggregates `irrigation_invoice_payments` for the selected date range and
 * breaks it down by charge head:
 *   - irrigation
 *   - delay fee
 *   - maintenance
 *   - canal
 *
 * Splitting is proportional when only a partial amount is collected (matches
 * the rule in `splitCurrentByHeads` from `irrigationPaymentAllocation.ts`).
 */
interface Row {
  date: string;
  base: number;
  delay: number;
  maintenance: number;
  canal: number;
  other: number;
  previous_due: number;
  total: number;
  count: number;
}

interface PaymentRow {
  created_at: string;
  collected_amount: number | null;
  previous_due_collected: number | null;
  irrigation_invoices?: {
    irrigation_amount: number | null;
    delay_fee: number | null;
    maintenance_amount: number | null;
    canal_amount: number | null;
    other_charge: number | null;
    payable_amount: number | null;
  } | null;
}

const n = (v: any) => Number(v ?? 0) || 0;

export default function IrrigationCategoryReport() {
  const { tx } = useLang();
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date(); monthStart.setDate(1);
  const [from, setFrom] = useState<string>(monthStart.toISOString().slice(0, 10));
  const [to, setTo] = useState<string>(today);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { document.title = tx("Irrigation Category Report", "সেচ ক্যাটেগরি রিপোর্ট"); }, []);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("irrigation_invoice_payments")
        .select("created_at,collected_amount,previous_due_collected,irrigation_invoices(irrigation_amount,delay_fee,maintenance_amount,canal_amount,other_charge,payable_amount)")
        .gte("created_at", from)
        .lte("created_at", to + "T23:59:59");
      if (error) throw error;
      const map = new Map<string, Row>();
      for (const r of (data ?? []) as PaymentRow[]) {
        const d = String(r.created_at).slice(0, 10);
        const row = map.get(d) ?? { date: d, base: 0, delay: 0, maintenance: 0, canal: 0, other: 0, previous_due: 0, total: 0, count: 0 };
        const prev = n(r.previous_due_collected);
        const current = Math.max(0, n(r.collected_amount) - prev);
        const inv = r.irrigation_invoices;
        const baseHead = n(inv?.irrigation_amount);
        const delayHead = n(inv?.delay_fee);
        const maintenanceHead = n(inv?.maintenance_amount);
        const canalHead = n(inv?.canal_amount);
        const otherHead = n(inv?.other_charge);
        const headTotal = baseHead + delayHead + maintenanceHead + canalHead + otherHead;
        const scale = headTotal > 0 ? Math.min(1, current / headTotal) : 0;
        const delayPart = +(delayHead * scale).toFixed(2);
        const maintenancePart = +(maintenanceHead * scale).toFixed(2);
        const canalPart = +(canalHead * scale).toFixed(2);
        const otherPart = +(otherHead * scale).toFixed(2);
        const basePart = +(current - delayPart - maintenancePart - canalPart - otherPart).toFixed(2);
        row.base += Math.max(0, basePart);
        row.delay += delayPart;
        row.maintenance += maintenancePart;
        row.canal += canalPart;
        row.other += otherPart;
        row.previous_due += prev;
        row.total += n(r.collected_amount);
        row.count += 1;
        map.set(d, row);
      }
      setRows([...map.values()].sort((a, b) => b.date.localeCompare(a.date)));
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [from, to]);

  const totals = useMemo(() => rows.reduce((acc, r) => ({
    base: acc.base + r.base,
    delay: acc.delay + r.delay,
    maintenance: acc.maintenance + r.maintenance,
    canal: acc.canal + r.canal,
    other: acc.other + r.other,
    previous_due: acc.previous_due + r.previous_due,
    total: acc.total + r.total,
    count: acc.count + r.count,
  }), { base: 0, delay: 0, maintenance: 0, canal: 0, other: 0, previous_due: 0, total: 0, count: 0 }), [rows]);

  function exportPdf() {
    exportTablePDF(
      tx("Irrigation Category Report", "সেচ ক্যাটেগরি রিপোর্ট"),
      [
        tx("Date", "তারিখ"),
        tx("Irrigation", "সেচ"),
        tx("Delay", "বিলম্ব"),
        tx("Maintenance", "রক্ষণাবেক্ষণ"),
        tx("Canal", "ক্যানেল"),
        tx("Prev Due", "পূর্বের বকেয়া"),
        tx("Total", "মোট"),
      ],
      rows.map(r => [fmtDate(r.date), money(r.irrigation), money(r.delay), money(r.maintenance), money(r.canal), money(r.previous_due), money(r.total)]),
      { from, to },
    );
  }

  function exportXls() {
    exportExcel(
      "irrigation-category-report",
      "Categories",
      rows.map(r => ({
        Date: r.date,
        Irrigation: r.irrigation, Delay: r.delay, Maintenance: r.maintenance,
        Canal: r.canal, "Previous Due": r.previous_due, Total: r.total, Receipts: r.count,
      })),
      { from, to },
    );
  }

  return (
    <>
      <PageHeader
        title={tx("Irrigation Category Report", "সেচ ক্যাটেগরি রিপোর্ট")}
        description={tx("Head-wise collection (irrigation / delay / maintenance / canal).", "খাত-ভিত্তিক আদায় (সেচ / বিলম্ব / রক্ষণাবেক্ষণ / ক্যানেল)")}
      />
      <Card className="p-4 space-y-3">
        <div className="grid gap-3 md:grid-cols-4">
          <div><Label>{tx("From", "হতে")}</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><Label>{tx("To", "পর্যন্ত")}</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          <div className="flex items-end gap-2">
            <Button variant="outline" onClick={exportPdf}><FileDown className="h-4 w-4 mr-1" /> PDF</Button>
            <Button variant="outline" onClick={exportXls}><FileSpreadsheet className="h-4 w-4 mr-1" /> Excel</Button>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-6 text-sm">
          {(["irrigation","delay","maintenance","canal","previous_due","total"] as const).map(k => (
            <div key={k} className="rounded-md border p-2">
              <div className="text-[10px] uppercase text-muted-foreground">
                {k === "irrigation" ? tx("Irrigation","সেচ")
                  : k === "delay" ? tx("Delay","বিলম্ব")
                  : k === "maintenance" ? tx("Maintenance","রক্ষণাবেক্ষণ")
                  : k === "canal" ? tx("Canal","ক্যানেল")
                  : k === "previous_due" ? tx("Previous Due","পূর্বের বকেয়া")
                  : tx("Grand Total","সর্বমোট")}
              </div>
              <div className="font-mono font-semibold">{money((totals as any)[k])}</div>
            </div>
          ))}
        </div>

        <Table>
          <TableHeader><TableRow>
            <TableHead>{tx("Date", "তারিখ")}</TableHead>
            <TableHead className="text-right">{tx("Irrigation", "সেচ")}</TableHead>
            <TableHead className="text-right">{tx("Delay", "বিলম্ব")}</TableHead>
            <TableHead className="text-right">{tx("Maintenance", "রক্ষণাবেক্ষণ")}</TableHead>
            <TableHead className="text-right">{tx("Canal", "ক্যানেল")}</TableHead>
            <TableHead className="text-right">{tx("Prev Due", "পূর্বের বকেয়া")}</TableHead>
            <TableHead className="text-right">{tx("Total", "মোট")}</TableHead>
            <TableHead className="text-right">{tx("Receipts", "রসিদ")}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">…</TableCell></TableRow>}
            {!loading && rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">{tx("No data", "কোনো ডাটা নেই")}</TableCell></TableRow>}
            {rows.map(r => (
              <TableRow key={r.date}>
                <TableCell>{fmtDate(r.date)}</TableCell>
                <TableCell className="text-right font-mono">{money(r.irrigation)}</TableCell>
                <TableCell className="text-right font-mono">{money(r.delay)}</TableCell>
                <TableCell className="text-right font-mono">{money(r.maintenance)}</TableCell>
                <TableCell className="text-right font-mono">{money(r.canal)}</TableCell>
                <TableCell className="text-right font-mono">{money(r.previous_due)}</TableCell>
                <TableCell className="text-right font-mono font-semibold">{money(r.total)}</TableCell>
                <TableCell className="text-right">{r.count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
