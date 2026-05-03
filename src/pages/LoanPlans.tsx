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
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Row>(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => { document.title = "Loan Plans"; load(); }, []);

  async function load() {
    const { data, error } = await (supabase.from as any)("loan_plans").select("*").order("created_at", { ascending: false });
    if (error) return toast.error(error.message);
    setRows((data ?? []) as Row[]);
  }

  function openNew() { setForm({ ...empty }); setOpen(true); }
  function openEdit(r: Row) { setForm({ ...empty, ...r }); setOpen(true); }

  async function save() {
    if (!form.name.trim()) return toast.error("Name required");
    if (!(form.duration_months > 0)) return toast.error("Duration must be > 0");
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
      toast.success("Saved"); setOpen(false); load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  async function del(id: string) {
    if (!confirm("Delete this plan?")) return;
    const { error } = await (supabase.from as any)("loan_plans").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  return (
    <>
      <PageHeader title="Loan Plans" description="Define loan schedules with installments and penalties" actions={
        isAdmin && (
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty); }}>
            <DialogTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4 mr-1" />Add Plan</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{form.id ? "Edit" : "Add"} Loan Plan</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. 12-month monthly" /></div>
                <div className="col-span-2"><Label>Name (Bangla)</Label><Input value={form.name_bn} onChange={e => setForm({ ...form, name_bn: e.target.value })} /></div>
                <div><Label>Duration (months)</Label><Input type="number" min={1} value={form.duration_months} onChange={e => setForm({ ...form, duration_months: +e.target.value })} /></div>
                <div><Label>Installment Type</Label>
                  <Select value={form.installment_type} onValueChange={(v: any) => setForm({ ...form, installment_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Interest Rate (%)</Label><Input type="number" min={0} step="0.01" value={form.interest_rate} onChange={e => setForm({ ...form, interest_rate: +e.target.value })} /></div>
                <div><Label>Grace Period (days)</Label><Input type="number" min={0} value={form.grace_period_days} onChange={e => setForm({ ...form, grace_period_days: +e.target.value })} /></div>
                <div><Label>Penalty Type</Label>
                  <Select value={form.penalty_type} onValueChange={(v: any) => setForm({ ...form, penalty_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="percentage">% of installment</SelectItem><SelectItem value="fixed">Fixed amount</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label>Penalty Value</Label><Input type="number" min={0} step="0.01" value={form.penalty_value} onChange={e => setForm({ ...form, penalty_value: +e.target.value })} /></div>
                <div className="flex items-center justify-between rounded-md border p-2 col-span-2">
                  <Label>Active</Label>
                  <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
                <Button onClick={save} disabled={saving}>{saving ? "…" : "Save"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )
      } />
      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Name</TableHead><TableHead>Duration</TableHead><TableHead>Installment</TableHead>
            <TableHead>Interest</TableHead><TableHead>Penalty</TableHead><TableHead>Grace</TableHead>
            <TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell><div className="font-medium">{r.name}</div>{r.name_bn && <div className="text-xs text-muted-foreground">{r.name_bn}</div>}</TableCell>
                <TableCell>{r.duration_months} mo</TableCell>
                <TableCell><Badge variant="outline">{r.installment_type}</Badge></TableCell>
                <TableCell>{r.interest_rate}%</TableCell>
                <TableCell>{r.penalty_type === "percentage" ? `${r.penalty_value}%` : `৳${r.penalty_value}`}</TableCell>
                <TableCell>{r.grace_period_days}d</TableCell>
                <TableCell><Badge variant={r.is_active ? "default" : "secondary"}>{r.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                <TableCell className="text-right">
                  {isAdmin && (<>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </>)}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">No plans yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
