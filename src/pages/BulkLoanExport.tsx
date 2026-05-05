import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageProvider";
import { fmtDate } from "@/lib/format";

export default function BulkLoanExport() {
  const { t } = useLang();
  const [farmers, setFarmers] = useState<any[]>([]);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = `${t("bulkExportLoans")} — ${t("appName")}`;
    supabase.from("farmers").select("id,name_en,farmer_code,member_no,village").is("deleted_at", null).order("name_en").limit(2000)
      .then(({ data }) => setFarmers(data ?? []));
  }, [t]);

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

  async function exportExcel() {
    if (!selected.size) return toast.error(t("nothingToExport"));
    setBusy(true);
    try {
      const ids = Array.from(selected);
      const [{ data: loans }, { data: ins }, { data: pays }] = await Promise.all([
        supabase.from("loans").select("id,farmer_id,issued_on,principal,interest_rate,total_payable,status,farmers(name_en,farmer_code,member_no)").in("farmer_id", ids).is("deleted_at", null),
        supabase.from("loan_installments").select("*").in("loan_id", []),
        Promise.resolve({ data: [] as any[] }),
      ]);
      const loanIds = (loans ?? []).map(l => l.id);
      const [insRes, payRes] = await Promise.all([
        loanIds.length ? supabase.from("loan_installments").select("*").in("loan_id", loanIds).order("installment_no") : Promise.resolve({ data: [] as any[] }),
        loanIds.length ? supabase.from("loan_payments").select("*").in("loan_id", loanIds).order("paid_on") : Promise.resolve({ data: [] as any[] }),
      ]);
      const insAll = insRes.data ?? [];
      const payAll = payRes.data ?? [];
      const today = new Date(); today.setHours(0, 0, 0, 0);

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
      XLSX.writeFile(wb, `bulk-loans-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success(t("saved"));
    } catch (e: any) {
      toast.error(e.message ?? "Export failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title={t("bulkExportLoans")} description={t("bulkExportLoansDesc")} />
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input placeholder={t("search")} value={filter} onChange={e => setFilter(e.target.value)} className="max-w-sm" />
          <Button variant="outline" onClick={selectAllVisible}>Select all visible</Button>
          <Button variant="outline" onClick={() => setSelected(new Set())}>Clear</Button>
          <div className="ml-auto text-sm text-muted-foreground">{selected.size} {t("selectFarmers")}</div>
          <Button onClick={exportExcel} disabled={busy || !selected.size}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileSpreadsheet className="h-4 w-4 mr-1" />}{t("exportExcel")}
          </Button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto border rounded">
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
      </Card>
    </>
  );
}
