import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Download, FileDown, RefreshCw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface AccountRow {
  account_id: string; code: string; name: string; name_bn?: string | null; type: string;
  opening_balance: number; period_debit: number; period_credit: number; closing_balance: number;
}
interface Mismatch {
  kind: "unbalanced_ref" | "orphan_ref";
  reference_type: string; reference_id: string;
  debit?: number; credit?: number; diff?: number; entry_count?: number;
}
interface Report {
  summary: { year: number; month: number; office_id: string | null; total_debit: number; total_credit: number; diff: number; mismatch_count: number; generated_at: string };
  accounts: AccountRow[];
  mismatches: Mismatch[];
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

export default function LedgerReconciliation() {
  const { isSuper } = useAuth();
  const today = new Date();
  const [year, setYear] = useState<number>(today.getFullYear());
  const [month, setMonth] = useState<number>(today.getMonth() + 1);
  const [officeId, setOfficeId] = useState<string>("all");
  const [offices, setOffices] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<Report | null>(null);

  useEffect(() => {
    document.title = "Monthly Ledger Reconciliation";
    supabase.from("offices").select("id,name").order("name").then(({ data }) => setOffices((data ?? []) as any[]));
  }, []);

  const officeName = useMemo(() =>
    officeId === "all" ? "All offices" : (offices.find((o) => o.id === officeId)?.name ?? officeId),
    [officeId, offices]);

  async function run() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Please sign in"); return; }
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ledger-reconcile-monthly`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ year, month, office_id: officeId === "all" ? null : officeId }),
      });
      const j = await res.json();
      if (!res.ok) { toast.error(j?.error || "Failed"); return; }
      setReport(j);
    } finally { setLoading(false); }
  }

  function exportCsv() {
    if (!report) return;
    const headersEn = ["Code", "Account", "Type", "Opening Balance", "Period Debit", "Period Credit", "Closing Balance"];
    const headersBn = ["কোড", "হিসাব", "ধরন", "প্রারম্ভিক স্থিতি", "মাস ডেবিট", "মাস ক্রেডিট", "সমাপনী স্থিতি"];
    const esc = (v: any) => {
      const s = String(v ?? "").replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const lines: string[] = [];
    lines.push(`Office,${esc(officeName)},Period,${year}-${String(month).padStart(2, "0")}`);
    lines.push("");
    lines.push("== Accounts ==");
    lines.push(headersEn.map(esc).join(","));
    lines.push(headersBn.map(esc).join(","));
    for (const a of report.accounts) {
      const name = a.name_bn ? `${a.name} / ${a.name_bn}` : a.name;
      lines.push([a.code, name, a.type, a.opening_balance, a.period_debit, a.period_credit, a.closing_balance].map(esc).join(","));
    }
    lines.push("");
    lines.push(`Totals,Debit,${report.summary.total_debit},Credit,${report.summary.total_credit},Diff,${report.summary.diff}`);
    lines.push("");
    lines.push("== Mismatches ==");
    if (report.mismatches.length === 0) {
      lines.push("None — ledger is consistent.");
    } else {
      lines.push(["Kind", "Reference Type", "Reference ID", "Debit", "Credit", "Diff", "Entry Count"].map(esc).join(","));
      for (const m of report.mismatches) {
        lines.push([m.kind, m.reference_type, m.reference_id, m.debit ?? "", m.credit ?? "", m.diff ?? "", m.entry_count ?? ""].map(esc).join(","));
      }
    }

    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reconciliation-${year}-${String(month).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPdf() {
    if (!report) return;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text("Monthly Ledger Reconciliation", 14, 14);
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text(`Office: ${officeName}`, 14, 21);
    doc.text(`Period: ${year}-${String(month).padStart(2, "0")}`, 14, 26);
    doc.text(`Generated: ${new Date(report.summary.generated_at).toLocaleString()}`, 14, 31);

    autoTable(doc, {
      startY: 36,
      head: [["Code", "Account", "Type", "Opening", "Debit", "Credit", "Closing"]],
      body: report.accounts.map((a) => [
        a.code, a.name, a.type,
        fmt(a.opening_balance), fmt(a.period_debit), fmt(a.period_credit), fmt(a.closing_balance),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [40, 80, 140] },
    });

    const afterAccountsY = (doc as any).lastAutoTable.finalY + 6;
    doc.setFont("helvetica", "bold");
    doc.text(
      `Totals — Debit: ${fmt(report.summary.total_debit)}   Credit: ${fmt(report.summary.total_credit)}   Diff: ${fmt(report.summary.diff)}`,
      14, afterAccountsY,
    );

    if (report.mismatches.length > 0) {
      autoTable(doc, {
        startY: afterAccountsY + 4,
        head: [["Kind", "Reference", "Debit", "Credit", "Diff", "Entries"]],
        body: report.mismatches.map((m) => [
          m.kind, `${m.reference_type}/${m.reference_id.slice(0, 8)}…`,
          m.debit != null ? fmt(m.debit) : "—",
          m.credit != null ? fmt(m.credit) : "—",
          m.diff != null ? fmt(m.diff) : "—",
          m.entry_count ?? "—",
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [180, 60, 60] },
      });
    } else {
      doc.setFont("helvetica", "italic");
      doc.text("No mismatches detected — ledger is consistent.", 14, afterAccountsY + 8);
    }

    doc.save(`reconciliation-${year}-${String(month).padStart(2, "0")}.pdf`);
  }

  if (!isSuper) {
    return (
      <>
        <PageHeader title="Ledger Reconciliation" />
        <Alert variant="destructive"><AlertDescription>This page is restricted to administrators.</AlertDescription></Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Monthly Ledger Reconciliation"
        description="Compare opening, period and closing balances per account; highlight mismatches; export by office."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!report}>
              <Download className="h-4 w-4" />CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportPdf} disabled={!report}>
              <FileDown className="h-4 w-4" />PDF
            </Button>
          </div>
        }
      />

      <Card className="p-4 mb-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <Label className="text-xs">Year</Label>
            <Input type="number" min={2000} max={3000} value={year} onChange={(e) => setYear(Number(e.target.value))} />
          </div>
          <div>
            <Label className="text-xs">Month</Label>
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }).map((_, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>
                    {new Date(2000, i, 1).toLocaleString(undefined, { month: "long" })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Office</Label>
            <Select value={officeId} onValueChange={setOfficeId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All offices</SelectItem>
                {offices.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={run} disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Run reconciliation
            </Button>
          </div>
        </div>
      </Card>

      {report && (
        <>
          <Card className="p-4 mb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><div className="text-xs text-muted-foreground">Total Debit</div><div className="font-mono font-semibold">{fmt(report.summary.total_debit)}</div></div>
              <div><div className="text-xs text-muted-foreground">Total Credit</div><div className="font-mono font-semibold">{fmt(report.summary.total_credit)}</div></div>
              <div>
                <div className="text-xs text-muted-foreground">Difference</div>
                <div className={`font-mono font-semibold ${Math.abs(report.summary.diff) > 0.01 ? "text-destructive" : "text-success"}`}>
                  {fmt(report.summary.diff)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Mismatches</div>
                <div className={`font-semibold ${report.mismatches.length > 0 ? "text-destructive" : "text-success"}`}>
                  {report.mismatches.length}
                </div>
              </div>
            </div>
          </Card>

          <Card className="mb-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Opening</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Closing</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.accounts.map((a) => (
                  <TableRow key={a.account_id}>
                    <TableCell className="font-mono text-xs">{a.code}</TableCell>
                    <TableCell>{a.name}{a.name_bn ? <span className="text-muted-foreground"> / {a.name_bn}</span> : null}</TableCell>
                    <TableCell><Badge variant="secondary">{a.type}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(a.opening_balance)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(a.period_debit)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(a.period_credit)}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{fmt(a.closing_balance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {report.mismatches.length > 0 && (
            <Card className="p-4 border-destructive/50">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <h3 className="font-semibold text-destructive">Mismatches ({report.mismatches.length})</h3>
              </div>
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left p-2">Kind</th>
                      <th className="text-left p-2">Reference</th>
                      <th className="text-right p-2">Debit</th>
                      <th className="text-right p-2">Credit</th>
                      <th className="text-right p-2">Diff</th>
                      <th className="text-right p-2">Entries</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.mismatches.map((m, i) => (
                      <tr key={i} className="border-b">
                        <td className="p-2"><Badge variant="destructive">{m.kind}</Badge></td>
                        <td className="p-2 font-mono">{m.reference_type}/{m.reference_id.slice(0, 8)}…</td>
                        <td className="p-2 text-right tabular-nums">{m.debit != null ? fmt(m.debit) : "—"}</td>
                        <td className="p-2 text-right tabular-nums">{m.credit != null ? fmt(m.credit) : "—"}</td>
                        <td className="p-2 text-right tabular-nums">{m.diff != null ? fmt(m.diff) : "—"}</td>
                        <td className="p-2 text-right tabular-nums">{m.entry_count ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </>
  );
}
