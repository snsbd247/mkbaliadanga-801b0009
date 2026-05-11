import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, FileSpreadsheet, Download, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageProvider";
import { fmtDate } from "@/lib/format";

type JobStatus = "idle" | "processing" | "completed" | "failed";

export default function BulkLoanExport() {
  const { t } = useLang();
  const { isAdmin, rolesLoaded } = useAuth();
  const [farmers, setFarmers] = useState<any[]>([]);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [status, setStatus] = useState<JobStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = `${t("bulkExportLoans")} — ${t("appName")}`;
    supabase.from("farmers").select("id,name_en,farmer_code,member_no,village").is("deleted_at", null).order("name_en").limit(2000)
      .then(({ data }) => setFarmers(data ?? []));
  }, [t]);

  useEffect(() => () => { if (downloadUrl) URL.revokeObjectURL(downloadUrl); }, [downloadUrl]);

  if (!rolesLoaded) return <div className="p-6 text-muted-foreground">{t("loading")}</div>;
  if (!isAdmin) {
    return (
      <>
        <PageHeader title={t("bulkExportLoans")} />
        <Alert variant="destructive"><AlertDescription>Restricted to admin / super admin.</AlertDescription></Alert>
      </>
    );
  }

  const filtered = farmers.filter(f => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return [f.name_en, f.farmer_code, f.member_no, f.village].some(v => String(v ?? "").toLowerCase().includes(q));
  });

  function toggle(id: string) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }
  function selectAllVisible() {
    const next = new Set(selected);
    filtered.forEach(f => next.add(f.id));
    setSelected(next);
  }

  function bump(p: number, label: string) { setProgress(p); setProgressLabel(label); }

  async function exportExcel() {
    if (!selected.size) return toast.error(t("nothingToExport"));
    if (downloadUrl) { URL.revokeObjectURL(downloadUrl); setDownloadUrl(null); }
    setStatus("processing"); setError(null); setProgress(0);
    try {
      const ids = Array.from(selected);
      bump(10, `Fetching loans for ${ids.length} farmers…`);
      const { data: loans, error: lerr } = await supabase
        .from("loans")
        .select("id,farmer_id,issued_on,principal,interest_rate,total_payable,status,farmers(name_en,farmer_code,member_no)")
        .in("farmer_id", ids).is("deleted_at", null);
      if (lerr) throw lerr;
      const loanIds = (loans ?? []).map(l => l.id);

      bump(35, `Fetching ${loanIds.length} installment schedules…`);
      const insRes = loanIds.length
        ? await supabase.from("loan_installments").select("*").in("loan_id", loanIds).order("installment_no")
        : { data: [] as any[], error: null };
      if (insRes.error) throw insRes.error;

      bump(55, "Fetching payment history…");
      const payRes = loanIds.length
        ? await supabase.from("loan_payments").select("*").in("loan_id", loanIds).order("paid_on")
        : { data: [] as any[], error: null };
      if (payRes.error) throw payRes.error;

      const insAll = insRes.data ?? [];
      const payAll = payRes.data ?? [];
      const today = new Date(); today.setHours(0, 0, 0, 0);

      bump(75, "Building Excel workbook…");
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      const summary = [["Farmer Name", "Farmer Code", "Member No", "Loan ID", "Issued", "Principal", "Interest %", "Total Payable", "Paid", "Due", "Status"]];
      const insRows: any[][] = [["Installment Ref ID", "Loan ID", "Farmer Code", "Farmer Name", "#", "Due Date", "Amount", "Paid", "Status", "Overdue"]];
      const payRows: any[][] = [["Payment ID", "Loan ID", "Farmer Code", "Farmer Name", "Date", "Amount", "Note"]];

      for (const l of (loans ?? [])) {
        const myIns = insAll.filter((i: any) => i.loan_id === l.id);
        const myPays = payAll.filter((p: any) => p.loan_id === l.id);
        const totalPaid = myPays.reduce((s, p) => s + Number(p.amount), 0);
        const due = Math.max(0, Number(l.total_payable) - totalPaid);
        const f = (l as any).farmers ?? {};
        summary.push([f.name_en ?? "", f.farmer_code ?? "", f.member_no ?? "", l.id, fmtDate(l.issued_on), Number(l.principal), Number(l.interest_rate), Number(l.total_payable), totalPaid, due, l.status]);
        for (const i of myIns) {
          insRows.push([i.id, i.loan_id, f.farmer_code ?? "", f.name_en ?? "", i.installment_no, fmtDate(i.due_date), Number(i.amount), Number(i.paid_amount), i.status, i.status !== "paid" && new Date(i.due_date) < today ? "YES" : ""]);
        }
        for (const p of myPays) {
          payRows.push([p.id, p.loan_id, f.farmer_code ?? "", f.name_en ?? "", fmtDate(p.paid_on), Number(p.amount), p.note ?? ""]);
        }
      }
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Loans");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(insRows), "Installments");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(payRows), "Payments");

      bump(95, "Finalizing file…");
      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const name = `bulk-loans-${new Date().toISOString().slice(0, 10)}.xlsx`;
      setDownloadUrl(url); setDownloadName(name);
      bump(100, `Ready · ${(loans ?? []).length} loans · ${insAll.length} installments`);
      setStatus("completed");
      toast.success("Export completed");
    } catch (e: any) {
      setError(e.message ?? "Export failed");
      setStatus("failed");
      toast.error(e.message ?? "Export failed");
    }
  }

  const statusBadge = () => {
    if (status === "processing") return <Badge variant="secondary"><Loader2 className="h-3 w-3 animate-spin mr-1" />Processing</Badge>;
    if (status === "completed") return <Badge className="bg-green-600 hover:bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>;
    if (status === "failed") return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
    return null;
  };

  return (
    <>
      <PageHeader title={t("bulkExportLoans")} description={t("bulkExportLoansDesc")} />
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input placeholder={t("search")} value={filter} onChange={e => setFilter(e.target.value)} className="max-w-sm" />
          <Button variant="outline" onClick={selectAllVisible}>{t("selectAllVisible")}</Button>
          <Button variant="outline" onClick={() => setSelected(new Set())}>{t("clear")}</Button>
          <div className="ml-auto text-sm text-muted-foreground">{selected.size} {t("selectFarmers")}</div>
          <Button onClick={exportExcel} disabled={status === "processing" || !selected.size}>
            {status === "processing" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileSpreadsheet className="h-4 w-4 mr-1" />}{t("exportExcel")}
          </Button>
        </div>

        {status !== "idle" && (
          <Card className="p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold">Job status:</span>
              {statusBadge()}
              {status === "completed" && downloadUrl && (
                <Button size="sm" variant="outline" asChild className="ml-auto">
                  <a href={downloadUrl} download={downloadName}><Download className="h-4 w-4 mr-1" />Download</a>
                </Button>
              )}
            </div>
            <Progress value={progress} />
            <div className="text-xs text-muted-foreground">{progressLabel}</div>
            {error && <div className="text-xs text-destructive">{error}</div>}
          </Card>
        )}

        <div className="max-h-[60vh] overflow-y-auto border rounded">
          <div data-table-wrap className="w-full overflow-x-auto">
            <table className="w-full text-sm">
            <thead className="bg-muted sticky top-0"><tr><th className="p-2 w-10"></th><th className="p-2 text-left">{t("farmerName")}</th><th className="p-2 text-left">{t("farmerCode")}</th><th className="p-2 text-left">{t("village")}</th></tr></thead>
            <tbody>
              {filtered.map(f => (
                <tr key={f.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => toggle(f.id)}>
                  <td className="p-2"><Checkbox checked={selected.has(f.id)} onCheckedChange={() => toggle(f.id)} /></td>
                  <td className="p-2">{f.name_en}</td>
                  <td className="p-2 font-mono text-xs">{f.farmer_code}</td>
                  <td className="p-2">{f.village ?? "-"}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">{t("noData")}</td></tr>}
            </tbody>
            </table>
          </div>
        </div>
      </Card>
    </>
  );
}
