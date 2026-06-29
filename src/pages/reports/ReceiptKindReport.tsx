import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { money, fmtDate } from "@/lib/format";
import { exportTablePDF, exportExcel } from "@/lib/exports";
import { FileDown, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Kind = "IRR" | "PAY" | "ALL";

type Row = {
  id: string;
  receipt_no: string | null;
  created_at: string;
  amount: number;
  status: string | null;
  farmer: string;
  kind: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const monthAgo = () => {
  const d = new Date(); d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
};

export default function ReceiptKindReport() {
  const [kind, setKind] = useState<Kind>("IRR");
  const [from, setFrom] = useState(monthAgo());
  const [to, setTo] = useState(today());
  const [loading, setLoading] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);

  async function load() {
    setLoading(true);
    try {
      let q = db
        .from("payments")
        .select("id,receipt_no,created_at,amount,status,kind,farmers(name_en,farmer_code)")
        .gte("created_at", `${from}T00:00:00`)
        .lte("created_at", `${to}T23:59:59`)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(2000);
      if (kind !== "ALL") q = q.like("receipt_no", `${kind}-%`);
      const { data, error } = await q;
      if (error) throw error;
      setRows(
        (data ?? []).map((p: any) => ({
          id: p.id,
          receipt_no: p.receipt_no,
          created_at: p.created_at,
          amount: Number(p.amount) || 0,
          status: p.status,
          farmer: `${p.farmers?.name_en ?? "—"}${p.farmers?.farmer_code ? ` (${p.farmers.farmer_code})` : ""}`,
          kind: p.kind ?? "—",
        })),
      );
    } catch (e: any) {
      toast.error(e.message ?? "Load failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [kind, from, to]);

  const total = useMemo(() => rows.reduce((s, r) => s + r.amount, 0), [rows]);
  const title = `${kind === "IRR" ? "Irrigation Receipts (IRR)" : kind === "PAY" ? "Loan + Savings Receipts (PAY)" : "All Receipts"}`;

  async function onPdf() {
    setPdfBusy(true);
    try {
      const head = ["Date", "Receipt #", "Farmer", "Kind", "Status", "Amount"];
      const body = rows.map((r) => [fmtDate(r.created_at), r.receipt_no ?? "—", r.farmer, r.kind, r.status ?? "—", money(r.amount)]);
      body.push(["", "", "", "", "Total", money(total)]);
      await exportTablePDF(title, head, body, { from, to });
    } catch (e: any) {
      toast.error(e.message ?? "PDF export failed");
    } finally { setPdfBusy(false); }
  }

  function onExcel() {
    try {
      const data = rows.map((r) => ({
        Date: r.created_at.slice(0, 10),
        "Receipt #": r.receipt_no ?? "",
        Farmer: r.farmer,
        Kind: r.kind,
        Status: r.status ?? "",
        Amount: r.amount,
      }));
      data.push({ Date: "", "Receipt #": "", Farmer: "", Kind: "", Status: "Total", Amount: total } as any);
      exportExcel(`receipts-${kind.toLowerCase()}`, title.slice(0, 28), data, { from, to });
    } catch (e: any) {
      toast.error(e.message ?? "Excel export failed");
    }
  }

  return (
    <>
      <PageHeader
        title="Receipt Report (IRR vs PAY)"
        description="Filter receipts by serial kind and export to PDF or Excel."
      />

      <Card className="p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="md:col-span-2">
            <Label>{/* i18n-ignore */}Receipt Kind</Label>
            <Tabs value={kind} onValueChange={(v) => setKind(v as Kind)}>
              <TabsList className="w-full">
                <TabsTrigger value="IRR" className="flex-1">IRR (Irrigation)</TabsTrigger>
                <TabsTrigger value="PAY" className="flex-1">PAY (Loan + Savings)</TabsTrigger>
                <TabsTrigger value="ALL" className="flex-1">All</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div>
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="md:col-span-4 flex gap-2 justify-end">
            <Button onClick={onPdf} disabled={pdfBusy || !rows.length} variant="secondary">
              {pdfBusy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileDown className="h-4 w-4 mr-1" />}
              PDF
            </Button>
            <Button onClick={onExcel} disabled={!rows.length}>
              <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
            </Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Receipt #</TableHead>
              <TableHead>Farmer</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No data</TableCell></TableRow>
            ) : (
              <>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{fmtDate(r.created_at)}</TableCell>
                    <TableCell className="font-mono text-xs">{r.receipt_no ?? "—"}</TableCell>
                    <TableCell>{r.farmer}</TableCell>
                    <TableCell>{r.kind}</TableCell>
                    <TableCell>{r.status ?? "—"}</TableCell>
                    <TableCell className="text-right">{money(r.amount)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold bg-muted/40">
                  <TableCell colSpan={5}>Total ({rows.length} receipts)</TableCell>
                  <TableCell className="text-right">{money(total)}</TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
