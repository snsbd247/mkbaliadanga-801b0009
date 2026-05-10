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
  install_date: string; location_id: string | null; location_name: string | null;
  condition_status: string | null; remarks: string | null;
  installed_by: string | null; created_at: string; deleted_at: string | null;
};

const today = () => new Date().toISOString().slice(0, 10);
const monthsAgo = (n: number) => { const d = new Date(); d.setMonth(d.getMonth() - n); return d.toISOString().slice(0, 10); };

export default function AssetInstallations() {
  const { tx } = useLang();
  const { user, officeId, isAdmin } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [assets, setAssets] = useState<AssetLite[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [q, setQ] = useState("");
  const [from, setFrom] = useState(monthsAgo(6));
  const [to, setTo] = useState(today());
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    asset_id: "", install_date: today(), location_id: "", location_name: "",
    condition_status: "good", remarks: "",
  });

  useEffect(() => { document.title = tx("Asset Installations", "এসেট ইনস্টলেশন"); load(); }, []);
  useEffect(() => { load(); }, [from, to]);

  async function load() {
    const [r, a, o] = await Promise.all([
      supabase.from("asset_installations" as any).select("*")
        .is("deleted_at", null)
        .gte("install_date", from).lte("install_date", to)
        .order("install_date", { ascending: false }).order("created_at", { ascending: false })
        .limit(1000),
      supabase.from("assets" as any).select("id,asset_code,name_en,name_bn,office_id").is("deleted_at", null),
      supabase.from("offices").select("id,name").order("name"),
    ]);
    if (r.error) toast.error(r.error.message); else setRows((r.data as any) ?? []);
    if (!a.error) setAssets((a.data as any) ?? []);
    if (!o.error) setOffices((o.data as any) ?? []);
  }

  const assetById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  const officeById = useMemo(() => new Map(offices.map((o) => [o.id, o.name])), [offices]);

  const visible = useMemo(() => rows.filter((r) => {
    if (!q.trim()) return true;
    const a = assetById.get(r.asset_id);
    const k = q.trim().toLowerCase();
    return ((a?.asset_code ?? "") + " " + (a?.name_en ?? "") + " " + (a?.name_bn ?? "") + " " + (r.location_name ?? "") + " " + (r.remarks ?? "")).toLowerCase().includes(k);
  }), [rows, q, assetById]);

  async function save() {
    if (!form.asset_id) return toast.error(tx("Asset required", "এসেট দরকার"));
    setSaving(true);
    try {
      const a = assetById.get(form.asset_id);
      const { data: row, error } = await supabase.from("asset_installations" as any).insert({
        office_id: a?.office_id ?? officeId, asset_id: form.asset_id,
        install_date: form.install_date, location_id: form.location_id || null,
        location_name: form.location_name || null, installed_by: user?.id ?? null,
        condition_status: form.condition_status, remarks: form.remarks || null,
      }).select("id").single();
      if (error) throw error;
      await supabase.from("assets" as any).update({
        current_status: "installed", current_location_id: form.location_id || null,
        installed_at: new Date().toISOString(),
      }).eq("id", form.asset_id);
      await logAssetAudit({
        office_id: a?.office_id ?? officeId, asset_id: form.asset_id,
        entity: "asset_installation", entity_id: (row as any)?.id ?? null,
        action_type: "install", new_data: form,
      });
      toast.success(tx("Installation recorded", "ইনস্টলেশন রেকর্ড হয়েছে"));
      setOpen(false);
      setForm({ asset_id: "", install_date: today(), location_id: "", location_name: "", condition_status: "good", remarks: "" });
      load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }

  function exportCsv() {
    downloadCsv(`asset-installations-${from}_to_${to}`, visible, [
      { header: tx("Date", "তারিখ"), accessor: (r) => r.install_date },
      { header: tx("Code", "কোড"), accessor: (r) => assetById.get(r.asset_id)?.asset_code ?? "" },
      { header: tx("Name", "নাম"), accessor: (r) => assetById.get(r.asset_id)?.name_bn ?? assetById.get(r.asset_id)?.name_en ?? "" },
      { header: tx("Office", "অফিস"), accessor: (r) => officeById.get(r.location_id ?? "") ?? "" },
      { header: tx("Location", "অবস্থান"), accessor: (r) => r.location_name ?? "" },
      { header: tx("Condition", "অবস্থা"), accessor: (r) => r.condition_status ?? "" },
      { header: tx("Remarks", "মন্তব্য"), accessor: (r) => r.remarks ?? "" },
    ]);
  }

  return (
    <>
      <PageHeader
        title={tx("Asset Installations", "এসেট ইনস্টলেশন")}
        description={tx("Track where and when each asset was installed and put into use.",
          "প্রতিটি এসেট কোথায় ও কখন ইনস্টল ও ব্যবহার শুরু হয়েছে তা ট্র্যাক করুন।")}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4 mr-1" />CSV</Button>
            {isAdmin && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />{tx("New installation", "নতুন ইনস্টলেশন")}</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{tx("Record installation", "ইনস্টলেশন রেকর্ড")}</DialogTitle></DialogHeader>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Label>{tx("Asset", "এসেট")}</Label>
                      <Select value={form.asset_id} onValueChange={(v) => setForm({ ...form, asset_id: v })}>
                        <SelectTrigger><SelectValue placeholder={tx("Choose asset", "এসেট বাছুন")} /></SelectTrigger>
                        <SelectContent>{assets.map((a) => <SelectItem key={a.id} value={a.id}>{a.asset_code} — {a.name_bn || a.name_en}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>{tx("Date", "তারিখ")}</Label><Input type="date" value={form.install_date} onChange={(e) => setForm({ ...form, install_date: e.target.value })} /></div>
                    <div>
                      <Label>{tx("Office", "অফিস")}</Label>
                      <Select value={form.location_id} onValueChange={(v) => setForm({ ...form, location_id: v })}>
                        <SelectTrigger><SelectValue placeholder={tx("Choose office", "অফিস বাছুন")} /></SelectTrigger>
                        <SelectContent>{offices.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2"><Label>{tx("Location detail", "অবস্থান বিবরণ")}</Label><Input value={form.location_name} onChange={(e) => setForm({ ...form, location_name: e.target.value })} placeholder={tx("e.g. Pump house, Block-A", "যেমন পাম্প ঘর, ব্লক-এ")} /></div>
                    <div>
                      <Label>{tx("Condition", "অবস্থা")}</Label>
                      <Select value={form.condition_status} onValueChange={(v) => setForm({ ...form, condition_status: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="good">{tx("Good", "ভালো")}</SelectItem>
                          <SelectItem value="fair">{tx("Fair", "মাঝারি")}</SelectItem>
                          <SelectItem value="poor">{tx("Poor", "দুর্বল")}</SelectItem>
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

      <Card className="p-3 mb-3">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx("Search code, name, location…", "কোড, নাম, অবস্থান খুঁজুন…")} />
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
              <TableHead>{tx("Office", "অফিস")}</TableHead>
              <TableHead>{tx("Location", "অবস্থান")}</TableHead>
              <TableHead>{tx("Condition", "অবস্থা")}</TableHead>
              <TableHead>{tx("Remarks", "মন্তব্য")}</TableHead>
              <TableHead className="text-right">{tx("Actions", "অ্যাকশন")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((r) => {
              const a = assetById.get(r.asset_id);
              return (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{r.install_date}</TableCell>
                  <TableCell><div className="font-mono text-xs">{a?.asset_code}</div><div className="text-sm">{a?.name_bn || a?.name_en}</div></TableCell>
                  <TableCell className="text-sm">{officeById.get(r.location_id ?? "") ?? "—"}</TableCell>
                  <TableCell className="text-sm">{r.location_name ?? "—"}</TableCell>
                  <TableCell><Badge variant={r.condition_status === "poor" ? "destructive" : r.condition_status === "fair" ? "secondary" : "default"}>{r.condition_status ?? "—"}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.remarks ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" asChild><Link to={`/assets/items/${r.asset_id}`}><Eye className="h-4 w-4" /></Link></Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {!visible.length && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6"><Wrench className="h-8 w-8 mx-auto mb-2 opacity-40" />{tx("No installations in selected range", "নির্বাচিত সময়ে কোনো ইনস্টলেশন নেই")}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
