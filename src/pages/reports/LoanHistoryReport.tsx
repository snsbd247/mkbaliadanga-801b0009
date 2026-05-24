import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { money, fmtDate } from "@/lib/format";
import { useLang } from "@/i18n/LanguageProvider";
import { exportTablePDF, exportExcel } from "@/lib/exports";

/**
 * Loan History Report — consolidated loan history per farmer.
 * Columns: Member ID, Name, Mobile, Loans Count, Principal Total, Paid Total,
 * Outstanding, Last Issued, Last Paid, Status mix.
 */
export default function LoanHistoryReport() {
  const { tx } = useLang();
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = tx("Loan History Report", "ঋণ ইতিহাস রিপোর্ট");
    setLoading(true);
    (async () => {
      const [{ data: farmers }, { data: loans }] = await Promise.all([
        supabase.from("farmers").select("id,name_en,name_bn,mobile,member_no,farmer_code").is("deleted_at", null),
        supabase.from("loans").select("id,farmer_id,principal,total_payable,issued_on,status,loan_payments(amount,paid_on)").is("deleted_at", null),
      ]);
      const byFarmer: Record<string, any[]> = {};
      for (const l of loans ?? []) (byFarmer[l.farmer_id] ||= []).push(l);
      const out = (farmers ?? []).map((f: any) => {
        const list = byFarmer[f.id] ?? [];
        if (!list.length) return null;
        const principal = list.reduce((s, l) => s + Number(l.principal || 0), 0);
        const payable = list.reduce((s, l) => s + Number(l.total_payable || 0), 0);
        const paid = list.reduce((s, l) => s + (l.loan_payments ?? []).reduce((a: number, p: any) => a + Number(p.amount || 0), 0), 0);
        const outstanding = Math.max(0, payable - paid);
        const issuedDates = list.map((l) => l.issued_on).filter(Boolean).sort();
        const allPays = list.flatMap((l) => l.loan_payments ?? []).map((p: any) => p.paid_on).filter(Boolean).sort();
        const statusCounts: Record<string, number> = {};
        for (const l of list) statusCounts[l.status] = (statusCounts[l.status] || 0) + 1;
        return {
          id: f.id,
          member_no: f.member_no ?? f.farmer_code ?? "—",
          name: f.name_bn || f.name_en || "—",
          mobile: f.mobile ?? "—",
          count: list.length,
          principal,
          paid,
          outstanding,
          lastIssued: issuedDates[issuedDates.length - 1] ?? null,
          lastPaid: allPays[allPays.length - 1] ?? null,
          statusCounts,
        };
      }).filter(Boolean);
      setRows(out as any[]);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      String(r.name).toLowerCase().includes(q) ||
      String(r.mobile).includes(q) ||
      String(r.member_no).toLowerCase().includes(q)
    );
  }, [rows, search]);

  const totals = useMemo(() => ({
    count: filtered.reduce((s, r) => s + r.count, 0),
    principal: filtered.reduce((s, r) => s + r.principal, 0),
    paid: filtered.reduce((s, r) => s + r.paid, 0),
    outstanding: filtered.reduce((s, r) => s + r.outstanding, 0),
  }), [filtered]);

  function doExportPdf() {
    exportTablePDF(
      tx("Loan History Report", "ঋণ ইতিহাস রিপোর্ট"),
      ["আইডি", "নাম", "মোবাইল", "ঋণ সংখ্যা", "মূল", "পরিশোধিত", "বাকি", "সর্বশেষ গ্রহণ", "সর্বশেষ পরিশোধ"],
      filtered.map((r) => [
        r.member_no, r.name, r.mobile, String(r.count),
        money(r.principal), money(r.paid), money(r.outstanding),
        r.lastIssued ? fmtDate(r.lastIssued) : "—",
        r.lastPaid ? fmtDate(r.lastPaid) : "—",
      ]),
    );
  }
  function doExportExcel() {
    exportExcel("loan-history", "LoanHistory", filtered.map((r) => ({
      ID: r.member_no, Name: r.name, Mobile: r.mobile,
      Loans: r.count, Principal: r.principal, Paid: r.paid, Outstanding: r.outstanding,
      Last_Issued: r.lastIssued ?? "", Last_Paid: r.lastPaid ?? "",
    })));
  }

  return (
    <>
      <PageHeader title={tx("Loan History Report", "ঋণ ইতিহাস রিপোর্ট")} />
      <Card className="p-3 mb-3 grid gap-3 md:grid-cols-4 items-end">
        <div className="md:col-span-2">
          <Label>খুঁজুন</Label>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="নাম / মোবাইল / আইডি" />
        </div>
        <div className="flex gap-2 md:col-span-2 md:justify-end">
          <Button size="sm" variant="outline" onClick={doExportPdf} disabled={!filtered.length}><FileDown className="h-4 w-4 mr-1" />PDF</Button>
          <Button size="sm" variant="outline" onClick={doExportExcel} disabled={!filtered.length}><FileSpreadsheet className="h-4 w-4 mr-1" />Excel</Button>
        </div>
      </Card>
      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>আইডি</TableHead>
              <TableHead>নাম</TableHead>
              <TableHead>মোবাইল</TableHead>
              <TableHead className="text-right">ঋণ সংখ্যা</TableHead>
              <TableHead className="text-right">মূল</TableHead>
              <TableHead className="text-right">পরিশোধিত</TableHead>
              <TableHead className="text-right">বাকি</TableHead>
              <TableHead>সর্বশেষ গ্রহণ</TableHead>
              <TableHead>সর্বশেষ পরিশোধ</TableHead>
              <TableHead>স্ট্যাটাস</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={10} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>}
            {!loading && filtered.length === 0 && <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">কোনো ডেটা নেই</TableCell></TableRow>}
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs font-mono">{r.member_no}</TableCell>
                <TableCell>{r.name}</TableCell>
                <TableCell className="text-xs">{r.mobile}</TableCell>
                <TableCell className="text-right">{r.count}</TableCell>
                <TableCell className="text-right">{money(r.principal)}</TableCell>
                <TableCell className="text-right text-success">{money(r.paid)}</TableCell>
                <TableCell className="text-right font-semibold text-destructive">{money(r.outstanding)}</TableCell>
                <TableCell className="text-xs">{r.lastIssued ? fmtDate(r.lastIssued) : "—"}</TableCell>
                <TableCell className="text-xs">{r.lastPaid ? fmtDate(r.lastPaid) : "—"}</TableCell>
                <TableCell className="space-x-1">
                  {Object.entries(r.statusCounts).map(([s, c]) => (
                    <Badge key={s} variant="outline" className="text-[10px]">{s}:{c as number}</Badge>
                  ))}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length > 0 && (
              <TableRow className="bg-muted/70 font-bold border-t-2">
                <TableCell colSpan={3} className="text-right">সর্বমোট ({filtered.length} জন)</TableCell>
                <TableCell className="text-right">{totals.count}</TableCell>
                <TableCell className="text-right">{money(totals.principal)}</TableCell>
                <TableCell className="text-right">{money(totals.paid)}</TableCell>
                <TableCell className="text-right">{money(totals.outstanding)}</TableCell>
                <TableCell colSpan={3}></TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
