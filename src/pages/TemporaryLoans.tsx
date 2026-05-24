import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { FileDown } from "lucide-react";
import { toast } from "sonner";
import { money, fmtDate } from "@/lib/format";
import { exportTablePDF, exportExcel } from "@/lib/exports";
import { useLang } from "@/i18n/LanguageProvider";


const sb = supabase as any;

export default function TemporaryLoans() {
  const [rows, setRows] = useState<any[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    document.title = "Temporary Loans — MK Baliadanga";
    load();
  }, [from, to]);

  async function load() {
    let q = sb.from("loans")
      .select("*, farmer:farmers(name_en,farmer_code), loan_payments(amount)")
      .eq("is_temporary", true)
      .is("deleted_at", null)
      .order("issued_on", { ascending: false });
    if (from) q = q.gte("issued_on", from);
    if (to) q = q.lte("issued_on", to);
    const { data, error } = await q;
    if (error) return toast.error(error.message);
    setRows(data ?? []);
  }

  async function toggleTemp(id: string, current: boolean) {
    const { error } = await sb.from("loans").update({ is_temporary: !current }).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  const totals = useMemo(() => {
    let issued = 0, paid = 0, due = 0;
    rows.forEach(r => {
      const p = (r.loan_payments ?? []).reduce((a: number, x: any) => a + Number(x.amount || 0), 0);
      issued += Number(r.principal || 0);
      paid += p;
      due += Number(r.total_payable || r.principal || 0) - p;
    });
    return { issued, paid, due };
  }, [rows]);

  const tableRows = rows.map(r => {
    const p = (r.loan_payments ?? []).reduce((a: number, x: any) => a + Number(x.amount || 0), 0);
    return {
      issued_on: r.issued_on, farmer: `${r.farmer?.farmer_code} ${r.farmer?.name_en}`,
      purpose: r.temp_purpose ?? "—", principal: Number(r.principal),
      paid: p, due: Number(r.total_payable || r.principal) - p, status: r.status,
    };
  });

  return (
    <>
      <PageHeader title="অস্থায়ী ঋণ রিপোর্ট (Temporary Loans)" description="স্বল্পমেয়াদী/অস্থায়ী ঋণ ট্র্যাকিং" />
      <Card className="p-3 mb-3 grid md:grid-cols-4 gap-3">
        <div><Label>From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
        <div><Label>To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
        <div className="md:col-span-2 self-end text-sm">
          Issued: <b>{money(totals.issued)}</b> · Paid: <b className="text-success">{money(totals.paid)}</b> · Due: <b className="text-destructive">{money(totals.due)}</b>
        </div>
      </Card>
      <div className="flex gap-2 mb-3">
        <Button size="sm" variant="outline" onClick={() => exportTablePDF("Temporary Loans",
          ["Date", "Farmer", "Purpose", "Principal", "Paid", "Due", "Status"],
          tableRows.map(r => [fmtDate(r.issued_on), r.farmer, r.purpose, r.principal, r.paid, r.due, r.status]),
          { from, to })}><FileDown className="h-4 w-4 mr-1" />PDF</Button>
        <Button size="sm" variant="outline" onClick={() => exportExcel("temporary-loans", "Temporary Loans", tableRows, { from, to })}>
          <FileDown className="h-4 w-4 mr-1" />Excel</Button>
      </div>
      <Card className="overflow-x-auto"><Table>
        <TableHeader><TableRow>
          <TableHead>Date</TableHead><TableHead>Farmer</TableHead><TableHead>Purpose</TableHead>
          <TableHead className="text-right">Principal</TableHead>
          <TableHead className="text-right">Paid</TableHead>
          <TableHead className="text-right">Due</TableHead>
          <TableHead>Status</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No temporary loans. Mark a loan as temporary from its detail page.</TableCell></TableRow>}
          {rows.map(r => {
            const p = (r.loan_payments ?? []).reduce((a: number, x: any) => a + Number(x.amount || 0), 0);
            const due = Number(r.total_payable || r.principal) - p;
            return (
              <TableRow key={r.id}>
                <TableCell>{fmtDate(r.issued_on)}</TableCell>
                <TableCell className="text-sm">{r.farmer?.farmer_code} — {r.farmer?.name_en}</TableCell>
                <TableCell className="text-sm">{r.temp_purpose ?? "—"}</TableCell>
                <TableCell className="text-right">{money(r.principal)}</TableCell>
                <TableCell className="text-right text-success">{money(p)}</TableCell>
                <TableCell className={`text-right ${due > 0 ? "text-destructive" : ""}`}>{money(due)}</TableCell>
                <TableCell><Badge variant={r.status === "approved" ? "default" : "outline"}>{r.status}</Badge></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table></Card>
      <p className="mt-3 text-xs text-muted-foreground">Tip: on any loan in /loans, edit and check "Temporary" to include it here.</p>
    </>
  );
}
