import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
import { useLang } from "@/i18n/LanguageProvider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Download, CheckCircle2, AlertTriangle } from "lucide-react";
import { money, fmtDate } from "@/lib/format";
import { comparePaymentCoverage } from "@/lib/irrigationPaymentCoverage";
import * as XLSX from "xlsx";

interface CoverageRow { invoice_id: string; collected_amount: number; invoice?: { invoice_no?: string } | null }
interface PaymentRow {
  id: string;
  receipt_no: string | null;
  amount: number;
  created_at: string;
  farmer_id: string | null;
  office_id: string | null;
  irrigation_invoice_payments?: CoverageRow[];
}

interface EnrichedPayment extends PaymentRow {
  coveredNos: string[];
  coveredIds: string[];
  savedTotal: number;
  verified: boolean;
}

export default function IrrigationPaymentCoverageAdmin() {
  const { lang } = useLang();
  const tx = (en: string, bn: string) => (lang === "bn" ? bn : en);
  const [rows, setRows] = useState<EnrichedPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data } = await db
        .from("payments")
        .select("id,receipt_no,amount,created_at,farmer_id,office_id,irrigation_invoice_payments(invoice_id,collected_amount,invoice:irrigation_invoices(invoice_no))")
        .eq("kind", "irrigation")
        .order("created_at", { ascending: false })
        .limit(500);
      if (!alive) return;
      const enriched = ((data as PaymentRow[]) ?? [])
        .filter((p) => (p.irrigation_invoice_payments?.length ?? 0) > 0)
        .map((p) => {
          const cov = p.irrigation_invoice_payments ?? [];
          const coveredIds = cov.map((c) => c.invoice_id);
          const check = comparePaymentCoverage(cov, coveredIds, Number(p.amount || 0));
          return {
            ...p,
            coveredIds,
            coveredNos: cov.map((c) => c.invoice?.invoice_no || c.invoice_id.slice(0, 8)),
            savedTotal: check.savedTotal,
            // Verified = the linked allocations sum to the payment amount.
            verified: !check.totalMismatch,
          } as EnrichedPayment;
        });
      setRows(enriched);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) => (r.receipt_no ?? "").toLowerCase().includes(s) || r.coveredNos.some((n) => n.toLowerCase().includes(s)),
    );
  }, [rows, q]);

  function exportXlsx() {
    // One row per covered invoice so the export total matches the receipt total.
    const data = filtered.flatMap((p) =>
      (p.irrigation_invoice_payments ?? []).map((c) => ({
        [tx("Receipt No", "রসিদ নং")]: p.receipt_no ?? p.id.slice(0, 8),
        [tx("Date", "তারিখ")]: fmtDate(p.created_at),
        [tx("Payment Total", "পেমেন্ট মোট")]: Number(p.amount || 0),
        [tx("Covered Invoice", "পরিশোধিত ইনভয়েস")]: c.invoice?.invoice_no || c.invoice_id,
        [tx("Invoice Amount", "ইনভয়েস পরিমাণ")]: Number(c.collected_amount || 0),
        [tx("Verified", "যাচাইকৃত")]: p.verified ? tx("Yes", "হ্যাঁ") : tx("No", "না"),
      })),
    );
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Coverage");
    XLSX.writeFile(wb, `irrigation-payment-coverage-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{tx("Irrigation Payment Coverage", "সেচ পেমেন্ট কভারেজ")}</h1>
        <Button onClick={exportXlsx} disabled={filtered.length === 0} variant="outline" size="sm">
          <Download className="h-4 w-4 mr-1" /> {tx("Export Excel", "এক্সেল")}
        </Button>
      </div>
      <Input
        placeholder={tx("Search receipt or invoice no…", "রসিদ বা ইনভয়েস নং খুঁজুন…")}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="max-w-sm"
      />
      <Card className="p-0 overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" /> {tx("Loading…", "লোড হচ্ছে…")}</div>
        ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>{tx("Receipt No", "রসিদ নং")}</TableHead>
              <TableHead>{tx("Date", "তারিখ")}</TableHead>
              <TableHead className="text-right">{tx("Total", "মোট")}</TableHead>
              <TableHead>{tx("Covered Invoices", "পরিশোধিত ইনভয়েস")}</TableHead>
              <TableHead className="text-right">{tx("Coverage Sum", "কভারেজ যোগফল")}</TableHead>
              <TableHead>{tx("Status", "অবস্থা")}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.receipt_no ?? p.id.slice(0, 8)}</TableCell>
                  <TableCell className="text-xs">{fmtDate(p.created_at)}</TableCell>
                  <TableCell className="text-right font-mono">{money(p.amount)}</TableCell>
                  <TableCell className="text-xs">{p.coveredNos.join(", ")}</TableCell>
                  <TableCell className="text-right font-mono">{money(p.savedTotal)}</TableCell>
                  <TableCell>
                    {p.verified ? (
                      <Badge variant="default"><CheckCircle2 className="h-3 w-3 mr-1" /> {tx("Verified", "যাচাইকৃত")}</Badge>
                    ) : (
                      <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" /> {tx("Mismatch", "গরমিল")}</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{tx("No payments found", "কোনো পেমেন্ট নেই")}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
