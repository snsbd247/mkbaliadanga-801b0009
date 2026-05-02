import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLang } from "@/i18n/LanguageProvider";
import { money, fmtDate } from "@/lib/format";
import { exportTablePDF, exportExcel, exportFarmerCombinedStatementPDF } from "@/lib/exports";
import { useBranding } from "@/lib/branding";
import { Printer, FileSpreadsheet, FileDown, FileText } from "lucide-react";
import { toast } from "sonner";

type Row = { date: string; particulars: string; deposit: number; withdraw: number; balance: number };

export default function Statement() {
  const { t: tt } = useLang();
  const t = tt as unknown as (k: string) => string;
  const brand = useBranding();
  const [farmers, setFarmers] = useState<any[]>([]);
  const [farmerId, setFarmerId] = useState<string>("");
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [opening, setOpening] = useState<number>(0);
  const [txns, setTxns] = useState<any[]>([]);
  const [farmer, setFarmer] = useState<any>(null);

  useEffect(() => {
    document.title = `${t("statement") || "Member Statement"} — ${t("appName")}`;
    supabase.from("farmers").select("id,farmer_code,member_no,name_en,name_bn,mobile,village")
      .order("name_en").limit(1000).then(r => setFarmers(r.data ?? []));
  }, []);

  useEffect(() => {
    (async () => {
      if (!farmerId) { setTxns([]); setOpening(0); setFarmer(null); return; }
      const f = farmers.find(x => x.id === farmerId);
      setFarmer(f ?? null);

      // Yearly opening (if any)
      const { data: o } = await supabase
        .from("savings_yearly_opening")
        .select("opening_balance")
        .eq("farmer_id", farmerId).eq("year", year).maybeSingle();
      let open = Number(o?.opening_balance ?? 0);

      // If no yearly opening row, derive from approved txns before Jan 1 of `year`
      if (!o) {
        const start = `${year}-01-01`;
        const { data: prior } = await supabase
          .from("savings_transactions")
          .select("type,amount,status,txn_date")
          .eq("farmer_id", farmerId).eq("status", "approved").lt("txn_date", start);
        open = (prior ?? []).reduce((acc: number, r: any) =>
          acc + (r.type === "deposit" ? Number(r.amount) : -Number(r.amount)), 0);
      }
      setOpening(open);

      // Period filter (defaults to whole year)
      const f1 = from || `${year}-01-01`;
      const t1 = to || `${year}-12-31`;
      const { data: list } = await supabase
        .from("savings_transactions")
        .select("id,type,amount,status,txn_date,note")
        .eq("farmer_id", farmerId)
        .eq("status", "approved")
        .gte("txn_date", f1).lte("txn_date", t1)
        .order("txn_date", { ascending: true });
      setTxns(list ?? []);
    })();
  }, [farmerId, year, from, to, farmers]);

  const rows = useMemo<Row[]>(() => {
    let bal = opening;
    const out: Row[] = [{
      date: from || `${year}-01-01`,
      particulars: t("openingBalance") || "Opening Balance",
      deposit: 0, withdraw: 0, balance: bal,
    }];
    for (const r of txns) {
      const dep = r.type === "deposit" ? Number(r.amount) : 0;
      const wdr = r.type === "withdraw" ? Number(r.amount) : 0;
      bal = bal + dep - wdr;
      out.push({ date: r.txn_date, particulars: r.note || (r.type === "deposit" ? "Deposit" : "Withdraw"), deposit: dep, withdraw: wdr, balance: bal });
    }
    return out;
  }, [txns, opening, from, to, year, t]);

  const totals = useMemo(() => ({
    deposit: rows.reduce((a, r) => a + r.deposit, 0),
    withdraw: rows.reduce((a, r) => a + r.withdraw, 0),
    closing: rows.length ? rows[rows.length - 1].balance : opening,
  }), [rows, opening]);

  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

  const tableHead = [t("date") || "Date", t("particulars") || "Particulars", t("deposit") || "Deposit", t("withdraw") || "Withdraw", t("balance") || "Balance"];
  const tableRows = rows.map(r => [fmtDate(r.date), r.particulars, money(r.deposit), money(r.withdraw), money(r.balance)]);

  function exportPDF() {
    const title = `${farmer?.name_en ?? ""} (${farmer?.member_no ?? farmer?.farmer_code ?? ""}) — ${t("statement") || "Statement"} ${year}`;
    exportTablePDF(title, tableHead, tableRows);
  }
  function exportXLSX() {
    exportExcel(`statement_${farmer?.member_no ?? farmer?.farmer_code ?? "member"}_${year}.xlsx`, "Statement",
      rows.map(r => ({ Date: r.date, Particulars: r.particulars, Deposit: r.deposit, Withdraw: r.withdraw, Balance: r.balance }))
    );
  }

  async function exportCombinedPDF() {
    if (!farmerId || !farmer) return toast.error("Pick a member first");
    const f1 = from || `${year}-01-01`;
    const t1 = to || `${year}-12-31`;
    const tid = toast.loading("Building combined statement…");
    try {
      const [irrRes, loansRes] = await Promise.all([
        supabase.from("irrigation_charges")
          .select("entry_date,total,paid_amount,due_amount,seasons(name,year),lands(dag_no)")
          .eq("farmer_id", farmerId).gte("entry_date", f1).lte("entry_date", t1)
          .order("entry_date", { ascending: true }),
        supabase.from("loans")
          .select("issued_on,principal,interest_rate,total_payable,status,loan_payments(amount)")
          .eq("farmer_id", farmerId).gte("issued_on", f1).lte("issued_on", t1)
          .order("issued_on", { ascending: true }),
      ]);
      const irrigation = (irrRes.data ?? []).map((r: any) => ({
        entry_date: r.entry_date,
        season: r.seasons ? `${r.seasons.name} ${r.seasons.year}` : "—",
        dag: r.lands?.dag_no ?? "—",
        total: Number(r.total || 0),
        paid_amount: Number(r.paid_amount || 0),
        due_amount: Number(r.due_amount || 0),
      }));
      const loansList = (loansRes.data ?? []).map((l: any) => {
        const paid = (l.loan_payments ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0);
        return {
          issued_on: l.issued_on, principal: Number(l.principal || 0), interest_rate: Number(l.interest_rate || 0),
          total_payable: Number(l.total_payable || 0), status: l.status, paid,
          due: Math.max(0, Number(l.total_payable || 0) - paid),
        };
      });

      exportFarmerCombinedStatementPDF({
        brand: { company_name: brand.company_name, address: brand.address, mobile: brand.mobile },
        farmer,
        range: { from: f1, to: t1 },
        opening_savings: opening,
        savings: txns.map((s: any) => ({ txn_date: s.txn_date, type: s.type, amount: Number(s.amount), note: s.note })),
        irrigation,
        loans: loansList,
      });
      toast.success("Statement generated", { id: tid });
    } catch (e: any) {
      toast.error(e?.message || "Failed", { id: tid });
    }
  }

  return (
    <>
      <PageHeader title={t("statement") || "Member Statement"} />
      <Card className="p-4 mb-4">
        <div className="grid gap-3 md:grid-cols-5">
          <div className="md:col-span-2">
            <Label>{t("selectFarmer") || "Select member"}</Label>
            <Select value={farmerId} onValueChange={setFarmerId}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {farmers.map(f => (
                  <SelectItem key={f.id} value={f.id}>
                    {(f.member_no || f.farmer_code)} — {f.name_en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("year") || "Year"}</Label>
            <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>{t("from") || "From"}</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><Label>{t("to") || "To"}</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
        </div>
        <div className="flex gap-2 mt-3">
          <Button variant="outline" size="sm" onClick={() => window.print()} disabled={!farmerId}><Printer className="h-4 w-4 mr-1" />{t("print") || "Print"}</Button>
          <Button variant="outline" size="sm" onClick={exportPDF} disabled={!farmerId}><FileDown className="h-4 w-4 mr-1" />PDF</Button>
          <Button variant="outline" size="sm" onClick={exportXLSX} disabled={!farmerId}><FileSpreadsheet className="h-4 w-4 mr-1" />Excel</Button>
          <Button size="sm" onClick={exportCombinedPDF} disabled={!farmerId}><FileText className="h-4 w-4 mr-1" />Full Statement PDF (Loans + Savings + Irrigation)</Button>
        </div>
      </Card>

      {farmer && (
        <Card className="p-4 mb-4 print:shadow-none">
          <div className="flex flex-wrap justify-between gap-3">
            <div>
              <div className="text-lg font-semibold">{farmer.name_en} {farmer.name_bn ? <span className="text-muted-foreground">({farmer.name_bn})</span> : null}</div>
              <div className="text-sm text-muted-foreground">{farmer.village}</div>
              <div className="text-xs font-mono mt-1">
                {t("memberNo") || "Member"}: {farmer.member_no || "—"} • {t("farmerCode") || "Code"}: {farmer.farmer_code} • {farmer.mobile || ""}
              </div>
            </div>
            <div className="text-right text-sm">
              <div><span className="text-muted-foreground">{t("openingBalance") || "Opening"}:</span> <b>{money(opening)}</b></div>
              <div><span className="text-muted-foreground">{t("closingBalance") || "Closing"}:</span> <b className="text-primary">{money(totals.closing)}</b></div>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tableHead[0]}</TableHead>
              <TableHead>{tableHead[1]}</TableHead>
              <TableHead className="text-right">{tableHead[2]}</TableHead>
              <TableHead className="text-right">{tableHead[3]}</TableHead>
              <TableHead className="text-right">{tableHead[4]}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!farmerId && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">{t("selectFarmer") || "Select a member to view statement"}</TableCell></TableRow>}
            {farmerId && rows.map((r, i) => (
              <TableRow key={i} className={i === 0 ? "bg-muted/40 font-medium" : ""}>
                <TableCell className="whitespace-nowrap">{fmtDate(r.date)}</TableCell>
                <TableCell>{r.particulars}</TableCell>
                <TableCell className="text-right">{r.deposit ? money(r.deposit) : "—"}</TableCell>
                <TableCell className="text-right">{r.withdraw ? money(r.withdraw) : "—"}</TableCell>
                <TableCell className="text-right font-semibold">{money(r.balance)}</TableCell>
              </TableRow>
            ))}
            {farmerId && (
              <TableRow className="bg-muted/60 font-bold">
                <TableCell colSpan={2} className="text-right">{t("total") || "Total"}</TableCell>
                <TableCell className="text-right">{money(totals.deposit)}</TableCell>
                <TableCell className="text-right">{money(totals.withdraw)}</TableCell>
                <TableCell className="text-right">{money(totals.closing)}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
