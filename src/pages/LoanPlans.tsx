import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { useLang } from "@/i18n/LanguageProvider";
import { EditButton, DeleteButton } from "@/components/ui/action-icon-button";
import { toast } from "sonner";

const empty = {
  id: "", name: "", name_bn: "", duration_months: 12,
  installment_type: "monthly" as "daily" | "weekly" | "monthly",
  interest_rate: 0,
  penalty_type: "percentage" as "percentage" | "fixed",
  penalty_value: 0,
  grace_period_days: 0,
  is_active: true,
};

type Row = typeof empty & { created_at?: string };

export default function LoanPlans() {
  const { officeId, isAdmin } = useAuth();
  const { t } = useLang();
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Row>(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => { document.title = t("p5_loanPlansTitle"); load(); }, [t]);

  async function load() {
    const { data, error } = await (supabase.from as any)("loan_plans").select("*").order("created_at", { ascending: false });
    if (error) return toast.error(error.message);
    setRows((data ?? []) as Row[]);
  }

  function openNew() { setForm({ ...empty }); setOpen(true); }
  function openEdit(r: Row) { setForm({ ...empty, ...r }); setOpen(true); }

  async function save() {
    if (!form.name.trim()) return toast.error(t("p5_nameRequired"));
    if (!(form.duration_months > 0)) return toast.error(t("p5_durationGtZero"));
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(), name_bn: form.name_bn || null,
        duration_months: form.duration_months,
        installment_type: form.installment_type,
        interest_rate: Number(form.interest_rate) || 0,
        penalty_type: form.penalty_type,
        penalty_value: Number(form.penalty_value) || 0,
        grace_period_days: Number(form.grace_period_days) || 0,
        is_active: form.is_active,
        office_id: officeId ?? null,
      };
      const { error } = form.id
        ? await (supabase.from as any)("loan_plans").update(payload).eq("id", form.id)
        : await (supabase.from as any)("loan_plans").insert(payload);
      if (error) throw error;
      toast.success(t("saved")); setOpen(false); load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  async function del(id: string) {
    const { error } = await (supabase.from as any)("loan_plans").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  return (
    <>
      <PageHeader title={t("p5_loanPlansTitle")} description={t("p5_loanPlansDesc")} actions={
        isAdmin && (
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty); }}>
            <DialogTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4 mr-1" />{t("p5_addPlan")}</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{form.id ? t("p5_editLoanPlan") : t("p5_addLoanPlan")}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>{t("p5_nameLabel")} *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={t("p5_namePh")} /></div>
                <div className="col-span-2"><Label>{t("p5_nameBangla")}</Label><Input value={form.name_bn} onChange={e => setForm({ ...form, name_bn: e.target.value })} /></div>
                <div><Label>{t("p5_durationMonths")}</Label><Input type="number" min={1} value={form.duration_months} onChange={e => setForm({ ...form, duration_months: +e.target.value })} /></div>
                <div><Label>{t("p5_installmentType")}</Label>
                  <Select value={form.installment_type} onValueChange={(v: any) => setForm({ ...form, installment_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">{t("p5_daily")}</SelectItem>
                      <SelectItem value="weekly">{t("p5_weekly")}</SelectItem>
                      <SelectItem value="monthly">{t("p5_monthly")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>{t("p5_interestRate")}</Label><Input type="number" min={0} step="0.01" value={form.interest_rate} onChange={e => setForm({ ...form, interest_rate: +e.target.value })} /></div>
                <div><Label>{t("p5_gracePeriodDays")}</Label><Input type="number" min={0} value={form.grace_period_days} onChange={e => setForm({ ...form, grace_period_days: +e.target.value })} /></div>
                <div><Label>{t("p5_penaltyType")}</Label>
                  <Select value={form.penalty_type} onValueChange={(v: any) => setForm({ ...form, penalty_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="percentage">{t("p5_penaltyPercent")}</SelectItem><SelectItem value="fixed">{t("p5_penaltyFixed")}</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label>{t("p5_penaltyValue")}</Label><Input type="number" min={0} step="0.01" value={form.penalty_value} onChange={e => setForm({ ...form, penalty_value: +e.target.value })} /></div>
                <div className="flex items-center justify-between rounded-md border p-2 col-span-2">
                  <Label>{t("p5_activeBadge")}</Label>
                  <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>{t("cancel")}</Button>
                <Button onClick={save} disabled={saving}>{saving ? "…" : t("save")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )
      } />
      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t("p5_nameLabel")}</TableHead><TableHead>{t("p5_duration")}</TableHead><TableHead>{t("p5_installmentType")}</TableHead>
            <TableHead>{t("p5_interest")}</TableHead><TableHead>{t("p5_penalty")}</TableHead><TableHead>{t("p5_grace")}</TableHead>
            <TableHead>{t("p5_statusCol")}</TableHead><TableHead className="text-right">{t("p5_actionsCol")}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell><div className="font-medium">{r.name}</div>{r.name_bn && <div className="text-xs text-muted-foreground">{r.name_bn}</div>}</TableCell>
                <TableCell>{r.duration_months} {t("p5_monthsShort")}</TableCell>
                <TableCell><Badge variant="outline">{t(("p5_" + r.installment_type) as any) || r.installment_type}</Badge></TableCell>
                <TableCell>{r.interest_rate}%</TableCell>
                <TableCell>{r.penalty_type === "percentage" ? `${r.penalty_value}%` : `৳${r.penalty_value}`}</TableCell>
                <TableCell>{r.grace_period_days}{t("p5_daysShort")}</TableCell>
                <TableCell><Badge variant={r.is_active ? "default" : "secondary"}>{r.is_active ? t("p5_activeBadge") : t("p5_inactiveBadge")}</Badge></TableCell>
                <TableCell className="text-right">
                  {isAdmin && (<>
                    <EditButton onClick={() => openEdit(r)} />
                    <DeleteButton onConfirm={() => del(r.id)} />
                  </>)}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">{t("p5_noPlansYet")}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
