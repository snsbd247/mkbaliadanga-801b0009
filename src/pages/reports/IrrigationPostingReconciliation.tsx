import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageProvider";
import { useAuth } from "@/auth/AuthProvider";
import {
  reconcilePostings, journalRefForPayment,
  type ReconPayment, type ReconReceipt, type ReconJournal, type PostingState,
} from "@/lib/irrigationPostingReconciliation";
import { logAudit } from "@/lib/audit";

const sb = db as any;

function StateBadge({ state, tx }: { state: PostingState; tx: (en: string, bn: string) => string }) {
  if (state === "ok") return <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" />{tx("OK", "ঠিক আছে")}</Badge>;
  const label = state === "missing" ? tx("Missing", "নেই")
    : state === "unbalanced" ? tx("Unbalanced", "অসমঞ্জস")
    : tx("Amount mismatch", "পরিমাণে অমিল");
  return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />{label}</Badge>;
}

export default function IrrigationPostingReconciliation() {
  const { tx } = useLang();
  const { user } = useAuth();
  const [offices, setOffices] = useState<any[]>([]);
  const [officeId, setOfficeId] = useState<string>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [payments, setPayments] = useState<ReconPayment[]>([]);
  const [receipts, setReceipts] = useState<ReconReceipt[]>([]);
  const [journals, setJournals] = useState<ReconJournal[]>([]);

  useEffect(() => {
    document.title = tx("Irrigation Posting Reconciliation", "সেচ পোস্টিং রিকনসিলিয়েশন");
    sb.from("offices").select("id,name").order("name").then(({ data }: any) => setOffices(data ?? []));
  }, []);

  async function load() {
    setLoading(true);
    try {
      let pq = sb.from("payments").select("id,receipt_no,amount,office_id,created_at").eq("kind", "irrigation").eq("status", "approved");
      if (officeId !== "all") pq = pq.eq("office_id", officeId);
      if (from) pq = pq.gte("created_at", from);
      if (to) pq = pq.lte("created_at", `${to}T23:59:59`);
      const { data: pays } = await pq.limit(5000);
      const payRows: ReconPayment[] = (pays ?? []) as any;

      let rq = sb.from("receipts").select("receipt_no,reference_id,amount").eq("kind", "irrigation");
      if (officeId !== "all") rq = rq.eq("office_id", officeId);
      const { data: recs } = await rq.limit(10000);

      const refs = payRows.map((p) => journalRefForPayment(p.id));
      const jrows: ReconJournal[] = [];
      // fetch journals in reference chunks with their lines
      for (let i = 0; i < refs.length; i += 200) {
        const chunk = refs.slice(i, i + 200);
        const { data: jes } = await sb.from("journal_entries")
          .select("reference,journal_entry_lines(debit,credit)").in("reference", chunk);
        for (const je of (jes ?? []) as any[]) {
          const lines = je.journal_entry_lines ?? [];
          jrows.push({
            reference: je.reference,
            total_debit: lines.reduce((s: number, l: any) => s + Number(l.debit || 0), 0),
            total_credit: lines.reduce((s: number, l: any) => s + Number(l.credit || 0), 0),
          });
        }
      }

      setPayments(payRows);
      setReceipts((recs ?? []) as ReconReceipt[]);
      setJournals(jrows);
    } catch (e: any) {
      toast.error(e?.message ?? tx("Failed to load", "লোড করা যায়নি"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [officeId, from, to]);

  const result = useMemo(() => reconcilePostings(payments, receipts, journals), [payments, receipts, journals]);

  function exportAudit() {
    logAudit({
      module: "irrigation_payment",
      action_type: "export",
      reference_id: officeId,
      new_data: { report: "posting_reconciliation", discrepancies: result.discrepancies, total: result.totalPayments },
    });
    toast.success(tx("Reconciliation reviewed", "রিকনসিলিয়েশন যাচাই হয়েছে"));
  }

  return (
    <div className="space-y-4">
      <PageHeader title={tx("Irrigation Posting Reconciliation", "সেচ পোস্টিং রিকনসিলিয়েশন")} />

      <Card className="p-4 grid gap-3 md:grid-cols-4 items-end">
        <div>
          <Label>{tx("Office", "অফিস")}</Label>
          <Select value={officeId} onValueChange={setOfficeId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tx("All offices", "সব অফিস")}</SelectItem>
              {offices.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label>{tx("From", "শুরু")}</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label>{tx("To", "শেষ")}</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div><Button variant="outline" onClick={load} className="w-full"><RefreshCw className="mr-1 h-4 w-4" />{tx("Refresh", "রিফ্রেশ")}</Button></div>
      </Card>

      <Card className="p-4 flex flex-wrap items-center gap-4">
        {result.discrepancies === 0 ? (
          <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" />{tx("All payments reconciled with Cash Book & Accounts", "সব পেমেন্ট ক্যাশবুক ও একাউন্টসের সাথে মিলেছে")}</Badge>
        ) : (
          <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />{tx(`${result.discrepancies} discrepancy(ies)`, `${result.discrepancies} টি অমিল`)}</Badge>
        )}
        <span className="text-sm text-muted-foreground">
          {tx("Payments", "পেমেন্ট")}: {result.totalPayments} · {tx("Cash Book OK", "ক্যাশবুক ঠিক")}: {result.cashbookOk} · {tx("Journal OK", "জার্নাল ঠিক")}: {result.journalOk} · {tx("Amount", "পরিমাণ")}: {result.totalPaymentAmount}
        </span>
        <Button variant="outline" size="sm" className="ml-auto" onClick={exportAudit}>{tx("Mark reviewed", "যাচাই চিহ্নিত")}</Button>
      </Card>

      <Card className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tx("Receipt", "রসিদ")}</TableHead>
              <TableHead className="text-right">{tx("Amount", "পরিমাণ")}</TableHead>
              <TableHead>{tx("Cash Book", "ক্যাশবুক")}</TableHead>
              <TableHead>{tx("Accounts (Journal)", "একাউন্টস (জার্নাল)")}</TableHead>
              <TableHead className="text-right">{tx("Dr / Cr", "ডেবিট / ক্রেডিট")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.rows.filter((r) => !r.ok).concat(result.rows.filter((r) => r.ok)).map((r) => (
              <TableRow key={r.payment_id} className={r.ok ? "" : "bg-destructive/5"}>
                <TableCell className="font-medium">{r.receipt_no}</TableCell>
                <TableCell className="text-right tabular-nums">{r.amount}</TableCell>
                <TableCell><StateBadge state={r.cashbook} tx={tx} /></TableCell>
                <TableCell><StateBadge state={r.journal} tx={tx} /></TableCell>
                <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                  {r.journal_debit ?? "-"} / {r.journal_credit ?? "-"}
                </TableCell>
              </TableRow>
            ))}
            {result.rows.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{loading ? tx("Loading…", "লোড হচ্ছে…") : tx("No data", "কোনো তথ্য নেই")}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
