import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Download, Search, Eye, Wrench } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { useLang } from "@/i18n/LanguageProvider";
import { downloadCsv } from "@/lib/csvExport";
import { logAssetAudit } from "@/lib/assetAudit";

type Office = { id: string; name: string };
type AssetLite = { id: string; asset_code: string; name_en: string; name_bn: string | null; office_id: string | null };
type Row = {
  id: string; asset_id: string; office_id: string | null;
  maintenance_date: string; vendor: string | null; cost: number; downtime_days: number;
  status: string | null; remarks: string | null; created_at: string; deleted_at: string | null;
};

const today = () => new Date().toISOString().slice(0, 10);
const monthsAgo = (n: number) => { const d = new Date(); d.setMonth(d.getMonth() - n); return d.toISOString().slice(0, 10); };

export default function AssetMaintenance() {
  const { tx } = useLang();
  const { user, officeId, isAdmin } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [assets, setAssets] = useState<AssetLite[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState<string>("all");
  const [from, setFrom] = useState(monthsAgo(6));
  const [to, setTo] = useState(today());
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    asset_id: "", maintenance_date: today(), vendor: "", cost: 0, downtime_days: 0,
    status: "in_progress", remarks: "",
  });

  useEffect(() => { document.title = tx("Asset Maintenance", "এসেট মেরামত"); load(); }, []);
  useEffect(() => { load(); }, [from, to]);

  async function load() {
    const [r, a, o] = await Promise.all([
      supabase.from("asset_maintenance_logs" as any).select("*")
        .is("deleted_at", null)
        .gte("maintenance_date", from).lte("maintenance_date", to)
        .order("maintenance_date", { ascending: false }).order("created_at", { ascending: false })
        .limit(1000),
      supabase.from("assets" as any).select("id,asset_code,name_en,name_bn,office_id").is("deleted_at", null),
      supabase.from("offices").select("id,name").order("name"),
    ]);
    if (r.error) toast.error(r.error.message); else setRows((r.data as any) ?? []);
    if (!a.error) setAssets((a.data as any) ?? []);
    if (!o.error) setOffices((o.data as any) ?? []);
  }

  const assetById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);

  const visible = useMemo(() => rows.filter((r) => {
    if (statusF !== "all" && (r.status ?? "") !== statusF) return false;
    if (!q.trim()) return true;
    const a = assetById.get(r.asset_id);
    const k = q.trim().toLowerCase();
    return ((a?.asset_code ?? "") + " " + (a?.name_en ?? "") + " " + (a?.name_bn ?? "") + " " + (r.vendor ?? "") + " " + (r.remarks ?? "")).toLowerCase().includes(k);
  }), [rows, q, statusF, assetById]);

  const totalCost = useMemo(() => visible.reduce((s, r) => s + Number(r.cost || 0), 0), [visible]);
  const totalDowntime = useMemo(() => visible.reduce((s, r) => s + Number(r.downtime_days || 0), 0), [visible]);

  async function save() {
    if (!form.asset_id) return toast.error(tx("Asset required", "এসেট দরকার"));
    setSaving(true);
    try {
      const a = assetById.get(form.asset_id);
      const { data: row, error } = await supabase.from("asset_maintenance_logs" as any).insert({
        office_id: a?.office_id ?? officeId, asset_id: form.asset_id,
        maintenance_date: form.maintenance_date, vendor: form.vendor || null,
        cost: form.cost, downtime_days: form.downtime_days, status: form.status,
        remarks: form.remarks || null, created_by: user?.id ?? null,
      }).select("id").single();
      if (error) throw error;
      await supabase.from("assets" as any).update({
        current_status: form.status === "completed" ? "in_stock" : "maintenance",
      }).eq("id", form.asset_id);
      await logAssetAudit({
        office_id: a?.office_id ?? officeId, asset_id: form.asset_id,
        entity: "asset_maintenance", entity_id: (row as any)?.id ?? null,
        action_type: "repair", new_data: form,
      });
      toast.success(tx("Maintenance recorded", "মেরামত রেকর্ড হয়েছে"));
      setOpen(false);
      setForm({ asset_id: "", maintenance_date: today(), vendor: "", cost: 0, downtime_days: 0, status: "in_progress", remarks: "" });
      load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }

  function exportCsv() {
    downloadCsv(`asset-maintenance-${from}_to_${to}`, visible, [
      { header: tx("Date", "তারিখ"), accessor: (r) => r.maintenance_date },
      { header: tx("Code", "কোড"), accessor: (r) => assetById.get(r.asset_id)?.asset_code ?? "" },
      { header: tx("Name", "নাম"), accessor: (r) => assetById.get(r.asset_id)?.name_bn ?? assetById.get(r.asset_id)?.name_en ?? "" },
      { header: tx("Vendor", "ভেন্ডর"), accessor: (r) => r.vendor ?? "" },
      { header: tx("Cost", "খরচ"), accessor: (r) => Number(r.cost || 0) },
      { header: tx("Downtime (days)", "বন্ধ (দিন)"), accessor: (r) => Number(r.downtime_days || 0) },
      { header: tx("Status", "অবস্থা"), accessor: (r) => r.status ?? "" },
      { header: tx("Remarks", "মন্তব্য"), accessor: (r) => r.remarks ?? "" },
    ]);
  }

  return (
    <>
      <PageHeader
        title={tx("Asset Maintenance", "এসেট মেরামত")}
        description={tx("Maintenance log with cost & downtime tracking.", "মেরামত লগ — খরচ ও বন্ধকালীন সময় ট্র্যাকিংসহ।")}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4 mr-1" />CSV</Button>
            {isAdmin && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />{tx("New maintenance", "নতুন মেরামত")}</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{tx("Record maintenance", "মেরামত রেকর্ড")}</DialogTitle></DialogHeader>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Label>{tx("Asset", "এসেট")}</Label>
                      <Select value={form.asset_id} onValueChange={(v) => setForm({ ...form, asset_id: v })}>
                        <SelectTrigger><SelectValue placeholder={tx("Choose asset", "এসেট বাছুন")} /></SelectTrigger>
                        <SelectContent>{assets.map((a) => <SelectItem key={a.id} value={a.id}>{a.asset_code} — {a.name_bn || a.name_en}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>{tx("Date", "তারিখ")}</Label><Input type="date" value={form.maintenance_date} onChange={(e) => setForm({ ...form, maintenance_date: e.target.value })} /></div>
                    <div><Label>{tx("Vendor", "ভেন্ডর")}</Label><Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} /></div>
                    <div><Label>{tx("Cost", "খরচ")}</Label><Input type="number" min={0} value={form.cost} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} /></div>
                    <div><Label>{tx("Downtime (days)", "বন্ধ (দিন)")}</Label><Input type="number" min={0} value={form.downtime_days} onChange={(e) => setForm({ ...form, downtime_days: Number(e.target.value) })} /></div>
                    <div className="col-span-2">
                      <Label>{tx("Status", "অবস্থা")}</Label>
                      <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="in_progress">{tx("In progress", "চলমান")}</SelectItem>
                          <SelectItem value="completed">{tx("Completed", "সম্পন্ন")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2"><Label>{tx("Remarks", "মন্তব্য")}</Label><Textarea rows={2} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>{tx("Cancel", "বাতিল")}</Button>
                    <Button onClick={save} disabled={saving}>{saving ? "…" : tx("Save", "সংরক্ষণ")}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <Card className="p-3"><div className="text-xs text-muted-foreground">{tx("Records", "রেকর্ড")}</div><div className="text-2xl font-bold">{visible.length.toLocaleString()}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">{tx("Total cost", "মোট খরচ")}</div><div className="text-2xl font-bold">{totalCost.toLocaleString()}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">{tx("Downtime days", "বন্ধ দিন")}</div><div className="text-2xl font-bold">{totalDowntime.toLocaleString()}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">{tx("In progress", "চলমান")}</div><div className="text-2xl font-bold">{visible.filter(r => r.status === "in_progress").length}</div></Card>
      </div>

      <Card className="p-3 mb-3">
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx("Search…", "খুঁজুন…")} />
          </div>
          <div>
            <Label className="text-xs">{tx("Status", "অবস্থা")}</Label>
            <Select value={statusF} onValueChange={setStatusF}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tx("All", "সব")}</SelectItem>
                <SelectItem value="in_progress">{tx("In progress", "চলমান")}</SelectItem>
                <SelectItem value="completed">{tx("Completed", "সম্পন্ন")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">{tx("From", "থেকে")}</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label className="text-xs">{tx("To", "পর্যন্ত")}</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tx("Date", "তারিখ")}</TableHead>
              <TableHead>{tx("Asset", "এসেট")}</TableHead>
              <TableHead>{tx("Vendor", "ভেন্ডর")}</TableHead>
              <TableHead className="text-right">{tx("Cost", "খরচ")}</TableHead>
              <TableHead className="text-right">{tx("Downtime", "বন্ধ")}</TableHead>
              <TableHead>{tx("Status", "অবস্থা")}</TableHead>
              <TableHead className="text-right">{tx("Actions", "অ্যাকশন")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((r) => {
              const a = assetById.get(r.asset_id);
              return (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{r.maintenance_date}</TableCell>
                  <TableCell><div className="font-mono text-xs">{a?.asset_code}</div><div className="text-sm">{a?.name_bn || a?.name_en}</div></TableCell>
                  <TableCell className="text-sm">{r.vendor ?? "—"}</TableCell>
                  <TableCell className="text-right">{Number(r.cost || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right">{Number(r.downtime_days || 0)}</TableCell>
                  <TableCell><Badge variant={r.status === "completed" ? "default" : "secondary"}>{r.status ?? "—"}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" asChild><Link to={`/assets/items/${r.asset_id}`}><Eye className="h-4 w-4" /></Link></Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {!visible.length && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6"><Wrench className="h-8 w-8 mx-auto mb-2 opacity-40" />{tx("No maintenance in selected range", "নির্বাচিত সময়ে কোনো মেরামত নেই")}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
