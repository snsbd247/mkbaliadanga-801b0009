import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Check, X, FileText, Pencil, Trash2, BadgePercent } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageProvider";
import { useAuth } from "@/auth/AuthProvider";
import { usePermission } from "@/hooks/usePermission";
import { money, fmtDate } from "@/lib/format";
import { LumpSumDiscountDialog } from "@/components/loans/LumpSumDiscountDialog";
import { isLumpSum } from "@/lib/lumpSumLoan";

export default function Loans() {
  const { tx, lang } = useLang();
  const { user } = useAuth();
  const navigate = useNavigate();
  const canApprove = usePermission("loans", "can_edit");
  const [rows, setRows] = useState<any[]>([]);
  const [tab, setTab] = useState("pending");

  useEffect(() => { document.title = `${tx("Loans", "ঋণ")} — MK Baliadanga`; load(); }, []);

  async function load() {
    const { data } = await supabase.from("loans").select("*, farmers(name_en,name_bn,farmer_code,member_no), loan_plans(name,name_bn), loan_payments(amount,principal_amount)").is("deleted_at", null).order("created_at", { ascending: false });
    setRows(data ?? []);
  }

  async function remove(id: string) {
    const { error } = await supabase.from("loans").update({ deleted_at: new Date().toISOString() }).eq("id", id);
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
    const { error } = await supabase.from("loans").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    const ln = rows.find((r: any) => r.id === id);
    if (ln?.created_by) {
      await supabase.from("notifications").insert({
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

  return (
    <>
      <PageHeader
        title={tx("Loans", "ঋণ")}
        description={tx("Issue and manage member loans", "সদস্যদের ঋণ ইস্যু ও পরিচালনা")}
        actions={
          <Button size="sm" onClick={() => navigate("/loans/new")}><Plus className="h-4 w-4 mr-1" />{tx("Issue Loan", "ঋণ ইস্যু")}</Button>
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
                      <TableCell><Badge variant={r.status === "approved" ? "default" : r.status === "pending" ? "secondary" : "outline"}>{r.status}</Badge></TableCell>
                      <TableCell className="text-right space-x-1">
                        {r.status === "approved" && (
                          <Button size="sm" variant="ghost" onClick={() => navigate(`/loans/${r.id}/statement`)}><FileText className="h-4 w-4 mr-1" />{tx("Statement", "স্টেটমেন্ট")}</Button>
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
                {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{tx("No loans", "কোনো ঋণ নেই")}</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
