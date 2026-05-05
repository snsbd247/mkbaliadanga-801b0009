import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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

  useEffect(() => { document.title = `Voter List — ${t("appName")}`; }, [t]);

  useEffect(() => {
    const handle = setTimeout(load, 200);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, tab]);

  async function load() {
    setLoading(true);
    let qy: any = supabase
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
      // Aggregate: irrigation due, loan due, savings + share balances
      const [{ data: irr }, { data: loans }, { data: savings }] = await Promise.all([
        supabase.from("irrigation_charges").select("due_amount").eq("farmer_id", farmerId).is("deleted_at", null),
        supabase.from("loans").select("id,total_payable,status,loan_payments(amount)").eq("farmer_id", farmerId).is("deleted_at", null),
        supabase.from("savings_transactions").select("amount,type,status").eq("farmer_id", farmerId).is("deleted_at", null),
      ]);
      const irrigation_due = (irr ?? []).reduce((a: number, r: any) => a + Number(r.due_amount || 0), 0);
      const loan_due = (loans ?? []).filter((l: any) => l.status === "approved").reduce((a: number, l: any) => {
        const paid = (l.loan_payments ?? []).reduce((x: number, p: any) => x + Number(p.amount || 0), 0);
        return a + Math.max(0, Number(l.total_payable || 0) - paid);
      }, 0);
      let savings_balance = 0, share_balance = 0;
      (savings ?? []).filter((s: any) => s.status === "approved").forEach((s: any) => {
        const sign = s.type === "deposit" || s.type === "share_collection" ? 1 : s.type === "withdraw" ? -1 : 0;
        if (s.type === "share_collection") share_balance += Number(s.amount || 0) * sign;
        else savings_balance += Number(s.amount || 0) * sign;
      });
      setDues({ savings_balance, loan_due, irrigation_due, share_balance });
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
    if (reason.trim().length < 3) { toast.error("Reason is required (min 3 chars)"); return; }
    setWorking(true);
    const fn = mode === "cancel" ? "cancel_voter_membership" : "reactivate_voter_membership";
    const { error } = await supabase.rpc(fn as any, { _farmer_id: target.id, _reason: reason.trim() });
    setWorking(false);
    if (error) {
      const msg = error.message || "";
      const m = msg.match(/DUES_BLOCK:(\{.*\})/);
      if (m) {
        try {
          const d = JSON.parse(m[1]);
          const fmt = (n: any) => Number(n || 0).toLocaleString();
          toast.error("Cannot cancel — clear all dues first", {
            description: `Savings balance: ৳${fmt(d.savings_balance)} • Loan due: ৳${fmt(d.loan_due)} • Irrigation due: ৳${fmt(d.irrigation_due)}`,
            duration: 8000,
          });
          return;
        } catch { /* fallthrough */ }
      }
      toast.error(msg);
      return;
    }
    toast.success(mode === "cancel" ? "Voter membership cancelled" : "Voter membership reactivated");
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

  const headerInfo = useMemo(() => `${total} voter${total === 1 ? "" : "s"}`, [total]);

  return (
    <>
      <PageHeader title="Voter List" description={headerInfo} actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={total === 0}>
            <FileDown className="h-4 w-4 mr-1" />Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportExcel} disabled={total === 0}>
            <FileSpreadsheet className="h-4 w-4 mr-1" />Export Excel
          </Button>
          <Button variant="outline" size="sm" onClick={exportPdf} disabled={total === 0}>
            <FileText className="h-4 w-4 mr-1" />Export PDF
          </Button>
        </div>
      } />

      <Card className="p-4 mb-4 space-y-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="active">Active Voters</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by voter #, name, mobile, account…" value={q}
            onChange={e => setQ(e.target.value)} className="pl-9" />
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Voter #</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Account No</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Office</TableHead>
              {tab === "cancelled" && <TableHead>Reason</TableHead>}
              {isSuper && <TableHead className="text-right">Action</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-mono cursor-pointer" onClick={() => nav(`/farmers/${r.id}`)}>{r.voter_number}</TableCell>
                <TableCell className="cursor-pointer" onClick={() => nav(`/farmers/${r.id}`)}>
                  <div className="font-medium">{r.name_en}</div>
                  {r.name_bn && <div className="text-xs text-muted-foreground">{r.name_bn}</div>}
                </TableCell>
                <TableCell className="font-mono text-xs">{r.account_number ?? "—"}</TableCell>
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
                        <Ban className="h-4 w-4 mr-1" />Cancel
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => openDialog(r, "reactivate")}>
                        <RotateCcw className="h-4 w-4 mr-1" />Reactivate
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={isSuper ? (tab === "cancelled" ? 8 : 7) : (tab === "cancelled" ? 7 : 6)} className="text-center text-muted-foreground py-6">
                  {loading ? "Loading…" : "No voters found"}
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
              {mode === "cancel" ? "Cancel Voter Membership" : "Reactivate Voter Membership"}
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
            <div className="text-xs text-muted-foreground border rounded p-3 bg-muted/40">
              Cancellation requires:
              <ul className="list-disc pl-5 mt-1 space-y-0.5">
                <li>Savings balance must be exactly 0</li>
                <li>No outstanding loan due</li>
                <li>No outstanding irrigation due</li>
              </ul>
              The system will reject the action otherwise.
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">
              {mode === "cancel" ? "Cancellation reason" : "Reactivation reason"} <span className="text-destructive">*</span>
            </label>
            <Textarea
              rows={4}
              placeholder="Write a clear reason / remark…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setTarget(null); setMode(null); }} disabled={working}>
              Cancel
            </Button>
            <Button
              variant={mode === "cancel" ? "destructive" : "default"}
              onClick={submitDialog}
              disabled={working || reason.trim().length < 3}
            >
              {working ? "Working…" : mode === "cancel" ? "Confirm Cancel" : "Confirm Reactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
