import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Check, X } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { money, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";

const DEFAULT_INTEREST = 8.0;

export default function Loans() {
  const { t } = useLang();
  const { isAdmin, user } = useAuth();
  const [farmers, setFarmers] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ farmer_id: "", principal: 0, interest_enabled: true, interest_rate: DEFAULT_INTEREST, issued_on: new Date().toISOString().slice(0, 10), next_due_on: "", note: "" });

  useEffect(() => { document.title = `${t("loans")} — ${t("appName")}`; load(); }, []);
  async function load() {
    const [f, l] = await Promise.all([
      supabase.from("farmers").select("id,name_en,farmer_code").order("name_en"),
      supabase.from("loans").select("*, farmers(name_en,farmer_code), loan_payments(amount)").order("created_at", { ascending: false }).limit(200),
    ]);
    setFarmers(f.data ?? []); setLoans(l.data ?? []);
  }
  async function save() {
    if (!form.farmer_id || form.principal <= 0) return toast.error("Pick farmer & amount");
    const farmer = farmers.find((x: any) => x.id === form.farmer_id);
    // total_payable is recomputed by the database trigger calc_loan_total
    const { error } = await supabase.from("loans").insert({
      farmer_id: form.farmer_id, principal: form.principal, interest_enabled: form.interest_enabled,
      interest_rate: form.interest_enabled ? form.interest_rate : 0,
      issued_on: form.issued_on, next_due_on: form.next_due_on || null, note: form.note,
      status: "pending", created_by: user?.id,
    });
    if (error) return toast.error(error.message);
    await supabase.from("notifications").insert({
      kind: "loan_pending",
      title: "Loan approval needed",
      body: `${farmer?.name_en ?? ""} requested ${form.principal}`,
      link: "/loans",
    });
    toast.success(t("saved")); setOpen(false); load();
  }
  async function decide(id: string, status: "approved" | "rejected") {
    const { error } = await supabase.from("loans").update({ status, approved_by: user?.id }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("saved")); load();
  }

  return (
    <>
      <PageHeader title={t("loans")} actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />{t("issueLoan")}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("issueLoan")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>{t("selectFarmer")}</Label>
                <Select value={form.farmer_id} onValueChange={v => setForm({ ...form, farmer_id: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{farmers.map(f => <SelectItem key={f.id} value={f.id}>{f.farmer_code} — {f.name_en}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t("principal")}</Label><Input type="number" value={form.principal} onChange={e => setForm({ ...form, principal: +e.target.value })} /></div>
                <div><Label>{t("interestRate")}</Label><Input type="number" step="0.1" value={form.interest_rate} disabled={!form.interest_enabled} onChange={e => setForm({ ...form, interest_rate: +e.target.value })} /></div>
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <Label>{t("interestEnabled")}</Label>
                <Switch checked={form.interest_enabled} onCheckedChange={v => setForm({ ...form, interest_enabled: v })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t("issuedOn")}</Label><Input type="date" value={form.issued_on} onChange={e => setForm({ ...form, issued_on: e.target.value })} /></div>
                <div><Label>{t("nextDue")}</Label><Input type="date" value={form.next_due_on} onChange={e => setForm({ ...form, next_due_on: e.target.value })} /></div>
              </div>
              <div className="rounded-md bg-muted p-2 text-sm">{t("totalPayable")}: <span className="font-bold">{money(form.interest_enabled ? form.principal * (1 + form.interest_rate / 100) : form.principal)}</span></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button><Button onClick={save}>{t("save")}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      } />
      <Card><Table>
        <TableHeader><TableRow>
          <TableHead>{t("issuedOn")}</TableHead><TableHead>{t("farmerName")}</TableHead>
          <TableHead>{t("principal")}</TableHead><TableHead>{t("interestRate")}</TableHead>
          <TableHead>{t("totalPayable")}</TableHead><TableHead>{t("dueAmount")}</TableHead>
          <TableHead>{t("status")}</TableHead><TableHead className="text-right">{t("actions")}</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {loans.map(l => {
            const paid = (l.loan_payments ?? []).reduce((a: number, p: any) => a + Number(p.amount), 0);
            const due = Number(l.total_payable) - paid;
            return (
              <TableRow key={l.id}>
                <TableCell>{fmtDate(l.issued_on)}</TableCell>
                <TableCell>{l.farmers?.name_en} <span className="text-xs text-muted-foreground">({l.farmers?.farmer_code})</span></TableCell>
                <TableCell>{money(l.principal)}</TableCell>
                <TableCell>{l.interest_enabled ? `${l.interest_rate}%` : "-"}</TableCell>
                <TableCell>{money(l.total_payable)}</TableCell>
                <TableCell className={due > 0 && l.status === "approved" ? "due-text" : ""}>{money(due)}</TableCell>
                <TableCell><Badge variant={l.status === "approved" ? "default" : l.status === "paid" ? "secondary" : l.status === "pending" ? "outline" : "destructive"}>{t(l.status as any)}</Badge></TableCell>
                <TableCell className="text-right">
                  {isAdmin && l.status === "pending" && (<>
                    <Button size="icon" variant="ghost" onClick={() => decide(l.id, "approved")}><Check className="h-4 w-4 text-success" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => decide(l.id, "rejected")}><X className="h-4 w-4 text-destructive" /></Button>
                  </>)}
                </TableCell>
              </TableRow>
            );
          })}
          {loans.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">{t("noData")}</TableCell></TableRow>}
        </TableBody>
      </Table></Card>
    </>
  );
}
