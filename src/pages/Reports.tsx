import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { money, fmtDate } from "@/lib/format";
import { exportTablePDF, exportExcel } from "@/lib/exports";

export default function Reports() {
  const { t } = useLang();
  const [from, setFrom] = useState<string>(""); const [to, setTo] = useState<string>("");
  const [seasons, setSeasons] = useState<any[]>([]);
  const [seasonId, setSeasonId] = useState("");
  const [irr, setIrr] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [savings, setSavings] = useState<any[]>([]);

  useEffect(() => { document.title = `${t("reports")} — ${t("appName")}`; supabase.from("seasons").select("*").then(r => setSeasons(r.data ?? [])); load(); }, [from, to, seasonId]);

  async function load() {
    let irrQ = supabase.from("irrigation_charges").select("entry_date,base_charge,canal_charge,maintenance_charge,other_charge,total,paid_amount,due_amount,farmers(name_en,farmer_code),seasons(name,year,type),lands(dag_no,mouza,land_size)").order("entry_date", { ascending: false });
    if (from) irrQ = irrQ.gte("entry_date", from);
    if (to) irrQ = irrQ.lte("entry_date", to);
    if (seasonId) irrQ = irrQ.eq("season_id", seasonId);
    const irrRes = await irrQ;
    setIrr(irrRes.data ?? []);

    let lnQ = supabase.from("loans").select("issued_on,principal,interest_rate,total_payable,status,farmers(name_en,farmer_code),loan_payments(amount)").order("issued_on", { ascending: false });
    if (from) lnQ = lnQ.gte("issued_on", from);
    if (to) lnQ = lnQ.lte("issued_on", to);
    setLoans((await lnQ).data ?? []);

    let svQ = supabase.from("savings_transactions").select("txn_date,type,amount,status,farmers(name_en,farmer_code)").order("txn_date", { ascending: false });
    if (from) svQ = svQ.gte("txn_date", from);
    if (to) svQ = svQ.lte("txn_date", to);
    setSavings((await svQ).data ?? []);
  }

  // Group irrigation by period (daily / monthly)
  function groupBy(period: "day" | "month") {
    const map = new Map<string, { period: string; base: number; canal: number; maintenance: number; other: number; total: number; paid: number; due: number; count: number }>();
    for (const r of irr) {
      const key = period === "day" ? r.entry_date : (r.entry_date ?? "").slice(0, 7);
      if (!map.has(key)) map.set(key, { period: key, base: 0, canal: 0, maintenance: 0, other: 0, total: 0, paid: 0, due: 0, count: 0 });
      const g = map.get(key)!;
      g.base += Number(r.base_charge || 0);
      g.canal += Number(r.canal_charge || 0);
      g.maintenance += Number(r.maintenance_charge || 0);
      g.other += Number(r.other_charge || 0);
      g.total += Number(r.total || 0);
      g.paid += Number(r.paid_amount || 0);
      g.due += Number(r.due_amount || 0);
      g.count += 1;
    }
    return Array.from(map.values()).sort((a, b) => b.period.localeCompare(a.period));
  }
  const daily = groupBy("day");
  const monthly = groupBy("month");

  return (
    <>
      <PageHeader title={t("reports")} />
      <Card className="p-4 mb-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div><Label>{t("from")}</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><Label>{t("to")}</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          <div><Label>{t("season")}</Label>
            <Select value={seasonId} onValueChange={setSeasonId}>
              <SelectTrigger><SelectValue placeholder={t("all")} /></SelectTrigger>
              <SelectContent><SelectItem value="">{t("all")}</SelectItem>{seasons.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="irrigation">
        <TabsList>
          <TabsTrigger value="irrigation">{t("irrigationReport")}</TabsTrigger>
          <TabsTrigger value="loan">{t("loanReport")}</TabsTrigger>
          <TabsTrigger value="savings">{t("savingsReport")}</TabsTrigger>
        </TabsList>

        <TabsContent value="irrigation">
          <Tabs defaultValue="detail">
            <TabsList>
              <TabsTrigger value="detail">Detail (per farmer/land)</TabsTrigger>
              <TabsTrigger value="daily">Daily summary</TabsTrigger>
              <TabsTrigger value="monthly">Monthly summary</TabsTrigger>
            </TabsList>

            <TabsContent value="detail">
              <ExportBar onPdf={() => exportTablePDF("Irrigation Detail", ["Date", "Farmer", "Season", "Dag", "Base", "Canal", "Maint.", "Other", "Total", "Paid", "Due"], irr.map(r => [fmtDate(r.entry_date), `${r.farmers?.farmer_code} ${r.farmers?.name_en}`, r.seasons?.name, r.lands?.dag_no, r.base_charge, r.canal_charge, r.maintenance_charge, r.other_charge, r.total, r.paid_amount, r.due_amount]))}
                onXlsx={() => exportExcel("irrigation-detail", "Irrigation", irr.map(r => ({ Date: r.entry_date, Farmer: r.farmers?.name_en, Code: r.farmers?.farmer_code, Season: r.seasons?.name, Dag: r.lands?.dag_no, Mouza: r.lands?.mouza, Size: r.lands?.land_size, Base: r.base_charge, Canal: r.canal_charge, Maintenance: r.maintenance_charge, Other: r.other_charge, Total: r.total, Paid: r.paid_amount, Due: r.due_amount })))} />
              <Card className="overflow-x-auto"><Table>
                <TableHeader><TableRow>
                  <TableHead>{t("date")}</TableHead><TableHead>{t("farmerName")}</TableHead><TableHead>{t("season")}</TableHead><TableHead>{t("dagNo")}</TableHead>
                  <TableHead className="text-right">Base</TableHead><TableHead className="text-right">Canal</TableHead><TableHead className="text-right">Maint.</TableHead><TableHead className="text-right">Other</TableHead>
                  <TableHead className="text-right">{t("total")}</TableHead><TableHead className="text-right">{t("paidAmount")}</TableHead><TableHead className="text-right">{t("dueAmount")}</TableHead>
                </TableRow></TableHeader>
                <TableBody>{irr.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{fmtDate(r.entry_date)}</TableCell>
                    <TableCell>{r.farmers?.name_en} <span className="text-xs text-muted-foreground">({r.farmers?.farmer_code})</span></TableCell>
                    <TableCell>{r.seasons?.name}</TableCell>
                    <TableCell>{r.lands?.dag_no}</TableCell>
                    <TableCell className="text-right">{money(r.base_charge)}</TableCell>
                    <TableCell className="text-right">{money(r.canal_charge)}</TableCell>
                    <TableCell className="text-right">{money(r.maintenance_charge)}</TableCell>
                    <TableCell className="text-right">{money(r.other_charge)}</TableCell>
                    <TableCell className="text-right font-medium">{money(r.total)}</TableCell>
                    <TableCell className="text-right text-success">{money(r.paid_amount)}</TableCell>
                    <TableCell className={`text-right ${r.due_amount > 0 ? "due-text" : ""}`}>{money(r.due_amount)}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table></Card>
            </TabsContent>

            <TabsContent value="daily">
              <ExportBar onPdf={() => exportTablePDF("Daily Irrigation Summary", ["Date", "Entries", "Base", "Canal", "Maint.", "Other", "Total", "Paid", "Due"], daily.map(g => [g.period, g.count, g.base, g.canal, g.maintenance, g.other, g.total, g.paid, g.due]))}
                onXlsx={() => exportExcel("irrigation-daily", "Daily", daily.map(g => ({ Date: g.period, Entries: g.count, Base: g.base, Canal: g.canal, Maintenance: g.maintenance, Other: g.other, Total: g.total, Paid: g.paid, Due: g.due })))} />
              <SummaryTable rows={daily} label="Date" />
            </TabsContent>

            <TabsContent value="monthly">
              <ExportBar onPdf={() => exportTablePDF("Monthly Irrigation Summary", ["Month", "Entries", "Base", "Canal", "Maint.", "Other", "Total", "Paid", "Due"], monthly.map(g => [g.period, g.count, g.base, g.canal, g.maintenance, g.other, g.total, g.paid, g.due]))}
                onXlsx={() => exportExcel("irrigation-monthly", "Monthly", monthly.map(g => ({ Month: g.period, Entries: g.count, Base: g.base, Canal: g.canal, Maintenance: g.maintenance, Other: g.other, Total: g.total, Paid: g.paid, Due: g.due })))} />
              <SummaryTable rows={monthly} label="Month" />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="loan">
          <ExportBar onPdf={() => exportTablePDF("Loan Report", ["Date", "Farmer", "Principal", "Rate", "Payable", "Status"], loans.map(r => [fmtDate(r.issued_on), r.farmers?.name_en, r.principal, r.interest_rate, r.total_payable, r.status]))}
            onXlsx={() => exportExcel("loan-report", "Loans", loans.map(r => ({ Date: r.issued_on, Farmer: r.farmers?.name_en, Principal: r.principal, Rate: r.interest_rate, Payable: r.total_payable, Status: r.status })))} />
          <Card><Table>
            <TableHeader><TableRow><TableHead>{t("date")}</TableHead><TableHead>{t("farmerName")}</TableHead><TableHead>{t("principal")}</TableHead><TableHead>{t("interestRate")}</TableHead><TableHead>{t("totalPayable")}</TableHead><TableHead>{t("dueAmount")}</TableHead><TableHead>{t("status")}</TableHead></TableRow></TableHeader>
            <TableBody>{loans.map((r, i) => {
              const paid = (r.loan_payments ?? []).reduce((a: number, p: any) => a + Number(p.amount), 0);
              const due = Number(r.total_payable) - paid;
              return <TableRow key={i}><TableCell>{fmtDate(r.issued_on)}</TableCell><TableCell>{r.farmers?.name_en}</TableCell><TableCell>{money(r.principal)}</TableCell><TableCell>{r.interest_rate}%</TableCell><TableCell>{money(r.total_payable)}</TableCell><TableCell className={due > 0 && r.status === "approved" ? "due-text" : ""}>{money(due)}</TableCell><TableCell>{r.status}</TableCell></TableRow>;
            })}</TableBody>
          </Table></Card>
        </TabsContent>

        <TabsContent value="savings">
          <ExportBar onPdf={() => exportTablePDF("Savings Report", ["Date", "Farmer", "Type", "Amount", "Status"], savings.map(r => [fmtDate(r.txn_date), r.farmers?.name_en, r.type, r.amount, r.status]))}
            onXlsx={() => exportExcel("savings-report", "Savings", savings.map(r => ({ Date: r.txn_date, Farmer: r.farmers?.name_en, Type: r.type, Amount: r.amount, Status: r.status })))} />
          <Card><Table>
            <TableHeader><TableRow><TableHead>{t("date")}</TableHead><TableHead>{t("farmerName")}</TableHead><TableHead>{t("type")}</TableHead><TableHead>{t("amount")}</TableHead><TableHead>{t("status")}</TableHead></TableRow></TableHeader>
            <TableBody>{savings.map((r, i) => <TableRow key={i}><TableCell>{fmtDate(r.txn_date)}</TableCell><TableCell>{r.farmers?.name_en}</TableCell><TableCell>{r.type}</TableCell><TableCell>{money(r.amount)}</TableCell><TableCell>{r.status}</TableCell></TableRow>)}</TableBody>
          </Table></Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

function ExportBar({ onPdf, onXlsx }: { onPdf: () => void; onXlsx: () => void }) {
  const { t } = useLang();
  return (
    <div className="flex justify-end gap-2 mb-3">
      <Button size="sm" variant="outline" onClick={onPdf}><FileDown className="h-4 w-4 mr-1" />{t("exportPdf")}</Button>
      <Button size="sm" variant="outline" onClick={onXlsx}><FileSpreadsheet className="h-4 w-4 mr-1" />{t("exportExcel")}</Button>
    </div>
  );
}
