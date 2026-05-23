import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, CheckCircle2, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { useLang } from "@/i18n/LanguageProvider";

type Sched = {
  id: string; office_id: string | null; asset_id: string;
  title: string; frequency_days: number; next_due_at: string;
  vendor: string | null; notes: string | null; active: boolean;
  last_generated_alert_at: string | null;
  assets?: { asset_code: string; name_en: string; name_bn: string | null } | null;
};

type AssetLite = { id: string; asset_code: string; name_en: string; name_bn: string | null };

const emptyForm = {
  asset_id: "", title: "", frequency_days: 90,
  next_due_at: new Date().toISOString().slice(0, 10),
  vendor: "", notes: "", active: true,
};

export default function MaintenanceSchedules() {
  const { tx } = useLang();
  const { isAdmin, officeId } = useAuth();
  const [rows, setRows] = useState<Sched[]>([]);
  const [assets, setAssets] = useState<AssetLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "due">("active");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = tx("Maintenance Schedules", "মেরামত সময়সূচি");
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  async function load() {
    setLoading(true);
    const [s, a] = await Promise.all([
      supabase.from("asset_maintenance_schedules" as any)
        .select("*,assets(asset_code,name_en,name_bn)")
        .order("next_due_at", { ascending: true }),
      supabase.from("assets" as any).select("id,asset_code,name_en,name_bn").is("deleted_at", null),
    ]);
    setLoading(false);
    if (s.error) toast.error(s.error.message); else {
      let list = (s.data as any[]) ?? [];
      const today = new Date().toISOString().slice(0, 10);
      if (statusFilter === "active") list = list.filter((r: any) => r.active);
      if (statusFilter === "due") list = list.filter((r: any) => r.active && r.next_due_at <= today);
      setRows(list as Sched[]);
    }
    if (a.error) toast.error(a.error.message); else setAssets((a.data as any) ?? []);
  }

  function openCreate() {
    setEditId(null); setForm({ ...emptyForm }); setOpen(true);
  }
  function openEdit(r: Sched) {
    setEditId(r.id);
    setForm({
      asset_id: r.asset_id, title: r.title, frequency_days: r.frequency_days,
      next_due_at: r.next_due_at, vendor: r.vendor ?? "", notes: r.notes ?? "", active: r.active,
    });
    setOpen(true);
  }

  async function save() {
    if (!form.asset_id || !form.title.trim() || form.frequency_days <= 0 || !form.next_due_at) {
      return toast.error(tx("Fill required fields", "প্রয়োজনীয় ফিল্ড পূরণ করুন"));
    }
    setSaving(true);
    try {
      const payload: any = {
        asset_id: form.asset_id, title: form.title.trim(),
        frequency_days: form.frequency_days, next_due_at: form.next_due_at,
        vendor: form.vendor.trim() || null, notes: form.notes.trim() || null,
        active: form.active,
      };
      if (editId) {
        const { error } = await supabase.from("asset_maintenance_schedules" as any).update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        payload.office_id = officeId ?? null;
        const { error } = await supabase.from("asset_maintenance_schedules" as any).insert(payload);
        if (error) throw error;
      }
      toast.success(tx("Saved", "সংরক্ষিত"));
      setOpen(false); load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }

  async function del(id: string) {
    if (!confirm(tx("Delete this schedule?", "এই সময়সূচি মুছবেন?"))) return;
    const { error } = await supabase.from("asset_maintenance_schedules" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(tx("Deleted", "মুছে ফেলা হয়েছে")); load();
  }

  async function markDoneAndAdvance(r: Sched) {
    try {
      // 1) log maintenance
      const today = new Date().toISOString().slice(0, 10);
      const { error: logErr } = await supabase.from("asset_maintenance_logs" as any).insert({
        asset_id: r.asset_id, office_id: r.office_id,
        maintenance_date: today, vendor: r.vendor, cost: 0, downtime_days: 0,
        status: "completed", remarks: `[Scheduled] ${r.title}`,
      });
      if (logErr) throw logErr;
      // 2) advance next_due_at
      const d = new Date(today + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + r.frequency_days);
      const next = d.toISOString().slice(0, 10);
      const { error: upErr } = await supabase.from("asset_maintenance_schedules" as any)
        .update({ next_due_at: next }).eq("id", r.id);
      if (upErr) throw upErr;
      // 3) resolve any open maintenance_due alerts for this asset
      await supabase.from("asset_alerts" as any)
        .update({ status: "resolved", resolved_at: new Date().toISOString() })
        .eq("asset_id", r.asset_id).eq("alert_type", "maintenance_due").eq("status", "open");
      toast.success(tx(`Done — next ${next}`, `সম্পন্ন — পরবর্তী ${next}`));
      load();
    } catch (e: any) { toast.error(e.message); }
  }

  const today = new Date().toISOString().slice(0, 10);
  const counts = useMemo(() => {
    const dueCount = rows.filter(r => r.active && r.next_due_at <= today).length;
    const active = rows.filter(r => r.active).length;
    return { dueCount, active, total: rows.length };
  }, [rows, today]);

  return (
    <>
      <PageHeader
        title={tx("Maintenance Schedules", "মেরামত সময়সূচি")}
        description={tx(
          "Recurring maintenance schedules. Daily scan creates alerts when due.",
          "নিয়মিত মেরামতের সময়সূচি। নির্ধারিত দিনে দৈনিক স্ক্যান সতর্কতা তৈরি করে।",
        )}
        actions={
          isAdmin && (
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" />{tx("New schedule", "নতুন সময়সূচি")}
            </Button>
          )
        }
      />

      <div className="grid grid-cols-3 gap-3 mb-3">
        <Card className="p-3"><div className="text-xs text-muted-foreground">{tx("Due now", "এখন বকেয়া")}</div><div className="mt-1 text-xl font-semibold text-destructive">{counts.dueCount}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">{tx("Active", "সক্রিয়")}</div><div className="mt-1 text-xl font-semibold">{counts.active}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">{tx("Total", "মোট")}</div><div className="mt-1 text-xl font-semibold">{counts.total}</div></Card>
      </div>

      <Card className="p-3 mb-3">
        <div className="flex gap-2 flex-wrap">
          {(["active", "due", "all"] as const).map((k) => (
            <Button key={k} variant={statusFilter === k ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(k)}>
              {k === "active" ? tx("Active", "সক্রিয়") : k === "due" ? tx("Due", "বকেয়া") : tx("All", "সব")}
            </Button>
          ))}
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tx("Asset", "এসেট")}</TableHead>
              <TableHead>{tx("Title", "শিরোনাম")}</TableHead>
              <TableHead>{tx("Frequency", "পুনরাবৃত্তি")}</TableHead>
              <TableHead>{tx("Next due", "পরবর্তী তারিখ")}</TableHead>
              <TableHead>{tx("Vendor", "ভেন্ডর")}</TableHead>
              <TableHead>{tx("Status", "স্ট্যাটাস")}</TableHead>
              <TableHead className="text-right">{tx("Actions", "অ্যাকশন")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const due = r.active && r.next_due_at <= today;
              return (
                <TableRow key={r.id} className={due ? "bg-destructive/5" : ""}>
                  <TableCell>
                    <div className="font-mono text-xs">{r.assets?.asset_code ?? "—"}</div>
                    <div className="text-sm">{r.assets?.name_bn || r.assets?.name_en}</div>
                  </TableCell>
                  <TableCell>{r.title}</TableCell>
                  <TableCell><Badge variant="outline">{r.frequency_days} {tx("days", "দিন")}</Badge></TableCell>
                  <TableCell className={due ? "text-destructive font-medium" : ""}>
                    {due && <CalendarClock className="h-3 w-3 inline mr-1" />}
                    {r.next_due_at}
                  </TableCell>
                  <TableCell className="text-sm">{r.vendor ?? "—"}</TableCell>
                  <TableCell><Badge variant={r.active ? "default" : "secondary"}>{r.active ? tx("Active", "সক্রিয়") : tx("Inactive", "নিষ্ক্রিয়")}</Badge></TableCell>
                  <TableCell className="text-right">
                    {isAdmin && (
                      <div className="inline-flex gap-1">
                        <Button size="icon" variant="ghost" title={tx("Mark done & advance", "সম্পন্ন ও পরবর্তী সেট")} onClick={() => markDoneAndAdvance(r)} disabled={!r.active}>
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {!loading && !rows.length && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">{tx("No schedules", "কোনো সময়সূচি নেই")}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? tx("Edit schedule", "সময়সূচি সম্পাদন") : tx("New schedule", "নতুন সময়সূচি")}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>{tx("Asset", "এসেট")}</Label>
              <Select value={form.asset_id} onValueChange={(v) => setForm({ ...form, asset_id: v })}>
                <SelectTrigger><SelectValue placeholder={tx("Choose asset", "এসেট বাছুন")} /></SelectTrigger>
                <SelectContent>
                  {assets.map((a) => <SelectItem key={a.id} value={a.id}>{a.asset_code} — {a.name_bn || a.name_en}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>{tx("Title", "শিরোনাম")}</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={tx("e.g. Quarterly servicing", "যেমন ত্রৈমাসিক সার্ভিসিং")} />
            </div>
            <div>
              <Label>{tx("Frequency (days)", "পুনরাবৃত্তি (দিন)")}</Label>
              <Input type="number" min={1} value={form.frequency_days} onChange={(e) => setForm({ ...form, frequency_days: Number(e.target.value) })} />
            </div>
            <div>
              <Label>{tx("Next due", "পরবর্তী তারিখ")}</Label>
              <Input type="date" value={form.next_due_at} onChange={(e) => setForm({ ...form, next_due_at: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>{tx("Vendor", "ভেন্ডর")}</Label>
              <Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>{tx("Notes", "নোট")}</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              <Label>{tx("Active", "সক্রিয়")}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>{tx("Cancel", "বাতিল")}</Button>
            <Button onClick={save} disabled={saving}>{saving ? "…" : tx("Save", "সংরক্ষণ")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
