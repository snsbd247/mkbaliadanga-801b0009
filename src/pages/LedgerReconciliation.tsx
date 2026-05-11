// i18n-ignore-file — admin/utility page
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
import { Loader2, Download, FileDown, RefreshCw, AlertTriangle, Search } from "lucide-react";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLang } from "@/i18n/LanguageProvider";

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

interface DetailEntry {
  id: string; entry_date: string; debit: number; credit: number;
  description: string | null; account_code: string | null; account_name: string | null; account_type: string | null;
}
interface Detail {
  reference_type: string; reference_id: string;
  source_exists: boolean; source: any | null; source_amount: number | null;
  ledger_entries: DetailEntry[]; ledger_debit: number; ledger_credit: number; diff: number;
}

export default function LedgerReconciliation() {
  const { isSuper } = useAuth();
  const { t } = useLang();
  const today = new Date();
  const [year, setYear] = useState<number>(today.getFullYear());
  const [month, setMonth] = useState<number>(today.getMonth() + 1);
  const [officeId, setOfficeId] = useState<string>("all");
  const [offices, setOffices] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    document.title = t("p5_monthlyReconciliationTitle");
    supabase.from("offices").select("id,name").order("name").then(({ data }) => setOffices((data ?? []) as any[]));
  }, [t]);

  const officeName = useMemo(() =>
    officeId === "all" ? t("p5_allOffices") : (offices.find((o) => o.id === officeId)?.name ?? officeId),
    [officeId, offices, t]);

  async function run() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error(t("p5b_pleaseSignIn")); return; }
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ledger-reconcile-monthly`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ year, month, office_id: officeId === "all" ? null : officeId }),
      });
      const j = await res.json();
      if (!res.ok) { toast.error(j?.error || t("p5b_failed")); return; }
      setReport(j);
    } finally { setLoading(false); }
  }

  async function openDetail(referenceType: string, referenceId: string) {
    setDetail({ reference_type: referenceType, reference_id: referenceId, source_exists: false, source: null, source_amount: null, ledger_entries: [], ledger_debit: 0, ledger_credit: 0, diff: 0 });
    setDetailLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error(t("p5b_pleaseSignIn")); return; }
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ledger-reconcile-monthly`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ mode: "detail", reference_type: referenceType, reference_id: referenceId }),
      });
      const j = await res.json();
      if (!res.ok) { toast.error(j?.error || t("p5b_failedToLoadDetail")); setDetail(null); return; }
      setDetail(j.detail);
    } finally { setDetailLoading(false); }
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
        <PageHeader title={t("p5_monthlyReconciliationTitle")} />
        <Alert variant="destructive"><AlertDescription>{t("p5b_adminOnly")}</AlertDescription></Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t("p5_monthlyReconciliationTitle")}
        description={t("p5_monthlyReconciliationDesc")}
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
            <Label className="text-xs">{t("p5_yearLbl")}</Label>
            <Input type="number" min={2000} max={3000} value={year} onChange={(e) => setYear(Number(e.target.value))} />
          </div>
          <div>
            <Label className="text-xs">{t("p5_monthLbl")}</Label>
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
            <Label className="text-xs">{t("p5_officeLbl")}</Label>
            <Select value={officeId} onValueChange={setOfficeId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("p5_allOffices")}</SelectItem>
                {offices.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={run} disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {t("p5_runReconciliation")}
            </Button>
          </div>
        </div>
      </Card>

      {report && (
        <>
          <Card className="p-4 mb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><div className="text-xs text-muted-foreground">{t("p5_totalDebit")}</div><div className="font-mono font-semibold">{fmt(report.summary.total_debit)}</div></div>
              <div><div className="text-xs text-muted-foreground">{t("p5_totalCredit")}</div><div className="font-mono font-semibold">{fmt(report.summary.total_credit)}</div></div>
              <div>
                <div className="text-xs text-muted-foreground">{t("p5_difference")}</div>
                <div className={`font-mono font-semibold ${Math.abs(report.summary.diff) > 0.01 ? "text-destructive" : "text-success"}`}>
                  {fmt(report.summary.diff)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{t("p5_mismatches")}</div>
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
                  <TableHead>{t("p5_shortcutCol")}</TableHead>
                  <TableHead>{t("p5_accountCol")}</TableHead>
                  <TableHead>{t("type")}</TableHead>
                  <TableHead className="text-right">{t("p5_openingCol")}</TableHead>
                  <TableHead className="text-right">{t("p5_debitCol")}</TableHead>
                  <TableHead className="text-right">{t("p5_creditCol")}</TableHead>
                  <TableHead className="text-right">{t("p5_closingCol")}</TableHead>
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
                <h3 className="font-semibold text-destructive">{t("p5_mismatches")} ({report.mismatches.length})</h3>
              </div>
              <div className="overflow-auto">
                <div data-table-wrap className="w-full overflow-x-auto">
                  <table className="w-full text-xs">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left p-2">{t("type")}</th>
                      <th className="text-left p-2">{t("p5_referenceCol")}</th>
                      <th className="text-right p-2">{t("p5_debitCol")}</th>
                      <th className="text-right p-2">{t("p5_creditCol")}</th>
                      <th className="text-right p-2">{t("p5_difference")}</th>
                      <th className="text-right p-2">{t("p5_entriesCol")}</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.mismatches.map((m, i) => (
                      <tr key={i} className="border-b hover:bg-muted/50 cursor-pointer" onClick={() => openDetail(m.reference_type, m.reference_id)}>
                        <td className="p-2"><Badge variant="destructive">{m.kind}</Badge></td>
                        <td className="p-2 font-mono">{m.reference_type}/{m.reference_id.slice(0, 8)}…</td>
                        <td className="p-2 text-right tabular-nums">{m.debit != null ? fmt(m.debit) : "—"}</td>
                        <td className="p-2 text-right tabular-nums">{m.credit != null ? fmt(m.credit) : "—"}</td>
                        <td className="p-2 text-right tabular-nums">{m.diff != null ? fmt(m.diff) : "—"}</td>
                        <td className="p-2 text-right tabular-nums">{m.entry_count ?? "—"}</td>
                        <td className="p-2 text-right"><Search className="h-3 w-3 inline text-muted-foreground" /></td>
                      </tr>
                    ))}
                  </tbody>
                  </table>
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-2">{t("p5_clickRowDetail")}</div>
            </Card>
          )}
        </>
      )}

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{t("p5_drillDown")}</DialogTitle>
          </DialogHeader>
          {detailLoading || !detail ? (
            <div className="py-10 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" />{t("p5b_loadingDots")}</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div><div className="text-xs text-muted-foreground">{t("p5_referenceCol")}</div><div className="font-mono">{detail.reference_type}</div></div>
                <div className="md:col-span-3"><div className="text-xs text-muted-foreground">ID</div><div className="font-mono text-xs">{detail.reference_id}</div></div>
                <div><div className="text-xs text-muted-foreground">{t("p5_ledgerDebit")}</div><div className="font-mono font-semibold">{fmt(detail.ledger_debit)}</div></div>
                <div><div className="text-xs text-muted-foreground">{t("p5_ledgerCredit")}</div><div className="font-mono font-semibold">{fmt(detail.ledger_credit)}</div></div>
                <div>
                  <div className="text-xs text-muted-foreground">{t("p5_sourceAmount")}</div>
                  <div className="font-mono font-semibold">{detail.source_amount != null ? fmt(detail.source_amount) : "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{t("p5_sourceRow")}</div>
                  <div className={`font-semibold ${detail.source_exists ? "text-success" : "text-destructive"}`}>
                    {detail.source_exists ? t("active") : t("p5b_noData")}
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <Card className="p-3">
                  <div className="font-semibold text-sm mb-2">{t("p5_drillDown")} ({detail.ledger_entries.length})</div>
                  <div className="overflow-auto max-h-80">
                    <div data-table-wrap className="w-full overflow-x-auto">
                      <table className="w-full text-xs">
                      <thead className="border-b sticky top-0 bg-card">
                        <tr>
                          <th className="text-left p-1">{t("date")}</th>
                          <th className="text-left p-1">{t("p5_accountCol")}</th>
                          <th className="text-right p-1">{t("p5_debitCol")}</th>
                          <th className="text-right p-1">{t("p5_creditCol")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.ledger_entries.length === 0 && (
                          <tr><td colSpan={4} className="p-3 text-center text-muted-foreground">{t("p5_noLedgerEntries")}</td></tr>
                        )}
                        {detail.ledger_entries.map((e) => (
                          <tr key={e.id} className="border-b">
                            <td className="p-1">{e.entry_date}</td>
                            <td className="p-1">
                              <span className="font-mono text-[10px]">{e.account_code}</span> {e.account_name}
                            </td>
                            <td className="p-1 text-right tabular-nums">{e.debit > 0 ? fmt(e.debit) : ""}</td>
                            <td className="p-1 text-right tabular-nums">{e.credit > 0 ? fmt(e.credit) : ""}</td>
                          </tr>
                        ))}
                      </tbody>
                      </table>
                    </div>
                  </div>
                </Card>
                <Card className="p-3">
                  <div className="font-semibold text-sm mb-2">{t("p5_sourceRecord")}</div>
                  {!detail.source_exists ? (
                    <Alert variant="destructive"><AlertDescription>{t("p5b_noData")}</AlertDescription></Alert>
                  ) : (
                    <div className="overflow-auto max-h-80">
                      <div data-table-wrap className="w-full overflow-x-auto">
                        <table className="w-full text-xs">
                        <tbody>
                          {Object.entries(detail.source ?? {}).map(([k, v]) => (
                            <tr key={k} className="border-b">
                              <td className="p-1 font-mono text-muted-foreground">{k}</td>
                              <td className="p-1 break-all">{v == null ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v)}</td>
                            </tr>
                          ))}
                        </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
