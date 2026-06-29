import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, FileSpreadsheet, FileDown, FileText, Ban, RotateCcw } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useLang } from "@/i18n/LanguageProvider";
import { useAuth } from "@/auth/AuthProvider";
import { toast } from "sonner";
import { getFarmerDues } from "@/lib/farmerDues";
import { formatId5 } from "@/lib/idFormat";

type Row = {
  id: string;
  name_en: string;
  name_bn: string | null;
  account_number: string | null;
  voter_number: string | null;
  mobile: string | null;
  village: string | null;
  is_voter: boolean;
  voter_cancelled_at: string | null;
  voter_cancel_reason: string | null;
  villages?: { name: string | null; name_bn: string | null } | null;
  unions?: { name: string | null } | null;
  upazilas?: { name: string | null } | null;
  districts?: { name: string | null } | null;
  offices?: { name: string | null } | null;
};

function locationOf(r: Row): string {
  const v = r.villages?.name_bn || r.villages?.name || r.village || "";
  const parts = [v, r.unions?.name, r.upazilas?.name, r.districts?.name].filter(Boolean);
  return parts.join(", ") || "—";
}

export default function VoterList() {
  const { t } = useLang();
  const { officeId, isSuper } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState<"active" | "cancelled">("active");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  // Dialog state
  const [target, setTarget] = useState<Row | null>(null);
  const [mode, setMode] = useState<"cancel" | "reactivate" | null>(null);
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState(false);
  const [dues, setDues] = useState<{ savings_balance: number; loan_due: number; irrigation_due: number; share_balance: number } | null>(null);
  const [duesLoading, setDuesLoading] = useState(false);

  useEffect(() => { document.title = `${t("pgVoterListDocTitle" as any)} — ${t("appName")}`; }, [t]);

  useEffect(() => {
    const handle = setTimeout(load, 200);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, tab]);

  async function load() {
    setLoading(true);
    let qy: any = db
      .from("farmers")
      .select("id,name_en,name_bn,account_number,voter_number,mobile,village,is_voter,voter_cancelled_at,voter_cancel_reason,offices(name),upazilas(name),districts(name)")
      .not("voter_number", "is", null)
      .neq("voter_number", "")
      .order(tab === "active" ? "voter_number" : "voter_cancelled_at", { ascending: tab === "active" })
      .limit(500);

    if (tab === "active") qy = qy.eq("is_voter", true);
    else qy = qy.eq("is_voter", false).not("voter_cancelled_at", "is", null);

    if (!isSuper && officeId) qy = qy.eq("office_id", officeId);
    const term = q.trim();
    if (term) {
      qy = qy.or(`voter_number.ilike.%${term}%,name_en.ilike.%${term}%,name_bn.ilike.%${term}%,mobile.ilike.%${term}%,account_number.ilike.%${term}%`);
    }
    const { data } = await (qy as any);
    setRows((data as any) ?? []);
    setLoading(false);
  }

  const total = rows.length;

  async function loadDues(farmerId: string) {
    setDuesLoading(true);
    setDues(null);
    try {
      const d = await getFarmerDues(farmerId);
      setDues({
        savings_balance: d.savings_balance,
        loan_due: d.loan_due,
        irrigation_due: d.irrigation_due,
        share_balance: d.share_balance,
      });
    } catch (e: any) {
      toast.error(e.message ?? t("pgFailedLoadDues" as any));
    } finally {
      setDuesLoading(false);
    }
  }

  function openDialog(r: Row, m: "cancel" | "reactivate") {
    setTarget(r); setMode(m); setReason(""); setDues(null);
    if (m === "cancel") loadDues(r.id);
  }

  async function submitDialog() {
    if (!target || !mode) return;
    if (reason.trim().length < 3) { toast.error(t("pgReasonRequiredMin" as any)); return; }
    setWorking(true);
    const fn = mode === "cancel" ? "cancel_voter_membership" : "reactivate_voter_membership";
    const { error } = await db.rpc(fn as any, { _farmer_id: target.id, _reason: reason.trim() });
    setWorking(false);
    if (error) {
      const msg = error.message || "";
      const m = msg.match(/DUES_BLOCK:(\{.*\})/);
      if (m) {
        try {
          const d = JSON.parse(m[1]);
          const fmt = (n: any) => Number(n || 0).toLocaleString();
          toast.error(t("pgCannotCancelClearDues" as any), {
            description: `${t("pgSavingsBalanceLbl" as any)}: ৳${fmt(d.savings_balance)} • ${t("pgLoanDueLbl" as any)}: ৳${fmt(d.loan_due)} • ${t("pgIrrigationDueLbl" as any)}: ৳${fmt(d.irrigation_due)}`,
            duration: 8000,
          });
          return;
        } catch { /* fallthrough */ }
      }
      toast.error(msg);
      return;
    }
    toast.success(mode === "cancel" ? t("pgVoterCancelledMsg" as any) : t("pgVoterReactivatedMsg" as any));
    setTarget(null); setMode(null); setReason("");
    load();
  }

  function exportExcel() {
    const wb = XLSX.utils.book_new();
    const head = ["Voter #", "Account No", "Name (EN)", "Name (BN)", "Mobile", "Location", "Office"];
    const data = [head, ...rows.map(r => [
      r.voter_number ?? "", r.account_number ?? "", r.name_en, r.name_bn ?? "",
      r.mobile ?? "", locationOf(r), r.offices?.name ?? "",
    ])];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 14 }, { wch: 16 }, { wch: 24 }, { wch: 24 }, { wch: 14 }, { wch: 18 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, "Voters");
    XLSX.writeFile(wb, `voter-list-${tab}-${Date.now()}.xlsx`);
  }

  function exportCsv() {
    const head = ["Voter #", "Account No", "Name (EN)", "Name (BN)", "Mobile", "Location", "Office"];
    const escape = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [head.map(escape).join(",")];
    for (const r of rows) {
      lines.push([
        r.voter_number ?? "", r.account_number ?? "", r.name_en, r.name_bn ?? "",
        r.mobile ?? "", locationOf(r), r.offices?.name ?? "",
      ].map(escape).join(","));
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `voter-list-${tab}-${Date.now()}.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  function exportPdf() {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFontSize(14);
    doc.text(`Voter List (${tab})`, 40, 36);
    doc.setFontSize(10);
    doc.text(`${total} voter${total === 1 ? "" : "s"}`, 40, 52);
    autoTable(doc, {
      startY: 64,
      head: [["Voter #", "Account No", "Name (EN)", "Name (BN)", "Mobile", "Location", "Office"]],
      body: rows.map(r => [
        r.voter_number ?? "", r.account_number ?? "", r.name_en, r.name_bn ?? "",
        r.mobile ?? "", locationOf(r), r.offices?.name ?? "",
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [16, 122, 87] },
    });
    doc.save(`voter-list-${tab}-${Date.now()}.pdf`);
  }

  const headerInfo = useMemo(() => (t("pgVotersCount" as any) as string).replace("{n}", String(total)), [total, t]);

  return (
    <>
      <PageHeader title={t("pgVoterListTitle" as any)} description={headerInfo} actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={total === 0}>
            <FileDown className="h-4 w-4 mr-1" />{t("pgExportCsv" as any)}
          </Button>
          <Button variant="outline" size="sm" onClick={exportExcel} disabled={total === 0}>
            <FileSpreadsheet className="h-4 w-4 mr-1" />{t("pgExportExcel" as any)}
          </Button>
          <Button variant="outline" size="sm" onClick={exportPdf} disabled={total === 0}>
            <FileText className="h-4 w-4 mr-1" />{t("pgExportPdf" as any)}
          </Button>
        </div>
      } />

      <Card className="p-4 mb-4 space-y-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="active">{t("pgActiveVoters")}</TabsTrigger>
            <TabsTrigger value="cancelled">{t("pgCancelled")}</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t("search")} value={q}
            onChange={e => setQ(e.target.value)} className="pl-9" />
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("pgVoterNumber")} #</TableHead>
              <TableHead>{t("pgName")}</TableHead>
              <TableHead>{t("pgAccountNo")}</TableHead>
              <TableHead>{t("pgMobile")}</TableHead>
              <TableHead>{t("pgLocation")}</TableHead>
              <TableHead>{t("pgOffice")}</TableHead>
              {tab === "cancelled" && <TableHead>{t("pgReason")}</TableHead>}
              {isSuper && <TableHead className="text-right">{t("pgAction")}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-mono cursor-pointer" onClick={() => nav(`/farmers/${r.id}`)}>{formatId5(r.voter_number)}</TableCell>
                <TableCell className="cursor-pointer" onClick={() => nav(`/farmers/${r.id}`)}>
                  <div className="font-medium">{r.name_en}</div>
                  {r.name_bn && <div className="text-xs text-muted-foreground">{r.name_bn}</div>}
                </TableCell>
                <TableCell className="font-mono text-xs">{r.account_number ? formatId5(r.account_number) : "—"}</TableCell>
                <TableCell>{r.mobile ?? "—"}</TableCell>
                <TableCell className="text-xs">{locationOf(r)}</TableCell>
                <TableCell className="text-xs">{r.offices?.name ?? "—"}</TableCell>
                {tab === "cancelled" && (
                  <TableCell className="text-xs max-w-[220px] truncate" title={r.voter_cancel_reason ?? ""}>
                    {r.voter_cancel_reason ?? "—"}
                  </TableCell>
                )}
                {isSuper && (
                  <TableCell className="text-right">
                    {tab === "active" ? (
                      <Button size="sm" variant="destructive" onClick={() => openDialog(r, "cancel")}>
                        <Ban className="h-4 w-4 mr-1" />{t("cancel")}
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => openDialog(r, "reactivate")}>
                        <RotateCcw className="h-4 w-4 mr-1" />{t("p5c_reactivateOnly" as any)}
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={isSuper ? (tab === "cancelled" ? 8 : 7) : (tab === "cancelled" ? 7 : 6)} className="text-center text-muted-foreground py-6">
                  {loading ? "…" : t("pgNoRecords")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!target && !!mode} onOpenChange={(o) => { if (!o) { setTarget(null); setMode(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === "cancel" ? t("p5c_cancelOnly" as any) : t("p5c_reactivateOnly" as any)}
            </DialogTitle>
            <DialogDescription>
              {target && (
                <span>
                  <strong>{target.name_en}</strong>
                  {target.name_bn ? ` (${target.name_bn})` : ""} — Voter #{" "}
                  <Badge variant="outline" className="font-mono">{target.voter_number}</Badge>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {mode === "cancel" && (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground border rounded p-3 bg-muted/40">
                {t("pgCancellationRequires" as any)}
                <ul className="list-disc pl-5 mt-1 space-y-0.5">
                  <li>{t("pgEligibilityNoLoan")}</li>
                  <li>{t("pgEligibilityNoIrrigation")}</li>
                </ul>
              </div>
              <div className="rounded border p-3 text-sm">
                <div className="font-medium mb-2">{t("pgCurrentBalances")}</div>
                {duesLoading || !dues ? (
                  <div className="text-xs text-muted-foreground">{t("pgLoadingDues" as any)}</div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Stat label={t("pgSavingsBalanceLbl" as any)} value={dues.savings_balance} bad={dues.savings_balance !== 0} />
                    <Stat label={t("pgShareBalanceLbl" as any)} value={dues.share_balance} />
                    <Stat label={t("pgLoanDueLbl" as any)} value={dues.loan_due} bad={dues.loan_due > 0} />
                    <Stat label={t("pgIrrigationDueLbl" as any)} value={dues.irrigation_due} bad={dues.irrigation_due > 0} />
                  </div>
                )}
                {dues && (dues.savings_balance !== 0 || dues.loan_due > 0 || dues.irrigation_due > 0) && (
                  <div className="mt-2 text-xs text-destructive">{t("pgOutstandingMustClear" as any)}</div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">
              {mode === "cancel" ? t("pgCancellationReason" as any) : t("pgReactivationReason" as any)} <span className="text-destructive">*</span>
            </label>
            <Textarea
              rows={4}
              placeholder={t("pgReasonPlaceholder" as any)}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setTarget(null); setMode(null); }} disabled={working}>
              {t("cancel")}
            </Button>
            <Button
              variant={mode === "cancel" ? "destructive" : "default"}
              onClick={submitDialog}
              disabled={
                working || reason.trim().length < 3 ||
                (mode === "cancel" && (!dues || duesLoading ||
                  dues.savings_balance !== 0 || dues.loan_due > 0 || dues.irrigation_due > 0))
              }
            >
              {working ? t("pgWorking" as any) : mode === "cancel" ? t("pgConfirmCancel" as any) : t("pgConfirmReactivate" as any)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Stat({ label, value, bad }: { label: string; value: number; bad?: boolean }) {
  const fmt = (n: number) => Number(n || 0).toLocaleString();
  return (
    <div className="rounded border p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={"font-mono font-semibold " + (bad ? "text-destructive" : "")}>৳{fmt(value)}</div>
    </div>
  );
}
