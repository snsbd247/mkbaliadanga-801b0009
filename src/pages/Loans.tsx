import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Check, X, FileText, Pencil, Trash2, BadgePercent, FileDown, Sheet } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageProvider";
import { useAuth } from "@/auth/AuthProvider";
import { usePermission } from "@/hooks/usePermission";
import { money, fmtDate } from "@/lib/format";
import { LumpSumDiscountDialog } from "@/components/loans/LumpSumDiscountDialog";
import { isLumpSum } from "@/lib/lumpSumLoan";
import { exportTablePDF, exportExcel } from "@/lib/exports";

export default function Loans() {
  const { tx, lang } = useLang();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const canApprove = usePermission("loans", "can_edit");
  const [rows, setRows] = useState<any[]>([]);
  const [tab, setTab] = useState("pending");
  const [discountLoan, setDiscountLoan] = useState<any | null>(null);

  useEffect(() => { document.title = `${tx("Loans", "ঋণ")} — MK Baliadanga`; load(); }, []);

  async function load() {
    const { data } = await db.from("loans").select("*, farmers(name_en,name_bn,farmer_code,member_no), loan_plans(name,name_bn,installment_type), loan_payments(amount,principal_amount), loan_guarantors(name,role)").is("deleted_at", null).order("created_at", { ascending: false });
    setRows(data ?? []);
  }

  async function remove(id: string) {
    const { error } = await db.from("loans").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(tx("Loan deleted", "ঋণ মুছে ফেলা হয়েছে"));
    load();
  }

  function confirmRemove(id: string) {
    const r = rows.find((x: any) => x.id === id);
    const nm = lang === "bn" ? (r?.farmers?.name_bn || r?.farmers?.name_en) : r?.farmers?.name_en;
    const amt = `৳${Number(r?.principal ?? 0).toLocaleString()}`;
    toast(`${tx("Delete loan", "ঋণ মুছবেন")}: ${nm ?? ""} — ${amt}?`, {
      description: tx("This action cannot be undone.", "এই কাজটি ফেরানো যাবে না।"),
      duration: 10000,
      action: { label: tx("Delete", "মুছুন"), onClick: () => remove(id) },
      cancel: { label: tx("Cancel", "বাতিল"), onClick: () => {} },
    });
  }

  async function decide(id: string, status: "approved" | "rejected") {
    const patch: any = { status };
    if (status === "approved") { patch.approved_by = user?.id ?? null; }
    const { error } = await db.from("loans").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    const ln = rows.find((r: any) => r.id === id);
    if (ln?.created_by) {
      await db.from("notifications").insert({
        user_id: ln.created_by,
        kind: status === "approved" ? "loan_approved" : "loan_rejected",
        title: status === "approved" ? tx("Loan approved", "ঋণ অনুমোদিত") : tx("Loan rejected", "ঋণ বাতিল"),
        body: `${ln?.farmers?.name_en ?? ln?.farmer_name ?? ""} — ৳${Number(ln?.principal ?? 0).toLocaleString()}`,
        link: "/loans",
      });
    }
    toast.success(status === "approved" ? tx("Approved", "অনুমোদিত") : tx("Rejected", "বাতিল"));
    load();
  }


  const filtered = rows.filter(r => tab === "all" ? true : tab === "pending" ? r.status === "pending" : r.status === "approved");

  function paidPrincipal(r: any) {
    return (r.loan_payments ?? []).reduce((s: number, p: any) => s + (Number(p.principal_amount ?? 0) > 0 ? Number(p.principal_amount) : Number(p.amount ?? 0)), 0);
  }

  const partyNames = (r: any, role: "guarantor" | "nominee") =>
    (r.loan_guarantors ?? [])
      .filter((x: any) => (role === "guarantor" ? (x.role ?? "guarantor") === "guarantor" : x.role === "nominee"))
      .map((x: any) => x.name).filter(Boolean).join(", ");

  function buildExportRows() {
    return filtered.map(r => {
      const due = Math.max(0, Number(r.principal ?? 0) - paidPrincipal(r));
      const nm = lang === "bn" ? (r.farmers?.name_bn || r.farmers?.name_en) : r.farmers?.name_en;
      return {
        member: nm ?? "",
        memberNo: r.farmers?.member_no || r.farmers?.farmer_code || "",
        issued: fmtDate(r.issued_on),
        principal: Number(r.principal ?? 0),
        principalDue: due,
        status: r.status,
        guarantors: partyNames(r, "guarantor"),
        nominees: partyNames(r, "nominee"),
      };
    });
  }

  const tabLabel = tab === "pending" ? tx("Pending", "অপেক্ষমাণ") : tab === "approved" ? tx("Approved", "অনুমোদিত") : tx("All", "সব");
  const reportTitle = `${tx("Loans", "ঋণ")} — ${tabLabel}`;

  async function exportPdf() {
    const head = [tx("Member", "সদস্য"), tx("Member No", "সদস্য নং"), tx("Issued", "ইস্যু"), tx("Principal", "আসল"), tx("Principal Due", "আসল বাকি"), tx("Status", "অবস্থা"), tx("Guarantors", "গ্যারান্টার"), tx("Nominees", "নমিনি")];
    const body = buildExportRows().map(r => [r.member, r.memberNo, r.issued, money(r.principal), money(r.principalDue), r.status, r.guarantors, r.nominees]);
    await exportTablePDF(reportTitle, head, body, undefined, { landscape: true });
  }

  function exportXlsx() {
    const rows = buildExportRows().map(r => ({
      [tx("Member", "সদস্য")]: r.member,
      [tx("Member No", "সদস্য নং")]: r.memberNo,
      [tx("Issued", "ইস্যু")]: r.issued,
      [tx("Principal", "আসল")]: r.principal,
      [tx("Principal Due", "আসল বাকি")]: r.principalDue,
      [tx("Status", "অবস্থা")]: r.status,
      [tx("Guarantors", "গ্যারান্টার")]: r.guarantors,
      [tx("Nominees", "নমিনি")]: r.nominees,
    }));
    exportExcel(reportTitle, tx("Loans", "ঋণ"), rows);
  }

  return (
    <>
      <PageHeader
        title={tx("Loans", "ঋণ")}
        description={tx("Issue and manage member loans", "সদস্যদের ঋণ ইস্যু ও পরিচালনা")}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={exportPdf} disabled={filtered.length === 0}><FileDown className="h-4 w-4 mr-1" />PDF</Button>
            <Button size="sm" variant="outline" onClick={exportXlsx} disabled={filtered.length === 0}><Sheet className="h-4 w-4 mr-1" />Excel</Button>
            <Button size="sm" onClick={() => navigate("/loans/new")}><Plus className="h-4 w-4 mr-1" />{tx("Issue Loan", "ঋণ ইস্যু")}</Button>
          </div>
        }
      />


      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending">{tx("Pending", "অপেক্ষমাণ")}</TabsTrigger>
          <TabsTrigger value="approved">{tx("Approved", "অনুমোদিত")}</TabsTrigger>
          <TabsTrigger value="all">{tx("All", "সব")}</TabsTrigger>
        </TabsList>
        <TabsContent value={tab}>
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>{tx("Member", "সদস্য")}</TableHead>
                <TableHead>{tx("Issued", "ইস্যু")}</TableHead>
                <TableHead className="text-right">{tx("Principal", "আসল")}</TableHead>
                <TableHead className="text-right">{tx("Principal Due", "আসল বাকি")}</TableHead>
                <TableHead>{tx("Guarantor / Nominee", "গ্যারান্টার / নমিনি")}</TableHead>
                <TableHead>{tx("Status", "অবস্থা")}</TableHead>
                <TableHead className="text-right">{tx("Actions", "কার্যক্রম")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.map(r => {
                  const due = Math.max(0, Number(r.principal ?? 0) - paidPrincipal(r));
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Link to={`/farmers/${r.farmer_id}`} className="text-primary hover:underline">
                          {lang === "bn" ? (r.farmers?.name_bn || r.farmers?.name_en) : r.farmers?.name_en}
                        </Link>
                        <div className="text-xs text-muted-foreground">{r.farmers?.member_no || r.farmers?.farmer_code}</div>
                      </TableCell>
                      <TableCell>{fmtDate(r.issued_on)}</TableCell>
                      <TableCell className="text-right font-mono">{money(r.principal)}</TableCell>
                      <TableCell className="text-right font-mono">{money(due)}</TableCell>
                      <TableCell className="text-xs">
                        {(() => {
                          const g = (r.loan_guarantors ?? []).filter((x: any) => (x.role ?? "guarantor") === "guarantor").map((x: any) => x.name).filter(Boolean);
                          const n = (r.loan_guarantors ?? []).filter((x: any) => x.role === "nominee").map((x: any) => x.name).filter(Boolean);
                          if (!g.length && !n.length) return <span className="text-muted-foreground">—</span>;
                          return (
                            <div className="space-y-0.5">
                              {g.length > 0 && <div><span className="text-muted-foreground">{tx("G", "গ্যা")}:</span> {g.join(", ")}</div>}
                              {n.length > 0 && <div><span className="text-muted-foreground">{tx("N", "নমি")}:</span> {n.join(", ")}</div>}
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell><Badge variant={r.status === "approved" ? "default" : r.status === "pending" ? "secondary" : "outline"}>{r.status}</Badge></TableCell>
                      <TableCell className="text-right space-x-1">
                        {r.status === "approved" && (
                          <Button size="sm" variant="ghost" onClick={() => navigate(`/loans/${r.id}/statement`)}><FileText className="h-4 w-4 mr-1" />{tx("Statement", "স্টেটমেন্ট")}</Button>
                        )}
                        {r.status === "approved" && isLumpSum(r.loan_plans?.installment_type) && (
                          <Button size="sm" variant="ghost" onClick={() => setDiscountLoan(r)}><BadgePercent className="h-4 w-4 mr-1" />{isAdmin ? tx("Repay/Discount", "পরিশোধ/ছাড়") : tx("Receipts", "রশিদ")}</Button>
                        )}
                        {r.status === "pending" && canApprove && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => decide(r.id, "approved")}><Check className="h-4 w-4" /></Button>
                            <Button size="sm" variant="ghost" onClick={() => decide(r.id, "rejected")}><X className="h-4 w-4" /></Button>
                          </>
                        )}
                        {canApprove && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => navigate(`/loans/${r.id}/edit`)}><Pencil className="h-4 w-4" /></Button>
                            <Button size="sm" variant="ghost" onClick={() => confirmRemove(r.id)}><Trash2 className="h-4 w-4" /></Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{tx("No loans", "কোনো ঋণ নেই")}</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
      {discountLoan && (
        <LumpSumDiscountDialog
          loan={discountLoan}
          open={!!discountLoan}
          onOpenChange={(v) => { if (!v) setDiscountLoan(null); }}
          onDone={load}
        />
      )}
    </>
  );
}
