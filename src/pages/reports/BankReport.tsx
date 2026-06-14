import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { money, fmtDate } from "@/lib/format";
import { exportTablePDF, exportExcel } from "@/lib/exports";
import { FileDown, FileSpreadsheet } from "lucide-react";

const sb = supabase as any;
const isIn = (ty: string) => ["deposit", "transfer_in", "interest"].includes(ty);

const STREAM_LABEL: Record<string, string> = {
  sech: "সেচ (মেইন)", sech_small: "ছোট সেচ", saving: "সেভিং", other: "অন্যান্য",
};

type Row = {
  id: string; bank: string; account: string; stream: string;
  opening: number; deposit: number; withdraw: number; closing: number;
};

export default function BankReport() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [txns, setTxns] = useState<any[]>([]);
  const [dFrom, setDFrom] = useState("");
  const [dTo, setDTo] = useState("");

  useEffect(() => { document.title = "ব্যাংক রিপোর্ট — MK Baliadanga"; load(); }, []);

  async function load() {
    const [{ data: acc }, { data: trx }] = await Promise.all([
      sb.from("bank_accounts").select("*").order("bank_name"),
      sb.from("bank_transactions").select("*").order("txn_date", { ascending: true }).limit(5000),
    ]);
    setAccounts(acc ?? []); setTxns(trx ?? []);
  }

  const rows: Row[] = useMemo(() => {
    return accounts.map(a => {
      let opening = Number(a.opening_balance || 0);
      let deposit = 0, withdraw = 0;
      txns.forEach((t: any) => {
        if (t.bank_account_id !== a.id) return;
        const amt = Number(t.amount || 0);
        if (dFrom && t.txn_date < dFrom) { opening += (isIn(t.txn_type) ? 1 : -1) * amt; return; }
        if (dTo && t.txn_date > dTo) return;
        if (isIn(t.txn_type)) deposit += amt; else withdraw += amt;
      });
      return {
        id: a.id, bank: a.bank_name, account: a.account_no, stream: a.stream,
        opening, deposit, withdraw, closing: opening + deposit - withdraw,
      };
    });
  }, [accounts, txns, dFrom, dTo]);

  const tot = useMemo(() => rows.reduce((s, r) => ({
    opening: s.opening + r.opening, deposit: s.deposit + r.deposit,
    withdraw: s.withdraw + r.withdraw, closing: s.closing + r.closing,
  }), { opening: 0, deposit: 0, withdraw: 0, closing: 0 }), [rows]);

  const headers = ["ব্যাংক", "হিসাব নং", "স্ট্রিম", "প্রারম্ভিক", "জমা", "উত্তোলন", "সমাপনী ব্যালেন্স"];
  function exportPdf() {
    const body = rows.map(r => [r.bank, r.account, STREAM_LABEL[r.stream] ?? r.stream, r.opening, r.deposit, r.withdraw, r.closing]);
    body.push(["মোট", "", "", tot.opening, tot.deposit, tot.withdraw, tot.closing]);
    exportTablePDF("ব্যাংক রিপোর্ট", headers, body, { from: dFrom, to: dTo });
  }
  function exportXlsx() {
    exportExcel("bank-report", "BankReport", rows.map(r => ({
      "ব্যাংক": r.bank, "হিসাব নং": r.account, "স্ট্রিম": STREAM_LABEL[r.stream] ?? r.stream,
      "প্রারম্ভিক": r.opening, "জমা": r.deposit, "উত্তোলন": r.withdraw, "সমাপনী ব্যালেন্স": r.closing,
    })), { from: dFrom, to: dTo });
  }

  return (
    <>
      <PageHeader title="ব্যাংক রিপোর্ট" description="হিসাব অনুযায়ী জমা / উত্তোলন / ব্যালেন্স (এক পেজ)" />

      <Card className="p-3 mb-3 flex flex-wrap items-end gap-3">
        <div><Label>From</Label><Input type="date" value={dFrom} onChange={e => setDFrom(e.target.value)} /></div>
        <div><Label>To</Label><Input type="date" value={dTo} onChange={e => setDTo(e.target.value)} /></div>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={exportPdf}><FileDown className="h-4 w-4 mr-1" />PDF</Button>
          <Button size="sm" variant="outline" onClick={exportXlsx}><FileSpreadsheet className="h-4 w-4 mr-1" />Excel</Button>
        </div>
      </Card>

      <Card className="p-3 mb-3 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div><div className="text-xs text-muted-foreground">মোট প্রারম্ভিক</div><div className="text-lg font-bold">{money(tot.opening)}</div></div>
        <div><div className="text-xs text-muted-foreground">মোট জমা</div><div className="text-lg font-bold text-success">{money(tot.deposit)}</div></div>
        <div><div className="text-xs text-muted-foreground">মোট উত্তোলন</div><div className="text-lg font-bold text-destructive">{money(tot.withdraw)}</div></div>
        <div><div className="text-xs text-muted-foreground">মোট ব্যালেন্স</div><div className="text-lg font-bold text-primary">{money(tot.closing)}</div></div>
      </Card>

      <Card className="overflow-x-auto"><Table>
        <TableHeader><TableRow>
          <TableHead>ব্যাংক</TableHead>
          <TableHead>হিসাব নং</TableHead>
          <TableHead>স্ট্রিম</TableHead>
          <TableHead className="text-right">প্রারম্ভিক</TableHead>
          <TableHead className="text-right">জমা</TableHead>
          <TableHead className="text-right">উত্তোলন</TableHead>
          <TableHead className="text-right">সমাপনী ব্যালেন্স</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">কোনো হিসাব নেই</TableCell></TableRow>}
          {rows.map(r => (
            <TableRow key={r.id}>
              <TableCell>{r.bank}</TableCell>
              <TableCell className="font-mono text-xs">{r.account}</TableCell>
              <TableCell className="text-sm">{STREAM_LABEL[r.stream] ?? r.stream}</TableCell>
              <TableCell className="text-right">{money(r.opening)}</TableCell>
              <TableCell className="text-right text-success">{money(r.deposit)}</TableCell>
              <TableCell className="text-right text-destructive">{money(r.withdraw)}</TableCell>
              <TableCell className="text-right font-semibold text-primary">{money(r.closing)}</TableCell>
            </TableRow>
          ))}
          {rows.length > 0 && (
            <TableRow className="bg-muted/60 font-bold">
              <TableCell colSpan={3} className="text-right">মোট</TableCell>
              <TableCell className="text-right">{money(tot.opening)}</TableCell>
              <TableCell className="text-right text-success">{money(tot.deposit)}</TableCell>
              <TableCell className="text-right text-destructive">{money(tot.withdraw)}</TableCell>
              <TableCell className="text-right text-primary">{money(tot.closing)}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table></Card>
    </>
  );
}
