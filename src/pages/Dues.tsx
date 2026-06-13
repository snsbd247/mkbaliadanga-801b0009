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
  father: string | null;
  code: string;
  mobile: string | null;
  source: "irrigation" | "loan";
  reference: string;
  due: number;
  oldest: string;
  ageDays: number;
  arrear: boolean;
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

  useEffect(() => { document.title = `${t("dues_pageTitle" as any)} — ${t("appName")}`; load(); }, [t]);

  async function load() {
    const today = Date.now();
    const out: Row[] = [];

    const { data: irr } = await supabase
      .from("irrigation_invoices")
      .select("farmer_id,due_amount,due_date,generated_at,invoice_no,seasons(name,year,status),farmers(name_en,father_name,farmer_code,mobile)")
      .is("deleted_at", null)
      .neq("invoice_status", "cancelled")
      .gt("due_amount", 0);
    // current ("hal") = highest season year present; older years = arrears (বকেয়া)
    const irrYears = (irr ?? []).map((r: any) => r.seasons?.year).filter((y: any) => y != null) as number[];
    const halYear = irrYears.length ? Math.max(...irrYears) : null;
    (irr ?? []).forEach((r: any) => {
      const refDate = r.due_date ?? String(r.generated_at ?? "").slice(0, 10);
      const days = Math.max(0, Math.floor((today - new Date(refDate).getTime()) / 86400000));
      const sy = r.seasons?.year ?? null;
      const arrear = halYear != null && sy != null ? sy < halYear : false;
      out.push({
        farmer_id: r.farmer_id,
        name: r.farmers?.name_en ?? "—",
        father: r.farmers?.father_name ?? null,
        code: r.farmers?.farmer_code ?? "—",
        mobile: r.farmers?.mobile ?? null,
        source: "irrigation",
        reference: r.seasons ? `${r.seasons.name} ${r.seasons.year}` : (r.invoice_no ?? "—"),
        due: Number(r.due_amount),
        oldest: refDate,
        ageDays: days,
        arrear,
      });
    });

    const { data: loans } = await supabase
      .from("loans")
      .select("id,farmer_id,total_payable,issued_on,farmers(name_en,father_name,farmer_code,mobile)")
      .is("deleted_at", null)
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
        father: l.farmers?.father_name ?? null,
        code: l.farmers?.farmer_code ?? "—",
        mobile: l.farmers?.mobile ?? null,
        source: "loan",
        reference: `${t("dues_loanRefPrefix" as any)} ${l.id.slice(0, 6)}`,
        due,
        oldest: l.issued_on,
        ageDays: days,
        arrear: false,
      });
    });

    // group dues per farmer (all rows of one farmer together), farmers ordered by total due
    const totalByFarmer = new Map<string, number>();
    out.forEach(r => totalByFarmer.set(r.farmer_id, (totalByFarmer.get(r.farmer_id) ?? 0) + r.due));
    out.sort((a, b) => {
      const ta = totalByFarmer.get(a.farmer_id) ?? 0, tb = totalByFarmer.get(b.farmer_id) ?? 0;
      if (tb !== ta) return tb - ta;
      if (a.farmer_id !== b.farmer_id) return a.farmer_id < b.farmer_id ? -1 : 1;
      // within a farmer: arrears first, then current
      if (a.arrear !== b.arrear) return a.arrear ? -1 : 1;
      return b.due - a.due;
    });
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
    toast.success(t("dues_copiedNumbers" as any).replace("{count}", String(phones.split(",").length)));
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
      Message: t("dues_smsTemplate" as any).replace("{name}", g.name).replace("{amount}", g.due.toFixed(0)),
    }));
    exportExcel("dues-sms-list", "SMS", rowsOut);
  }

  return (
    <>
      <PageHeader title={t("dues_title" as any)} description={t("dues_desc" as any)} />

      <div className="grid gap-3 md:grid-cols-5 mb-4">
        {(["0-30", "30-60", "60-90", "90+"] as const).map(k => (
          <Card key={k} className="p-4">
            <div className="text-xs uppercase text-muted-foreground">{k} {t("dues_days" as any)}</div>
            <div className="mt-1 text-xl font-bold">{money((buckets as any)[k])}</div>
          </Card>
        ))}
        <Card className="p-4 bg-destructive/5 border-destructive/30">
          <div className="text-xs uppercase text-destructive">{t("dues_totalDue" as any)}</div>
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
              <SelectItem value="all">{t("dues_allSources" as any)}</SelectItem>
              <SelectItem value="irrigation">{t("irrigation")}</SelectItem>
              <SelectItem value="loan">{t("loans")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={bkt} onValueChange={(v: any) => setBkt(v)}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("dues_allAges" as any)}</SelectItem>
              <SelectItem value="0-30">0-30</SelectItem>
              <SelectItem value="30-60">30-60</SelectItem>
              <SelectItem value="60-90">60-90</SelectItem>
              <SelectItem value="90+">90+</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={copyPhones}><MessageSquare className="h-4 w-4 mr-1" />{t("dues_copyPhones" as any)}</Button>
          <Button variant="outline" size="sm" onClick={exportSmsCsv}><Download className="h-4 w-4 mr-1" />{t("dues_smsList" as any)}</Button>
          <Button variant="outline" size="sm" onClick={() => exportTablePDF(t("dues_pdfTitle" as any),
            [t("dues_colCode" as any), t("dues_colName" as any), t("dues_colMobile" as any), t("dues_colSource" as any), t("dues_colReference" as any), t("dues_colAge" as any), t("dues_colDue" as any)],
            filtered.map(r => [r.code, r.name, r.mobile ?? "—", r.source, r.reference, `${r.ageDays}d`, money(r.due)]))}>
            <FileText className="h-4 w-4 mr-1" />{t("dues_pdf" as any)}
          </Button>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("farmerCode")}</TableHead>
                <TableHead>{t("farmerName")}</TableHead>
                <TableHead>{t("mobile")}</TableHead>
                <TableHead>{t("dues_source" as any)}</TableHead>
                <TableHead>{t("dues_reference" as any)}</TableHead>
                <TableHead>{t("dues_oldest" as any)}</TableHead>
                <TableHead>{t("dues_bucket" as any)}</TableHead>
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
                  <TableCell><Badge variant="outline">{r.source === "irrigation" ? t("dues_srcIrrigation" as any) : t("dues_srcLoan" as any)}</Badge></TableCell>
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
