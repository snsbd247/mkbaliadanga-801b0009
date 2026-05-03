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
import { money } from "@/lib/format";

const empty = {
  id: "", name: "", name_bn: "", duration_months: 12,
  installment_type: "monthly" as "monthly" | "daily",
  installment_amount: 0, interest_rate: 0,
  maturity_type: "simple" as "simple" | "compound",
  is_active: true,
};

type Row = typeof empty & { created_at?: string };

function calcMaturity(p: typeof empty) {
  const months = Number(p.duration_months) || 0;
  const periods = p.installment_type === "daily" ? months * 30 : months;
  const total = periods * Number(p.installment_amount || 0);
  const years = months / 12;
  let interest = 0;
  if (p.maturity_type === "compound") {
    const fv = total * Math.pow(1 + Number(p.interest_rate || 0) / 100, years);
    interest = fv - total;
  } else {
    interest = total * (Number(p.interest_rate || 0) / 100) * years;
  }
  return { total, interest, maturity: total + interest };
}

export default function SavingsPlans() {
  const { officeId, isAdmin } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Row>(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => { document.title = "Savings Plans"; load(); }, []);

  async function load() {
    const { data, error } = await (supabase.from as any)("savings_plans").select("*").order("created_at", { ascending: false });
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
        installment_amount: Number(form.installment_amount) || 0,
        interest_rate: Number(form.interest_rate) || 0,
        maturity_type: form.maturity_type,
        is_active: form.is_active,
        office_id: officeId ?? null,
      };
      const { error } = form.id
        ? await (supabase.from as any)("savings_plans").update(payload).eq("id", form.id)
        : await (supabase.from as any)("savings_plans").insert(payload);
      if (error) throw error;
      toast.success("Saved");
      setOpen(false); load();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  async function del(id: string) {
    if (!confirm("Delete this plan?")) return;
    const { error } = await (supabase.from as any)("savings_plans").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  const preview = calcMaturity(form);

  return (
    <>
      <PageHeader title="Savings Plans" description="Define recurring savings plans for farmers" actions={
        isAdmin && (
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty); }}>
            <DialogTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4 mr-1" />Add Plan</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{form.id ? "Edit" : "Add"} Savings Plan</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. 1 Year Plan" /></div>
                <div className="col-span-2"><Label>Name (Bangla)</Label><Input value={form.name_bn} onChange={e => setForm({ ...form, name_bn: e.target.value })} /></div>
                <div><Label>Duration (months)</Label><Input type="number" min={1} value={form.duration_months} onChange={e => setForm({ ...form, duration_months: +e.target.value })} /></div>
                <div><Label>Installment Type</Label>
                  <Select value={form.installment_type} onValueChange={(v: any) => setForm({ ...form, installment_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="daily">Daily</SelectItem><SelectItem value="monthly">Monthly</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label>Installment Amount</Label><Input type="number" min={0} step="0.01" value={form.installment_amount} onChange={e => setForm({ ...form, installment_amount: +e.target.value })} /></div>
                <div><Label>Interest Rate (% / yr)</Label><Input type="number" min={0} step="0.01" value={form.interest_rate} onChange={e => setForm({ ...form, interest_rate: +e.target.value })} /></div>
                <div><Label>Maturity Type</Label>
                  <Select value={form.maturity_type} onValueChange={(v: any) => setForm({ ...form, maturity_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="simple">Simple</SelectItem><SelectItem value="compound">Compound</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between rounded-md border p-2 col-span-2">
                  <Label>Active</Label>
                  <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
                </div>
                <div className="col-span-2 rounded-md bg-muted p-3 text-sm space-y-1">
                  <div>Expected total deposits: <span className="font-semibold">{money(preview.total)}</span></div>
                  <div>Expected interest: <span className="font-semibold">{money(preview.interest)}</span></div>
                  <div>Maturity amount: <span className="font-bold text-primary">{money(preview.maturity)}</span></div>
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
            <TableHead>Name</TableHead><TableHead>Duration</TableHead><TableHead>Type</TableHead>
            <TableHead className="text-right">Installment</TableHead><TableHead>Interest</TableHead>
            <TableHead>Maturity</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map(r => {
              const c = calcMaturity(r);
              return (
                <TableRow key={r.id}>
                  <TableCell><div className="font-medium">{r.name}</div>{r.name_bn && <div className="text-xs text-muted-foreground">{r.name_bn}</div>}</TableCell>
                  <TableCell>{r.duration_months} mo</TableCell>
                  <TableCell><Badge variant="outline">{r.installment_type}</Badge></TableCell>
                  <TableCell className="text-right font-mono">{money(Number(r.installment_amount))}</TableCell>
                  <TableCell>{r.interest_rate}% ({r.maturity_type})</TableCell>
                  <TableCell className="font-mono text-primary">{money(c.maturity)}</TableCell>
                  <TableCell><Badge variant={r.is_active ? "default" : "secondary"}>{r.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                  <TableCell className="text-right">
                    {isAdmin && (<>
                      <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </>)}
                  </TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">No plans yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
