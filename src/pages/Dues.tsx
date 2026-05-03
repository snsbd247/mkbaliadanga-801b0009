import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useLang } from "@/i18n/LanguageProvider";
import { money, fmtDate } from "@/lib/format";
import { exportTablePDF, exportExcel } from "@/lib/exports";
import { Download, FileText, MessageSquare } from "lucide-react";
import { toast } from "sonner";

type Row = {
  farmer_id: string;
  name: string;
  code: string;
  mobile: string | null;
  source: "irrigation" | "loan";
  reference: string;
  due: number;
  oldest: string;
  ageDays: number;
};

function bucket(days: number) {
  if (days <= 30) return "0-30";
  if (days <= 60) return "30-60";
  if (days <= 90) return "60-90";
  return "90+";
}

export default function Dues() {
  const { t } = useLang();
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [src, setSrc] = useState<"all" | "irrigation" | "loan">("all");
  const [bkt, setBkt] = useState<"all" | "0-30" | "30-60" | "60-90" | "90+">("all");

  useEffect(() => { document.title = `Dues — ${t("appName")}`; load(); }, []);

  async function load() {
    const today = Date.now();
    const out: Row[] = [];

    const { data: irr } = await supabase
      .from("irrigation_charges")
      .select("farmer_id,due_amount,entry_date,seasons(name,year),farmers(name_en,farmer_code,mobile)")
      .is("deleted_at", null)
      .gt("due_amount", 0);
    (irr ?? []).forEach((r: any) => {
      const days = Math.max(0, Math.floor((today - new Date(r.entry_date).getTime()) / 86400000));
      out.push({
        farmer_id: r.farmer_id,
        name: r.farmers?.name_en ?? "—",
        code: r.farmers?.farmer_code ?? "—",
        mobile: r.farmers?.mobile ?? null,
        source: "irrigation",
        reference: r.seasons ? `${r.seasons.name} ${r.seasons.year}` : "—",
        due: Number(r.due_amount),
        oldest: r.entry_date,
        ageDays: days,
      });
    });

    const { data: loans } = await supabase
      .from("loans")
      .select("id,farmer_id,total_payable,issued_on,farmers(name_en,farmer_code,mobile)")
      .eq("status", "approved");
    const loanIds = (loans ?? []).map((l: any) => l.id);
    let payByLoan = new Map<string, number>();
    if (loanIds.length) {
      const { data: pays } = await supabase.from("loan_payments").select("loan_id,amount").in("loan_id", loanIds);
      (pays ?? []).forEach((p: any) => payByLoan.set(p.loan_id, (payByLoan.get(p.loan_id) ?? 0) + Number(p.amount)));
    }
    (loans ?? []).forEach((l: any) => {
      const due = Number(l.total_payable) - (payByLoan.get(l.id) ?? 0);
      if (due <= 0) return;
      const days = Math.max(0, Math.floor((today - new Date(l.issued_on).getTime()) / 86400000));
      out.push({
        farmer_id: l.farmer_id,
        name: l.farmers?.name_en ?? "—",
        code: l.farmers?.farmer_code ?? "—",
        mobile: l.farmers?.mobile ?? null,
        source: "loan",
        reference: `Loan ${l.id.slice(0, 6)}`,
        due,
        oldest: l.issued_on,
        ageDays: days,
      });
    });

    out.sort((a, b) => b.due - a.due);
    setRows(out);
  }

  const filtered = useMemo(() => rows.filter(r => {
    if (src !== "all" && r.source !== src) return false;
    if (bkt !== "all" && bucket(r.ageDays) !== bkt) return false;
    if (q && !(r.name.toLowerCase().includes(q.toLowerCase()) || r.code.toLowerCase().includes(q.toLowerCase()) || (r.mobile ?? "").includes(q))) return false;
    return true;
  }), [rows, q, src, bkt]);

  const buckets = useMemo(() => {
    const b = { "0-30": 0, "30-60": 0, "60-90": 0, "90+": 0 };
    filtered.forEach(r => { (b as any)[bucket(r.ageDays)] += r.due; });
    return b;
  }, [filtered]);

  const total = filtered.reduce((a, r) => a + r.due, 0);

  function copyPhones() {
    const phones = Array.from(new Set(filtered.map(r => r.mobile).filter(Boolean))).join(", ");
    navigator.clipboard.writeText(phones);
    toast.success(`Copied ${phones.split(",").length} numbers`);
  }

  function exportSmsCsv() {
    const grouped = new Map<string, { name: string; mobile: string; due: number }>();
    filtered.forEach(r => {
      if (!r.mobile) return;
      const cur = grouped.get(r.mobile) ?? { name: r.name, mobile: r.mobile, due: 0 };
      cur.due += r.due;
      grouped.set(r.mobile, cur);
    });
    const rowsOut = Array.from(grouped.values()).map(g => ({
      Mobile: g.mobile,
      Name: g.name,
      Due: g.due,
      Message: `Dear ${g.name}, your outstanding due is BDT ${g.due.toFixed(0)}. Please pay at your earliest. — Cooperative`,
    }));
    exportExcel("dues-sms-list", "SMS", rowsOut);
  }

  return (
    <>
      <PageHeader title="Dues & Reminders" description="Outstanding amounts with aging buckets" />

      <div className="grid gap-3 md:grid-cols-5 mb-4">
        {(["0-30", "30-60", "60-90", "90+"] as const).map(k => (
          <Card key={k} className="p-4">
            <div className="text-xs uppercase text-muted-foreground">{k} days</div>
            <div className="mt-1 text-xl font-bold">{money((buckets as any)[k])}</div>
          </Card>
        ))}
        <Card className="p-4 bg-destructive/5 border-destructive/30">
          <div className="text-xs uppercase text-destructive">Total Due</div>
          <div className="mt-1 text-xl font-bold text-destructive">{money(total)}</div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-2 mb-3">
          <div className="flex-1 min-w-[200px]">
            <Input placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={src} onValueChange={(v: any) => setSrc(v)}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              <SelectItem value="irrigation">{t("irrigation")}</SelectItem>
              <SelectItem value="loan">{t("loans")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={bkt} onValueChange={(v: any) => setBkt(v)}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ages</SelectItem>
              <SelectItem value="0-30">0-30</SelectItem>
              <SelectItem value="30-60">30-60</SelectItem>
              <SelectItem value="60-90">60-90</SelectItem>
              <SelectItem value="90+">90+</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={copyPhones}><MessageSquare className="h-4 w-4 mr-1" />Copy phones</Button>
          <Button variant="outline" size="sm" onClick={exportSmsCsv}><Download className="h-4 w-4 mr-1" />SMS list</Button>
          <Button variant="outline" size="sm" onClick={() => exportTablePDF("Dues Report",
            ["Code", "Name", "Mobile", "Source", "Reference", "Age", "Due"],
            filtered.map(r => [r.code, r.name, r.mobile ?? "—", r.source, r.reference, `${r.ageDays}d`, money(r.due)]))}>
            <FileText className="h-4 w-4 mr-1" />PDF
          </Button>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("farmerCode")}</TableHead>
                <TableHead>{t("farmerName")}</TableHead>
                <TableHead>{t("mobile")}</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Oldest</TableHead>
                <TableHead>Bucket</TableHead>
                <TableHead className="text-right">{t("dueAmount")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">{t("noData")}</TableCell></TableRow>
              ) : filtered.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-xs">{r.code}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>{r.mobile ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline">{r.source}</Badge></TableCell>
                  <TableCell className="text-xs">{r.reference}</TableCell>
                  <TableCell className="text-xs">{fmtDate(r.oldest)}</TableCell>
                  <TableCell>
                    <Badge variant={r.ageDays > 90 ? "destructive" : r.ageDays > 60 ? "secondary" : "outline"}>
                      {bucket(r.ageDays)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold">{money(r.due)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </>
  );
}
