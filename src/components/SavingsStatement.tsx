import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useLang } from "@/i18n/LanguageProvider";
import { money, fmtDate } from "@/lib/format";
import { Printer } from "lucide-react";
import { useBranding } from "@/lib/branding";

interface Props { farmer: any; }

export function SavingsStatement({ farmer }: Props) {
  const { t } = useLang();
  const brand = useBranding();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);
  const [opening, setOpening] = useState<number>(0);
  const [txns, setTxns] = useState<any[]>([]);
  const [priorBalance, setPriorBalance] = useState<number>(0);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [farmer?.id, year]);

  async function load() {
    if (!farmer?.id) return;
    // 1. opening balance for this year (if recorded)
    const { data: ob } = await supabase
      .from("savings_yearly_opening")
      .select("opening_balance")
      .eq("farmer_id", farmer.id).eq("year", year).maybeSingle();

    // 2. txns prior to this year (approved) → fallback opening
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;
    const { data: prior } = await supabase
      .from("savings_transactions")
      .select("type,amount")
      .eq("farmer_id", farmer.id)
      .eq("status", "approved")
      .is("deleted_at", null)
      .lt("txn_date", yearStart);
    const priorBal = (prior ?? []).reduce((s, r: any) => s + (r.type === "deposit" ? +r.amount : -r.amount), 0);
    setPriorBalance(priorBal);
    setOpening(ob?.opening_balance != null ? Number(ob.opening_balance) : priorBal);

    // 3. txns within year (any status, latest first)
    const { data: t } = await supabase
      .from("savings_transactions")
      .select("*")
      .eq("farmer_id", farmer.id)
      .is("deleted_at", null)
      .gte("txn_date", yearStart)
      .lte("txn_date", yearEnd)
      .order("txn_date", { ascending: true });
    setTxns(t ?? []);
  }

  const enriched = useMemo(() => {
    let bal = opening;
    return txns.map(r => {
      if (r.status === "approved") bal += r.type === "deposit" ? Number(r.amount) : -Number(r.amount);
      return { ...r, running: bal };
    });
  }, [txns, opening]);

  const closing = enriched.length ? enriched[enriched.length - 1].running : opening;

  const years = Array.from({ length: 6 }, (_, i) => currentYear - i);

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden mb-3">
        <div>
          <Label>{t("year")}</Label>
          <select className="block rounded-md border bg-background px-3 py-2 text-sm" value={year} onChange={e => setYear(+e.target.value)}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" />{t("print")}</Button>
      </div>

      <div className="text-center mb-4">
        <div className="font-semibold">{brand.company_name}</div>
        <div className="text-sm">{t("savings")} {t("statement")} — {year}</div>
        <div className="text-xs text-muted-foreground mt-1">
          {farmer.name_en} · {t("memberNo")}: <span className="font-mono">{farmer.member_no ?? "—"}</span> · {t("farmerCode")}: <span className="font-mono">{farmer.farmer_code}</span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 mb-3">
        <div className="rounded-md border p-3">
          <div className="text-xs text-muted-foreground">{t("openingBalance")}</div>
          <div className="text-lg font-bold">{money(opening)}</div>
          {opening !== priorBalance && <div className="text-[10px] text-muted-foreground">prior approved txns: {money(priorBalance)}</div>}
        </div>
        <div className="rounded-md border p-3">
          <div className="text-xs text-muted-foreground">{t("deposit")} ({year})</div>
          <div className="text-lg font-bold text-success">{money(enriched.filter(r => r.status === "approved" && r.type === "deposit").reduce((s, r) => s + Number(r.amount), 0))}</div>
        </div>
        <div className="rounded-md border p-3">
          <div className="text-xs text-muted-foreground">{t("closingBalance")}</div>
          <div className="text-lg font-bold">{money(closing)}</div>
        </div>
      </div>

      <Table>
        <TableHeader><TableRow>
          <TableHead>{t("date")}</TableHead><TableHead>{t("type")}</TableHead>
          <TableHead className="text-right">{t("deposit")}</TableHead>
          <TableHead className="text-right">{t("withdraw")}</TableHead>
          <TableHead className="text-right">{t("runningBalance")}</TableHead>
          <TableHead>{t("status")}</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          <TableRow className="bg-muted/40">
            <TableCell className="font-medium" colSpan={4}>{t("openingBalance")} — Jan 1 {year}</TableCell>
            <TableCell className="text-right font-bold">{money(opening)}</TableCell>
            <TableCell />
          </TableRow>
          {enriched.map(r => (
            <TableRow key={r.id}>
              <TableCell>{fmtDate(r.txn_date)}</TableCell>
              <TableCell>{t(r.type as any)}</TableCell>
              <TableCell className="text-right text-success">{r.type === "deposit" ? money(r.amount) : "—"}</TableCell>
              <TableCell className="text-right text-destructive">{r.type === "withdraw" ? money(r.amount) : "—"}</TableCell>
              <TableCell className="text-right font-semibold">{money(r.running)}</TableCell>
              <TableCell><Badge variant={r.status === "approved" ? "default" : r.status === "pending" ? "outline" : "destructive"}>{t(r.status as any)}</Badge></TableCell>
            </TableRow>
          ))}
          {enriched.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">{t("noData")}</TableCell></TableRow>}
        </TableBody>
      </Table>
    </Card>
  );
}
