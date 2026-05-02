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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Check, X } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { money, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";

export default function Savings() {
  const { t } = useLang();
  const { isAdmin, user } = useAuth();
  const [farmers, setFarmers] = useState<any[]>([]);
  const [txns, setTxns] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ farmer_id: "", type: "deposit", amount: 0, note: "" });

  useEffect(() => { document.title = `${t("savings")} — ${t("appName")}`; load(); }, []);
  async function load() {
    const [f, ts] = await Promise.all([
      supabase.from("farmers").select("id,name_en,farmer_code").order("name_en"),
      supabase.from("savings_transactions").select("*, farmers(name_en,farmer_code)").order("created_at", { ascending: false }).limit(200),
    ]);
    setFarmers(f.data ?? []); setTxns(ts.data ?? []);
  }
  async function save() {
    if (!form.farmer_id || form.amount <= 0) return toast.error("Pick farmer & amount");
    const status = form.type === "withdraw" ? "pending" : "approved";
    const farmer = farmers.find((x: any) => x.id === form.farmer_id);
    const { error } = await supabase.from("savings_transactions").insert({
      farmer_id: form.farmer_id, type: form.type as any, amount: form.amount, note: form.note,
      status: status as any, created_by: user?.id,
    });
    if (error) return toast.error(error.message);
    if (form.type === "deposit") {
      await supabase.from("payments").insert({ farmer_id: form.farmer_id, kind: "savings", amount: form.amount, collected_by: user?.id });
    }
    if (status === "pending") {
      await supabase.from("notifications").insert({
        kind: "withdrawal_pending",
        title: "Withdrawal request",
        body: `${farmer?.name_en ?? ""} requested ${form.amount}`,
        link: "/savings",
      });
    }
    toast.success(t("saved")); setOpen(false); setForm({ farmer_id: "", type: "deposit", amount: 0, note: "" }); load();
  }
  async function decide(id: string, status: "approved" | "rejected") {
    const { error } = await supabase.from("savings_transactions").update({ status, approved_by: user?.id }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("saved")); load();
  }

  const pending = txns.filter(x => x.status === "pending");
  const all = txns;

  return (
    <>
      <PageHeader title={t("savings")} actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />{t("addEntry")}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("savings")} — {t("addEntry")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>{t("selectFarmer")}</Label>
                <Select value={form.farmer_id} onValueChange={v => setForm({ ...form, farmer_id: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{farmers.map(f => <SelectItem key={f.id} value={f.id}>{f.farmer_code} — {f.name_en}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>{t("type")}</Label>
                <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="deposit">{t("deposit")}</SelectItem><SelectItem value="withdraw">{t("withdraw")}</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>{t("amount")}</Label><Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: +e.target.value })} /></div>
              <div><Label>{t("note")}</Label><Input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button><Button onClick={save}>{t("save")}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      } />

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">{t("all")}</TabsTrigger>
          <TabsTrigger value="pending">{t("pending")} {pending.length > 0 && <Badge variant="destructive" className="ml-2">{pending.length}</Badge>}</TabsTrigger>
        </TabsList>
        <TabsContent value="all"><TxnTable rows={all} t={t} isAdmin={isAdmin} onDecide={decide} /></TabsContent>
        <TabsContent value="pending"><TxnTable rows={pending} t={t} isAdmin={isAdmin} onDecide={decide} /></TabsContent>
      </Tabs>
    </>
  );
}

function TxnTable({ rows, t, isAdmin, onDecide }: any) {
  return (
    <Card><Table>
      <TableHeader><TableRow>
        <TableHead>{t("date")}</TableHead><TableHead>{t("farmerName")}</TableHead>
        <TableHead>{t("type")}</TableHead><TableHead>{t("amount")}</TableHead>
        <TableHead>{t("status")}</TableHead><TableHead className="text-right">{t("actions")}</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {rows.map((r: any) => (
          <TableRow key={r.id}>
            <TableCell>{fmtDate(r.txn_date)}</TableCell>
            <TableCell>{r.farmers?.name_en} <span className="text-xs text-muted-foreground">({r.farmers?.farmer_code})</span></TableCell>
            <TableCell><Badge variant={r.type === "deposit" ? "default" : "secondary"}>{t(r.type as any)}</Badge></TableCell>
            <TableCell className="font-semibold">{money(r.amount)}</TableCell>
            <TableCell><Badge variant={r.status === "approved" ? "default" : r.status === "pending" ? "outline" : "destructive"}>{t(r.status as any)}</Badge></TableCell>
            <TableCell className="text-right">
              {isAdmin && r.status === "pending" && (<>
                <Button size="icon" variant="ghost" onClick={() => onDecide(r.id, "approved")}><Check className="h-4 w-4 text-success" /></Button>
                <Button size="icon" variant="ghost" onClick={() => onDecide(r.id, "rejected")}><X className="h-4 w-4 text-destructive" /></Button>
              </>)}
            </TableCell>
          </TableRow>
        ))}
        {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">{t("noData")}</TableCell></TableRow>}
      </TableBody>
    </Table></Card>
  );
}
