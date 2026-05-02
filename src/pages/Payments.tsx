import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useLang } from "@/i18n/LanguageProvider";
import { money, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { Paperclip, Check, X, FileText } from "lucide-react";

export default function Payments() {
  const { t } = useLang();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [farmers, setFarmers] = useState<any[]>([]);
  const [list, setList] = useState<any[]>([]);
  const [form, setForm] = useState({ farmer_id: params.get("farmer") ?? "", kind: "irrigation", amount: 0, method: "cash", note: "", reference_id: "" });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [openLoans, setOpenLoans] = useState<any[]>([]);
  const [openIrr, setOpenIrr] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => { document.title = `${t("payments")} — ${t("appName")}`; load(); checkRole(); }, []);
  useEffect(() => { if (form.farmer_id) loadDues(); }, [form.farmer_id]);
  useEffect(() => {
    const f = params.get("farmer");
    if (f) setForm((x) => ({ ...x, farmer_id: f }));
  }, [params]);

  async function checkRole() {
    if (!user) return;
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    setIsAdmin((data ?? []).some((r: any) => r.role === "admin" || r.role === "super_admin"));
  }

  async function load() {
    const [f, p] = await Promise.all([
      supabase.from("farmers").select("id,name_en,farmer_code").order("name_en"),
      supabase.from("payments").select("*, farmers(name_en,farmer_code)").order("created_at", { ascending: false }).limit(100),
    ]);
    setFarmers(f.data ?? []); setList(p.data ?? []);
  }
  async function loadDues() {
    const [l, i] = await Promise.all([
      supabase.from("loans").select("id,principal,total_payable,issued_on,loan_payments(amount)").eq("farmer_id", form.farmer_id).eq("status", "approved"),
      supabase.from("irrigation_charges").select("id,total,paid_amount,due_amount,entry_date").eq("farmer_id", form.farmer_id).gt("due_amount", 0),
    ]);
    setOpenLoans(l.data ?? []); setOpenIrr(i.data ?? []);
  }

  async function uploadReceipt(paymentId: string): Promise<string | null> {
    if (!receiptFile) return null;
    const ext = receiptFile.name.split(".").pop();
    const path = `${user?.id}/${paymentId}.${ext}`;
    const { error } = await supabase.storage.from("payment-receipts").upload(path, receiptFile, { upsert: true });
    if (error) { toast.error("Receipt upload failed: " + error.message); return null; }
    const { data } = supabase.storage.from("payment-receipts").createSignedUrl(path, 60 * 60 * 24 * 365);
    return (await data)?.signedUrl ?? path;
  }

  async function pay() {
    if (!form.farmer_id || form.amount <= 0) return toast.error("Pick farmer & amount");
    const status = receiptFile ? "pending" : "approved";
    const payload: any = { farmer_id: form.farmer_id, kind: form.kind as any, amount: form.amount, method: form.method, note: form.note, reference_id: form.reference_id || null, collected_by: user?.id, status };
    const { data: inserted, error } = await supabase.from("payments").insert(payload).select("id").single();
    if (error) return toast.error(error.message);

    if (receiptFile && inserted?.id) {
      const url = await uploadReceipt(inserted.id);
      if (url) await supabase.from("payments").update({ receipt_url: url }).eq("id", inserted.id);
    }

    // Only apply to ledgers if approved (no receipt) — receipt-based payments wait for approval
    if (status === "approved") {
      if (form.kind === "loan" && form.reference_id) {
        await supabase.from("loan_payments").insert({ loan_id: form.reference_id, amount: form.amount, collected_by: user?.id });
      } else if (form.kind === "irrigation" && form.reference_id) {
        const target = openIrr.find(x => x.id === form.reference_id);
        if (target) {
          await supabase.from("irrigation_charges").update({ paid_amount: Number(target.paid_amount) + form.amount }).eq("id", form.reference_id);
        }
      } else if (form.kind === "savings") {
        await supabase.from("savings_transactions").insert({ farmer_id: form.farmer_id, type: "deposit", amount: form.amount, status: "approved", created_by: user?.id });
      }
    }
    toast.success(status === "pending" ? "Submitted for approval" : t("paymentSuccess"));
    setForm({ farmer_id: "", kind: "irrigation", amount: 0, method: "cash", note: "", reference_id: "" });
    setReceiptFile(null);
    load();
  }

  async function approvePayment(p: any) {
    const { error } = await supabase.from("payments").update({ status: "approved", approved_by: user?.id, approved_at: new Date().toISOString() }).eq("id", p.id);
    if (error) return toast.error(error.message);
    // Apply to ledger now
    if (p.kind === "loan" && p.reference_id) {
      await supabase.from("loan_payments").insert({ loan_id: p.reference_id, amount: p.amount, collected_by: user?.id });
    } else if (p.kind === "irrigation" && p.reference_id) {
      const { data: irr } = await supabase.from("irrigation_charges").select("paid_amount").eq("id", p.reference_id).single();
      if (irr) await supabase.from("irrigation_charges").update({ paid_amount: Number(irr.paid_amount) + Number(p.amount) }).eq("id", p.reference_id);
    } else if (p.kind === "savings") {
      await supabase.from("savings_transactions").insert({ farmer_id: p.farmer_id, type: "deposit", amount: p.amount, status: "approved", created_by: user?.id });
    }
    toast.success("Approved");
    load();
  }

  async function rejectPayment(p: any) {
    const { error } = await supabase.from("payments").update({ status: "rejected", approved_by: user?.id, approved_at: new Date().toISOString() }).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Rejected");
    load();
  }

  return (
    <>
      <PageHeader title={t("payments")} description="Unified payment entry — loan / savings / irrigation" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-1">
          <h2 className="font-semibold mb-3">{t("payNow")}</h2>
          <div className="space-y-3">
            <div><Label>{t("selectFarmer")}</Label>
              <Select value={form.farmer_id} onValueChange={v => setForm({ ...form, farmer_id: v, reference_id: "" })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{farmers.map(f => <SelectItem key={f.id} value={f.id}>{f.farmer_code} — {f.name_en}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>{t("type")}</Label>
              <Select value={form.kind} onValueChange={v => setForm({ ...form, kind: v, reference_id: "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="irrigation">{t("irrigation")}</SelectItem>
                  <SelectItem value="loan">{t("loans")}</SelectItem>
                  <SelectItem value="savings">{t("savings")} ({t("deposit")})</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.kind === "loan" && openLoans.length > 0 && (
              <div><Label>Loan</Label>
                <Select value={form.reference_id} onValueChange={v => setForm({ ...form, reference_id: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{openLoans.map(l => {
                    const paid = (l.loan_payments ?? []).reduce((a: number, p: any) => a + Number(p.amount), 0);
                    return <SelectItem key={l.id} value={l.id}>{fmtDate(l.issued_on)} — Due {money(Number(l.total_payable) - paid)}</SelectItem>;
                  })}</SelectContent>
                </Select>
              </div>
            )}
            {form.kind === "irrigation" && openIrr.length > 0 && (
              <div><Label>Irrigation</Label>
                <Select value={form.reference_id} onValueChange={v => setForm({ ...form, reference_id: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{openIrr.map(i => <SelectItem key={i.id} value={i.id}>{fmtDate(i.entry_date)} — Due {money(i.due_amount)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div><Label>{t("amount")}</Label><Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: +e.target.value })} /></div>
            <div><Label>{t("method")}</Label><Input value={form.method} onChange={e => setForm({ ...form, method: e.target.value })} /></div>
            <div><Label>{t("note")}</Label><Input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></div>
            <div>
              <Label className="flex items-center gap-1"><Paperclip className="h-3.5 w-3.5" /> Receipt (optional, requires approval)</Label>
              <Input type="file" accept="image/*,application/pdf" onChange={e => setReceiptFile(e.target.files?.[0] ?? null)} />
              {receiptFile && <p className="text-xs text-muted-foreground mt-1">{receiptFile.name}</p>}
            </div>
            <Button className="w-full" onClick={pay}>{t("payNow")}</Button>
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h2 className="font-semibold mb-3">{t("recentTransactions")}</h2>
          <Table>
            <TableHeader><TableRow><TableHead>{t("date")}</TableHead><TableHead>{t("farmerName")}</TableHead><TableHead>{t("type")}</TableHead><TableHead>{t("amount")}</TableHead><TableHead>Status</TableHead><TableHead>Receipt</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {list.map(p => (
                <TableRow key={p.id}>
                  <TableCell>{fmtDate(p.created_at)}</TableCell>
                  <TableCell>{p.farmers?.name_en} <span className="text-xs text-muted-foreground">({p.farmers?.farmer_code})</span></TableCell>
                  <TableCell><Badge variant="outline">{p.kind}</Badge></TableCell>
                  <TableCell className="font-semibold text-success">{money(p.amount)}</TableCell>
                  <TableCell>
                    <Badge variant={p.status === "approved" ? "default" : p.status === "rejected" ? "destructive" : "secondary"}>
                      {p.status ?? "approved"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {p.receipt_url ? (
                      <a href={p.receipt_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline text-xs">
                        <FileText className="h-3.5 w-3.5" /> View
                      </a>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    {isAdmin && p.status === "pending" && (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => approvePayment(p)} title="Approve"><Check className="h-4 w-4 text-success" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => rejectPayment(p)} title="Reject"><X className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {list.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">{t("noData")}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Card>
      </div>
    </>
  );
}
