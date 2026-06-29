import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { useLang } from "@/i18n/LanguageProvider";

const sb = db as any;

type PlanForm = {
  id?: string; name: string; name_bn: string; duration_months: number;
  interest_rate: number; installment_type: string; is_active: boolean;
};

const EMPTY: PlanForm = {
  name: "", name_bn: "", duration_months: 6, interest_rate: 9,
  installment_type: "monthly", is_active: true,
};

export default function LoanPlans() {
  const { tx } = useLang();
  const { user, officeId } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<PlanForm>({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  useEffect(() => { document.title = `${tx("Loan Plans", "ঋণ প্ল্যান")} — MK Baliadanga`; load(); }, []);

  async function load() {
    const { data, error } = await sb.from("loan_plans").select("*").order("created_at", { ascending: false });
    if (error) { toast.error(error.message); return; }
    setRows(data ?? []);
  }

  function openNew() { setForm({ ...EMPTY }); setOpen(true); }
  function openEdit(r: any) {
    setForm({
      id: r.id, name: r.name ?? "", name_bn: r.name_bn ?? "",
      duration_months: Number(r.duration_months ?? 0), interest_rate: Number(r.interest_rate ?? 0),
      installment_type: r.installment_type ?? "monthly", is_active: !!r.is_active,
    });
    setOpen(true);
  }

  async function save() {
    if (!form.name.trim()) return toast.error(tx("Name required", "নাম প্রয়োজন"));
    if (!(form.duration_months > 0)) return toast.error(tx("Duration must be > 0", "মেয়াদ ০ এর বেশি হতে হবে"));
    setSaving(true);
    try {
      const payload: any = {
        name: form.name.trim(), name_bn: form.name_bn.trim() || null,
        duration_months: Number(form.duration_months), interest_rate: Number(form.interest_rate),
        installment_type: form.installment_type, is_active: form.is_active,
      };
      if (form.id) {
        const { error } = await sb.from("loan_plans").update(payload).eq("id", form.id);
        if (error) throw error;
        // Recalculate interest + due amounts for active lump-sum loans on term/rate edit.
        if (form.installment_type === "lump_sum") {
          const { data: rc, error: rcErr } = await sb.functions.invoke("recalc-lumpsum-loans", { body: { plan_id: form.id } });
          if (rcErr) toast.warning(tx("Plan saved, but loan recalculation failed", "প্ল্যান সংরক্ষিত, তবে ঋণ পুনঃহিসাব ব্যর্থ"));
          else if (rc?.updated > 0) toast.success(tx(`Recalculated ${rc.updated} loan(s)`, `${rc.updated} টি ঋণ পুনঃহিসাব হয়েছে`));
        }
      } else {
        payload.office_id = officeId ?? null;
        payload.created_by = user?.id ?? null;
        const { error } = await sb.from("loan_plans").insert(payload);
        if (error) throw error;
      }
      toast.success(tx("Saved", "সংরক্ষিত হয়েছে"));
      setOpen(false); load();
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally { setSaving(false); }
  }

  return (
    <>
      <PageHeader
        title={tx("Loan Plans", "ঋণ প্ল্যান")}
        description={tx("Manage loan plans (duration & interest rate)", "ঋণ প্ল্যান পরিচালনা (মেয়াদ ও সুদের হার)")}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />{tx("Add Plan", "প্ল্যান যোগ")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{form.id ? tx("Edit Plan", "প্ল্যান সম্পাদনা") : tx("Add Plan", "প্ল্যান যোগ")}</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div><Label>{tx("Name", "নাম")}</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>{tx("Name (Bangla)", "নাম (বাংলা)")}</Label><Input value={form.name_bn} onChange={e => setForm({ ...form, name_bn: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>{tx("Duration (months)", "মেয়াদ (মাস)")}</Label><Input type="number" min={1} value={form.duration_months} onChange={e => setForm({ ...form, duration_months: +e.target.value })} /></div>
                  <div><Label>{tx("Interest Rate (%)", "সুদের হার (%)")}</Label><Input type="number" min={0} step="0.01" value={form.interest_rate} onChange={e => setForm({ ...form, interest_rate: +e.target.value })} /></div>
                </div>
                <div><Label>{tx("Installment Type", "কিস্তির ধরন")}</Label>
                  <Select value={form.installment_type} onValueChange={v => setForm({ ...form, installment_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">{tx("Daily", "দৈনিক")}</SelectItem>
                      <SelectItem value="weekly">{tx("Weekly", "সাপ্তাহিক")}</SelectItem>
                      <SelectItem value="monthly">{tx("Monthly", "মাসিক")}</SelectItem>
                      <SelectItem value="lump_sum">{tx("Lump sum (end of term)", "একবারে পরিশোধ (মেয়াদ শেষে)")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <Label>{tx("Active", "সক্রিয়")}</Label>
                  <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>{tx("Cancel", "বাতিল")}</Button>
                <Button onClick={save} disabled={saving}>{saving ? "…" : tx("Save", "সংরক্ষণ")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <Card className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{tx("Name", "নাম")}</TableHead>
            <TableHead className="text-right">{tx("Duration (months)", "মেয়াদ (মাস)")}</TableHead>
            <TableHead className="text-right">{tx("Interest Rate (%)", "সুদের হার (%)")}</TableHead>
            <TableHead>{tx("Installment", "কিস্তি")}</TableHead>
            <TableHead>{tx("Active", "সক্রিয়")}</TableHead>
            <TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{tx("No plans yet", "কোনো প্ল্যান নেই")}</TableCell></TableRow>}
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell>{r.name_bn || r.name}</TableCell>
                <TableCell className="text-right">{r.duration_months}</TableCell>
                <TableCell className="text-right">{Number(r.interest_rate).toFixed(2)}</TableCell>
                <TableCell>{r.installment_type === "daily" ? tx("Daily", "দৈনিক") : r.installment_type === "weekly" ? tx("Weekly", "সাপ্তাহিক") : r.installment_type === "lump_sum" ? tx("Lump sum (end of term)", "একবারে পরিশোধ (মেয়াদ শেষে)") : tx("Monthly", "মাসিক")}</TableCell>
                <TableCell>{r.is_active ? tx("Yes", "হ্যাঁ") : tx("No", "না")}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
