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
import { Plus, Check, X, Printer } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { money, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { exportPaymentReceiptPDF } from "@/lib/exports";
import { useBranding } from "@/lib/branding";

export default function Savings() {
  const { t } = useLang();
  const { isCommittee, user } = useAuth();
  const brand = useBranding();
  const [farmers, setFarmers] = useState<any[]>([]);
  const [txns, setTxns] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ farmer_id: "", type: "deposit", amount: 0, note: "" });

  useEffect(() => { document.title = `${t("savings")} — ${t("appName")}`; load(); }, []);
  async function load() {
    const [f, ts, pr] = await Promise.all([
      supabase.from("farmers").select("id,name_en,farmer_code,member_no,mobile,village").order("name_en"),
      supabase.from("savings_transactions").select("*, farmers(name_en,farmer_code,member_no,mobile,village)").order("created_at", { ascending: false }).limit(200),
      supabase.from("profiles").select("id,full_name,username"),
    ]);
    setFarmers(f.data ?? []);
    setTxns(ts.data ?? []);
    const map: Record<string, string> = {};
    (pr.data ?? []).forEach((p: any) => { map[p.id] = p.full_name || p.username || p.id.slice(0, 6); });
    setProfiles(map);
  }
  async function save() {
    if (!form.farmer_id || form.amount <= 0) return toast.error(t("pickFarmerAndAmount"));
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
        title: t("withdrawalRequestTitle"),
        body: t("withdrawalRequestedBody").replace("{name}", farmer?.name_en ?? "").replace("{amount}", String(form.amount)),
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

  function printReceipt(r: any) {
    exportPaymentReceiptPDF({
      brand: { company_name: brand.company_name, address: brand.address, mobile: brand.mobile },
      receipt_no: `SAV-${r.id.slice(0, 8).toUpperCase()}`,
      date: r.txn_date ?? r.created_at,
      farmer: {
        name_en: r.farmers?.name_en ?? "—",
        farmer_code: r.farmers?.farmer_code,
        member_no: r.farmers?.member_no,
        mobile: r.farmers?.mobile,
        village: r.farmers?.village,
      },
      amount: Number(r.amount),
      method: "cash",
      note: r.note ?? `Savings ${r.type} (${r.status})`,
      allocations: [{ kind: `Savings ${r.type}`, amount: Number(r.amount) }],
    });
  }

  const pending = txns.filter(x => x.status === "pending");
  const approved = txns.filter(x => x.status === "approved");
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
              <p className="text-xs text-muted-foreground">{t("withdrawalsRequireApproval")}</p>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button><Button onClick={save}>{t("save")}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      } />

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">{t("all")}</TabsTrigger>
          <TabsTrigger value="pending">{t("pending")} {pending.length > 0 && <Badge variant="destructive" className="ml-2">{pending.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="history">{t("approvalHistory")}</TabsTrigger>
        </TabsList>
        <TabsContent value="all"><TxnTable rows={all} t={t} isAdmin={isCommittee} onDecide={decide} onPrint={printReceipt} profiles={profiles} /></TabsContent>
        <TabsContent value="pending"><TxnTable rows={pending} t={t} isAdmin={isCommittee} onDecide={decide} onPrint={printReceipt} profiles={profiles} /></TabsContent>
        <TabsContent value="history"><TxnTable rows={approved.filter(r => r.approved_by)} t={t} isAdmin={false} onDecide={decide} onPrint={printReceipt} profiles={profiles} historyMode /></TabsContent>
      </Tabs>
    </>
  );
}

function TxnTable({ rows, t, isAdmin, onDecide, onPrint, profiles, historyMode }: any) {
  return (
    <Card><Table>
      <TableHeader><TableRow>
        <TableHead>{t("date")}</TableHead><TableHead>{t("farmerName")}</TableHead>
        <TableHead>{t("type")}</TableHead><TableHead>{t("amount")}</TableHead>
        <TableHead>{t("status")}</TableHead>
        <TableHead>{t("approvedBy")}</TableHead>
        <TableHead className="text-right">{t("actions")}</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {rows.map((r: any) => (
          <TableRow key={r.id}>
            <TableCell>{fmtDate(r.txn_date)}</TableCell>
            <TableCell>{r.farmers?.name_en} <span className="text-xs text-muted-foreground">({r.farmers?.farmer_code})</span></TableCell>
            <TableCell><Badge variant={r.type === "deposit" ? "default" : "secondary"}>{t(r.type as any)}</Badge></TableCell>
            <TableCell className="font-semibold">{money(r.amount)}</TableCell>
            <TableCell><Badge variant={r.status === "approved" ? "default" : r.status === "pending" ? "outline" : "destructive"}>{t(r.status as any)}</Badge></TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {r.approved_by ? (
                <>
                  <div className="font-medium text-foreground">{profiles?.[r.approved_by] ?? r.approved_by.slice(0, 6)}</div>
                  <div>{fmtDate(r.created_at)}</div>
                </>
              ) : "—"}
            </TableCell>
            <TableCell className="text-right">
              {isAdmin && r.status === "pending" && (<>
                <Button size="icon" variant="ghost" onClick={() => onDecide(r.id, "approved")} title={t("approveAction")}><Check className="h-4 w-4 text-success" /></Button>
                <Button size="icon" variant="ghost" onClick={() => onDecide(r.id, "rejected")} title={t("rejectAction")}><X className="h-4 w-4 text-destructive" /></Button>
              </>)}
              {(r.status === "approved" || historyMode) && (
                <Button size="icon" variant="ghost" onClick={() => onPrint(r)} title={t("printReceipt")}><Printer className="h-4 w-4" /></Button>
              )}
            </TableCell>
          </TableRow>
        ))}
        {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">{t("noData")}</TableCell></TableRow>}
      </TableBody>
    </Table></Card>
  );
}
