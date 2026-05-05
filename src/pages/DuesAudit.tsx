import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FarmerSearchSelect } from "@/components/farmers/FarmerSearchSelect";
import { money } from "@/lib/format";

type SeasonRow = { id: string; name: string; year: number | null };

type IrrRow = {
  id: string; entry_date: string; season_id: string; due_amount: number;
  total: number; paid_amount: number; seasons?: { name: string; year: number | null } | null;
  lands?: { dag_no: string | null } | null;
};

export default function DuesAudit() {
  const [farmerId, setFarmerId] = useState<string | null>(null);
  const [seasons, setSeasons] = useState<SeasonRow[]>([]);
  const [seasonId, setSeasonId] = useState<string>("all");
  const [irr, setIrr] = useState<IrrRow[]>([]);
  const [loanDue, setLoanDue] = useState(0);
  const [savingsBal, setSavingsBal] = useState(0);
  const [shareBal, setShareBal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => { document.title = "Dues Audit — Smart Irrigation"; }, []);
  useEffect(() => { supabase.from("seasons").select("id,name,year").order("year", { ascending: false }).then(r => setSeasons((r.data as any) ?? [])); }, []);

  useEffect(() => {
    if (!farmerId) { setIrr([]); setLoanDue(0); setSavingsBal(0); setShareBal(0); return; }
    setLoading(true);
    (async () => {
      const [{ data: ic }, { data: loans }, { data: savings }] = await Promise.all([
        supabase.from("irrigation_charges")
          .select("id,entry_date,season_id,due_amount,total,paid_amount,seasons(name,year),lands(dag_no)")
          .eq("farmer_id", farmerId).is("deleted_at", null).order("entry_date", { ascending: false }),
        supabase.from("loans").select("id,total_payable,status,loan_payments(amount)").eq("farmer_id", farmerId).is("deleted_at", null),
        supabase.from("savings_transactions").select("amount,type,status").eq("farmer_id", farmerId).is("deleted_at", null),
      ]);
      setIrr((ic as any) ?? []);
      setLoanDue((loans ?? []).filter((l: any) => l.status === "approved").reduce((a: number, l: any) => {
        const paid = (l.loan_payments ?? []).reduce((x: number, p: any) => x + Number(p.amount || 0), 0);
        return a + Math.max(0, Number(l.total_payable || 0) - paid);
      }, 0));
      let sb = 0, sh = 0;
      (savings ?? []).filter((s: any) => s.status === "approved").forEach((s: any) => {
        const sign = s.type === "deposit" || s.type === "share_collection" ? 1 : s.type === "withdraw" ? -1 : 0;
        if (s.type === "share_collection") sh += Number(s.amount || 0) * sign;
        else sb += Number(s.amount || 0) * sign;
      });
      setSavingsBal(sb); setShareBal(sh);
      setLoading(false);
    })();
  }, [farmerId]);

  const filteredIrr = seasonId === "all" ? irr : irr.filter(r => r.season_id === seasonId);
  const totalIrrDueAll = irr.reduce((a, r) => a + Number(r.due_amount || 0), 0);
  const totalIrrDueShown = filteredIrr.reduce((a, r) => a + Number(r.due_amount || 0), 0);
  const netDue = Math.max(0, totalIrrDueAll + loanDue - savingsBal);

  return (
    <>
      <PageHeader title="Dues Audit" description="Verify per-farmer due totals across seasons. Total Due is always sum of all seasons & lands." />
      <Card className="p-4 mb-4 space-y-3">
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <Label>Farmer</Label>
            <FarmerSearchSelect value={farmerId} onChange={setFarmerId} placeholder="Search farmer (name / ID / mobile)" />
          </div>
          <div>
            <Label>Filter by season (display only)</Label>
            <Select value={seasonId} onValueChange={setSeasonId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All seasons</SelectItem>
                {seasons.map(s => <SelectItem key={s.id} value={s.id}>{s.name} {s.year ?? ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <div className="grid md:grid-cols-4 gap-3 mb-4">
        <SumCard label="Irrigation due (ALL seasons)" value={totalIrrDueAll} highlight />
        <SumCard label="Loan due" value={loanDue} />
        <SumCard label="Savings balance" value={savingsBal} />
        <SumCard label="Share balance" value={shareBal} />
      </div>
      <div className="grid md:grid-cols-2 gap-3 mb-4">
        <SumCard label={`Irrigation due — ${seasonId === "all" ? "all" : "selected season"}`} value={totalIrrDueShown} />
        <SumCard label="NET DUE (Loan + Irr − Savings)" value={netDue} bold />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead><TableHead>Season</TableHead><TableHead>Dag</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredIrr.map(r => (
              <TableRow key={r.id}>
                <TableCell>{r.entry_date}</TableCell>
                <TableCell>{r.seasons?.name} {r.seasons?.year ?? ""}</TableCell>
                <TableCell>{r.lands?.dag_no ?? "—"}</TableCell>
                <TableCell className="text-right">{money(r.total)}</TableCell>
                <TableCell className="text-right">{money(r.paid_amount)}</TableCell>
                <TableCell className={"text-right " + (Number(r.due_amount) > 0 ? "due-text font-semibold" : "")}>{money(r.due_amount)}</TableCell>
              </TableRow>
            ))}
            {!loading && filteredIrr.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">{farmerId ? "No irrigation rows for filter." : "Select a farmer to begin."}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

function SumCard({ label, value, highlight, bold }: { label: string; value: number; highlight?: boolean; bold?: boolean }) {
  return (
    <Card className={"p-3 " + (highlight ? "border-primary" : "")}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={"font-mono " + (bold ? "text-xl font-bold" : "text-lg font-semibold")}>{money(value)}</div>
    </Card>
  );
}
