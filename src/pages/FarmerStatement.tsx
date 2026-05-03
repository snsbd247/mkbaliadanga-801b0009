import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FarmerSearchSelect } from "@/components/farmers/FarmerSearchSelect";
import { FileText, FileSpreadsheet, RefreshCw } from "lucide-react";
import { money, fmtDate } from "@/lib/format";
import { exportStatementPDF } from "@/lib/exports";
import { exportExcel } from "@/lib/exports";
import { useBranding } from "@/lib/branding";
import { toast } from "sonner";

type Row = {
  id: string;
  entry_date: string;
  description: string | null;
  debit: number;
  credit: number;
  balance: number;
  reference_type: string | null;
  reference_id: string | null;
};

type Kind = "savings" | "loan";

export default function FarmerStatement() {
  const brand = useBranding();
  const [kind, setKind] = useState<Kind>("savings");
  const [farmerId, setFarmerId] = useState<string | null>(null);
  const [farmer, setFarmer] = useState<any>(null);
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { document.title = "Farmer Statement"; }, []);

  useEffect(() => {
    if (!farmerId) { setFarmer(null); return; }
    supabase.from("farmers")
      .select("id, name_en, name_bn, account_number, farmer_code, mobile, village")
      .eq("id", farmerId).maybeSingle()
      .then(r => setFarmer(r.data));
  }, [farmerId]);

  async function load() {
    if (!farmerId) { toast.error("Select a farmer"); return; }
    setLoading(true);
    try {
      const fn = kind === "savings" ? "farmer_savings_statement" : "farmer_loan_statement";
      const { data, error } = await supabase.rpc(fn, {
        _farmer_id: farmerId,
        _from: from || null,
        _to: to || null,
      });
      if (error) throw error;
      setRows((data as Row[]) ?? []);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load statement");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (farmerId) load(); /* eslint-disable-next-line */ }, [kind, farmerId]);

  const totals = useMemo(() => {
    const debit = rows.reduce((s, r) => s + Number(r.debit || 0), 0);
    const credit = rows.reduce((s, r) => s + Number(r.credit || 0), 0);
    const closing = rows.length ? Number(rows[rows.length - 1].balance) : 0;
    return { debit, credit, closing };
  }, [rows]);

  function pdf() {
    if (!farmer) { toast.error("Select a farmer first"); return; }
    exportStatementPDF({
      brand: { company_name: brand.company_name, address: brand.address ?? "" },
      kind,
      farmer,
      from, to,
      rows,
      totals,
    });
  }

  function xlsx() {
    if (!farmer) return;
    exportExcel(
      `${kind}-statement-${farmer.account_number ?? farmer.farmer_code}`,
      kind === "savings" ? "Savings" : "Loan",
      rows.map(r => ({
        Date: r.entry_date,
        Description: r.description ?? "",
        Debit: Number(r.debit) || 0,
        Credit: Number(r.credit) || 0,
        Balance: Number(r.balance) || 0,
      })),
      { from, to }
    );
  }

  return (
    <div className="p-4 space-y-4">
      <PageHeader title="Farmer Statement" subtitle="Bank-style statement from ledger" />

      <Card className="p-4 space-y-4">
        <Tabs value={kind} onValueChange={(v) => setKind(v as Kind)}>
          <TabsList>
            <TabsTrigger value="savings">Savings</TabsTrigger>
            <TabsTrigger value="loan">Loan</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="md:col-span-2">
            <Label>Farmer</Label>
            <FarmerSearchSelect value={farmerId ?? ""} onChange={(v) => setFarmerId(v || null)} />
          </div>
          <div>
            <Label>From</Label>
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>To</Label>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={load} disabled={!farmerId || loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Load
          </Button>
          <Button variant="outline" onClick={pdf} disabled={!rows.length}>
            <FileText className="h-4 w-4 mr-2" /> Export PDF
          </Button>
          <Button variant="outline" onClick={xlsx} disabled={!rows.length}>
            <FileSpreadsheet className="h-4 w-4 mr-2" /> Export Excel
          </Button>
        </div>

        {farmer && (
          <div className="rounded border p-3 text-sm bg-muted/30">
            <div className="font-semibold">{farmer.name_en} {farmer.name_bn ? `(${farmer.name_bn})` : ""}</div>
            <div className="text-muted-foreground">
              A/C: {farmer.account_number ?? "—"} · Code: {farmer.farmer_code} · Mobile: {farmer.mobile ?? "—"}
            </div>
          </div>
        )}
      </Card>

      <Card className="p-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right w-32">Debit</TableHead>
              <TableHead className="text-right w-32">Credit</TableHead>
              <TableHead className="text-right w-32">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                {farmerId ? "No transactions in selected range." : "Select a farmer to view statement."}
              </TableCell></TableRow>
            ) : rows.map(r => (
              <TableRow key={r.id}>
                <TableCell>{fmtDate(r.entry_date)}</TableCell>
                <TableCell>{r.description ?? "—"}</TableCell>
                <TableCell className="text-right font-mono">{Number(r.debit) ? money(r.debit) : "—"}</TableCell>
                <TableCell className="text-right font-mono">{Number(r.credit) ? money(r.credit) : "—"}</TableCell>
                <TableCell className="text-right font-mono font-semibold">{money(r.balance)}</TableCell>
              </TableRow>
            ))}
            {rows.length > 0 && (
              <TableRow className="bg-muted/40 font-semibold">
                <TableCell colSpan={2}>Totals</TableCell>
                <TableCell className="text-right font-mono">{money(totals.debit)}</TableCell>
                <TableCell className="text-right font-mono">{money(totals.credit)}</TableCell>
                <TableCell className="text-right font-mono">{money(totals.closing)}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
