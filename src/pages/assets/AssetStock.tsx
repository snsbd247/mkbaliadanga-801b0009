import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Download, Search, Eye } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { useLang } from "@/i18n/LanguageProvider";
import { downloadCsv } from "@/lib/csvExport";
import { adjustAssetStock } from "@/lib/assetStock";
import { logAssetAudit } from "@/lib/assetAudit";
import { assetTypeLabel, type AssetType } from "./AssetItems";

type Office = { id: string; name: string };
type AssetLite = { id: string; asset_code: string; name_en: string; name_bn: string | null; unit: string | null; asset_type: AssetType };
type StockRow = {
  id: string; asset_id: string; office_id: string | null; location_id: string | null;
  quantity: number; updated_at: string;
};

export default function AssetStock() {
  const { tx } = useLang();
  const { officeId, isAdmin } = useAuth();
  const [stocks, setStocks] = useState<StockRow[]>([]);
  const [assets, setAssets] = useState<AssetLite[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [q, setQ] = useState("");
  const [locFilter, setLocFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | AssetType>("all");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    asset_id: "", location_id: "", mode: "in" as "in" | "out" | "set",
    quantity: 1, remarks: "",
  });

  useEffect(() => {
    document.title = tx("Asset Stock", "এসেট স্টক");
    load();
  }, []);

  async function load() {
    const [s, a, o] = await Promise.all([
      db.from("asset_stocks" as any).select("*").order("updated_at", { ascending: false }),
      db.from("assets" as any).select("id,asset_code,name_en,name_bn,unit,asset_type").is("deleted_at", null),
      db.from("offices").select("id,name").order("name"),
    ]);
    if (s.error) toast.error(s.error.message); else setStocks((s.data as any) ?? []);
    if (a.error) toast.error(a.error.message); else setAssets((a.data as any) ?? []);
    if (o.error) toast.error(o.error.message); else setOffices((o.data as any) ?? []);
  }

  const assetById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  const officeById = useMemo(() => new Map(offices.map((o) => [o.id, o.name])), [offices]);

  const visible = useMemo(() => stocks.filter((s) => {
    const a = assetById.get(s.asset_id);
    if (!a) return false;
    if (locFilter !== "all" && s.location_id !== locFilter) return false;
    if (typeFilter !== "all" && a.asset_type !== typeFilter) return false;
    if (!q.trim()) return true;
    const k = q.trim().toLowerCase();
    return (a.asset_code + " " + a.name_en + " " + (a.name_bn ?? "")).toLowerCase().includes(k);
  }), [stocks, q, locFilter, typeFilter, assetById]);

  const totalsByType = useMemo(() => {
    const m: Record<AssetType, number> = { fixed_asset: 0, inventory: 0, consumable: 0 };
    for (const s of visible) {
      const a = assetById.get(s.asset_id); if (!a) continue;
      m[a.asset_type] = (m[a.asset_type] ?? 0) + Number(s.quantity || 0);
    }
    return m;
  }, [visible, assetById]);

  async function save() {
    if (!form.asset_id || !form.location_id) return toast.error(tx("Asset & location required", "এসেট ও অবস্থান দরকার"));
    if (form.quantity <= 0) return toast.error(tx("Quantity must be > 0", "পরিমাণ শূন্যের বেশি হতে হবে"));
    setSaving(true);
    try {
      let delta = form.quantity;
      if (form.mode === "out") delta = -form.quantity;
      if (form.mode === "set") {
        const cur = stocks.find((s) => s.asset_id === form.asset_id && s.location_id === form.location_id);
        delta = form.quantity - Number(cur?.quantity ?? 0);
      }
      await adjustAssetStock({
        asset_id: form.asset_id, office_id: officeId,
        location_id: form.location_id, delta,
      });
      await logAssetAudit({
        office_id: officeId, asset_id: form.asset_id, entity: "asset_stock",
        action_type: "stock_adjust", new_data: { ...form, delta }, remarks: form.remarks || null,
      });
      toast.success(tx("Stock updated", "স্টক আপডেট হয়েছে"));
      setOpen(false); setForm({ asset_id: "", location_id: "", mode: "in", quantity: 1, remarks: "" });
      load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }

  function exportCsv() {
    downloadCsv(`asset-stock-${new Date().toISOString().slice(0, 10)}`, visible, [
      { header: tx("Code", "কোড"), accessor: (r) => assetById.get(r.asset_id)?.asset_code ?? "" },
      { header: tx("Name", "নাম"), accessor: (r) => assetById.get(r.asset_id)?.name_bn ?? assetById.get(r.asset_id)?.name_en ?? "" },
      { header: tx("Type", "টাইপ"), accessor: (r) => assetById.get(r.asset_id)?.asset_type ?? "" },
      { header: tx("Location", "অবস্থান"), accessor: (r) => officeById.get(r.location_id ?? "") ?? "" },
      { header: tx("Quantity", "পরিমাণ"), accessor: (r) => Number(r.quantity) },
      { header: tx("Unit", "একক"), accessor: (r) => assetById.get(r.asset_id)?.unit ?? "" },
      { header: tx("Updated", "আপডেট"), accessor: (r) => r.updated_at },
    ]);
  }

  return (
    <>
      <PageHeader
        title={tx("Asset Stock", "এসেট স্টক")}
        description={tx(
          "Current inventory balances by location with adjustments and CSV export.",
          "অবস্থান অনুযায়ী বর্তমান ইনভেন্টরি ব্যালেন্স, সমন্বয় ও CSV এক্সপোর্ট।",
        )}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4 mr-1" />{tx("CSV", "CSV")}</Button>
            {isAdmin && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />{tx("Adjust stock", "স্টক সমন্বয়")}</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{tx("Stock adjustment", "স্টক সমন্বয়")}</DialogTitle></DialogHeader>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Label>{tx("Asset", "এসেট")}</Label>
                      <Select value={form.asset_id} onValueChange={(v) => setForm({ ...form, asset_id: v })}>
                        <SelectTrigger><SelectValue placeholder={tx("Choose asset", "এসেট বাছুন")} /></SelectTrigger>
                        <SelectContent>{assets.map((a) => <SelectItem key={a.id} value={a.id}>{a.asset_code} — {a.name_bn || a.name_en}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>{tx("Location", "অবস্থান")}</Label>
                      <Select value={form.location_id} onValueChange={(v) => setForm({ ...form, location_id: v })}>
                        <SelectTrigger><SelectValue placeholder={tx("Choose location", "অবস্থান বাছুন")} /></SelectTrigger>
                        <SelectContent>{offices.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>{tx("Mode", "মোড")}</Label>
                      <Select value={form.mode} onValueChange={(v: any) => setForm({ ...form, mode: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="in">{tx("Stock In", "স্টক ইন")}</SelectItem>
                          <SelectItem value="out">{tx("Stock Out", "স্টক আউট")}</SelectItem>
                          <SelectItem value="set">{tx("Set / Reconcile", "নির্দিষ্ট / মিলকরণ")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Label>{tx("Quantity", "পরিমাণ")}</Label>
                      <Input type="number" min={0} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
                    </div>
                    <div className="col-span-2">
                      <Label>{tx("Remarks", "মন্তব্য")}</Label>
                      <Textarea rows={2} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
                    </div>
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        {(["fixed_asset","inventory","consumable"] as AssetType[]).map((t) => (
          <Card key={t} className="p-3">
            <div className="text-xs text-muted-foreground">{assetTypeLabel(t, tx)}</div>
            <div className="mt-1 text-xl font-semibold">{Number(totalsByType[t] || 0).toLocaleString()}</div>
          </Card>
        ))}
      </div>

      <Card className="p-3 mb-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx("Search asset code or name…", "এসেট কোড বা নাম খুঁজুন…")} />
          </div>
          <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tx("All types", "সব টাইপ")}</SelectItem>
              <SelectItem value="fixed_asset">{assetTypeLabel("fixed_asset", tx)}</SelectItem>
              <SelectItem value="inventory">{assetTypeLabel("inventory", tx)}</SelectItem>
              <SelectItem value="consumable">{assetTypeLabel("consumable", tx)}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={locFilter} onValueChange={setLocFilter}>
            <SelectTrigger><SelectValue placeholder={tx("All locations", "সব অবস্থান")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tx("All locations", "সব অবস্থান")}</SelectItem>
              {offices.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tx("Code", "কোড")}</TableHead>
              <TableHead>{tx("Name", "নাম")}</TableHead>
              <TableHead>{tx("Type", "টাইপ")}</TableHead>
              <TableHead>{tx("Location", "অবস্থান")}</TableHead>
              <TableHead className="text-right">{tx("Quantity", "পরিমাণ")}</TableHead>
              <TableHead>{tx("Updated", "আপডেট")}</TableHead>
              <TableHead className="text-right">{tx("Actions", "অ্যাকশন")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((s) => {
              const a = assetById.get(s.asset_id);
              return (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">{a?.asset_code}</TableCell>
                  <TableCell>{a?.name_bn || a?.name_en}</TableCell>
                  <TableCell><Badge variant="outline">{a ? assetTypeLabel(a.asset_type, tx) : "—"}</Badge></TableCell>
                  <TableCell className="text-sm">{officeById.get(s.location_id ?? "") ?? "—"}</TableCell>
                  <TableCell className="text-right font-medium">{Number(s.quantity).toLocaleString()} <span className="text-xs text-muted-foreground">{a?.unit ?? ""}</span></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(s.updated_at).toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" asChild>
                      <Link to={`/assets/items/${s.asset_id}`} aria-label={tx("View", "দেখুন")}><Eye className="h-4 w-4" /></Link>
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {!visible.length && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">{tx("No stock entries", "কোনো স্টক নেই")}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
