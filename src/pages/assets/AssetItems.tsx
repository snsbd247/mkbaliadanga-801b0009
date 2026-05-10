import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EditButton } from "@/components/ui/action-icon-button";
import { Plus, Search, Eye, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { useLang } from "@/i18n/LanguageProvider";
import { logAssetAudit } from "@/lib/assetAudit";
import { seedDemoAssets } from "@/lib/assetDemoSeed";

type TrackingMode = "quantity" | "serial";
export type AssetType = "inventory" | "fixed_asset" | "consumable";
type AssetStatus =
  | "purchased" | "in_stock" | "transferred" | "installed"
  | "maintenance" | "damaged" | "disposed"
  | "in_use" | "scrapped" | "lost";

type Cat = { id: string; code: string; name_bn: string | null; name_en: string; tracking_mode: TrackingMode };
type Row = {
  id: string;
  office_id: string | null;
  asset_category_id: string | null;
  asset_code: string;
  serial_no: string | null;
  name_bn: string | null;
  name_en: string;
  tracking_mode: TrackingMode;
  asset_type: AssetType;
  unit: string | null;
  purchase_price: number;
  current_status: AssetStatus;
  deleted_at: string | null;
};

const empty = {
  id: "",
  asset_category_id: "",
  asset_code: "",
  serial_no: "",
  name_bn: "",
  name_en: "",
  tracking_mode: "quantity" as TrackingMode,
  asset_type: "fixed_asset" as AssetType,
  unit: "",
  purchase_price: 0,
};

export function assetTypeLabel(t: AssetType, tx: (en: string, bn: string) => string) {
  const m: Record<AssetType, [string, string]> = {
    inventory:    ["Inventory", "ইনভেন্টরি"],
    fixed_asset:  ["Fixed Asset", "স্থায়ী এসেট"],
    consumable:   ["Consumable", "ভোগ্য"],
  };
  const [en, bn] = m[t];
  return tx(en, bn);
}

export function statusLabel(s: AssetStatus, tx: (en: string, bn: string) => string) {
  const m: Record<AssetStatus, [string, string]> = {
    purchased: ["Purchased", "ক্রয়কৃত"],
    in_stock: ["In Stock", "স্টকে"],
    transferred: ["Transferred", "স্থানান্তরিত"],
    installed: ["Installed", "ইনস্টল"],
    in_use: ["In Use", "ব্যবহৃত"],
    maintenance: ["Maintenance", "মেরামত"],
    damaged: ["Damaged", "ক্ষতিগ্রস্ত"],
    disposed: ["Disposed", "নিষ্পত্তি"],
    scrapped: ["Scrapped", "স্ক্র্যাপড"],
    lost: ["Lost", "হারানো"],
  };
  const pair = m[s] ?? [s, s];
  return tx(pair[0], pair[1]);
}

export function statusVariant(s: AssetStatus): "default" | "secondary" | "outline" | "destructive" {
  if (s === "damaged" || s === "disposed" || s === "scrapped" || s === "lost") return "destructive";
  if (s === "in_stock" || s === "purchased") return "secondary";
  if (s === "maintenance" || s === "transferred") return "outline";
  return "default";
}

export default function AssetItems() {
  const { tx } = useLang();
  const { isAdmin, officeId } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(empty);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AssetStatus>("all");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | AssetType>("all");

  useEffect(() => {
    document.title = tx("Asset Registry", "এসেট রেজিস্ট্রি");
    load();
  }, []);

  async function load() {
    const [a, b] = await Promise.all([
      supabase.from("assets" as any).select("*").is("deleted_at", null).order("created_at", { ascending: false }),
      supabase.from("asset_categories" as any).select("id, code, name_bn, name_en, tracking_mode").is("deleted_at", null).eq("is_active", true).order("code"),
    ]);
    if (a.error) toast.error(a.error.message); else setRows((a.data as any) ?? []);
    if (b.error) toast.error(b.error.message); else setCats((b.data as any) ?? []);
  }

  function openNew() { setForm(empty); setOpen(true); }
  function openEdit(r: Row) {
    setForm({
      id: r.id, asset_category_id: r.asset_category_id ?? "",
      asset_code: r.asset_code, serial_no: r.serial_no ?? "",
      name_bn: r.name_bn ?? "", name_en: r.name_en,
      tracking_mode: r.tracking_mode, unit: r.unit ?? "",
      asset_type: r.asset_type ?? "fixed_asset",
      purchase_price: Number(r.purchase_price ?? 0),
    });
    setOpen(true);
  }

  function onCatChange(id: string) {
    const cat = cats.find((c) => c.id === id);
    setForm((f) => ({ ...f, asset_category_id: id, tracking_mode: cat?.tracking_mode ?? f.tracking_mode }));
  }

  async function save() {
    if (!form.asset_code.trim()) return toast.error(tx("Asset code required", "এসেট কোড দরকার"));
    if (!form.name_en.trim() && !form.name_bn.trim()) return toast.error(tx("Name required", "নাম দরকার"));
    if (form.tracking_mode === "serial" && !form.serial_no.trim()) {
      return toast.error(tx("Serial number required for serial-tracked asset", "সিরিয়াল ট্র্যাকড এসেটের জন্য সিরিয়াল নম্বর দরকার"));
    }
    setSaving(true);
    try {
      const payload: any = {
        office_id: officeId,
        asset_category_id: form.asset_category_id || null,
        asset_code: form.asset_code.trim(),
        serial_no: form.serial_no.trim() || null,
        name_bn: form.name_bn.trim() || null,
        name_en: form.name_en.trim() || form.name_bn.trim(),
        tracking_mode: form.tracking_mode,
        asset_type: form.asset_type,
        unit: form.unit.trim() || null,
        purchase_price: Number(form.purchase_price) || 0,
      };
      let error: any;
      if (form.id) {
        ({ error } = await supabase.from("assets" as any).update(payload).eq("id", form.id));
      } else {
        ({ error } = await supabase.from("assets" as any).insert(payload));
      }
      if (error) throw error;
      await logAssetAudit({
        office_id: officeId, entity: "asset", asset_id: form.id || null, entity_id: form.id || null,
        action_type: form.id ? "update" : "create", new_data: payload,
      });
      toast.success(tx("Saved", "সংরক্ষিত"));
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally { setSaving(false); }
  }

  const visible = useMemo(() => rows.filter((r) => {
    if (statusFilter !== "all" && r.current_status !== statusFilter) return false;
    if (catFilter !== "all" && r.asset_category_id !== catFilter) return false;
    if (typeFilter !== "all" && (r.asset_type ?? "fixed_asset") !== typeFilter) return false;
    if (!q.trim()) return true;
    const s = q.trim().toLowerCase();
    return (r.asset_code + " " + (r.serial_no ?? "") + " " + r.name_en + " " + (r.name_bn ?? "")).toLowerCase().includes(s);
  }), [rows, q, statusFilter, catFilter, typeFilter]);

  const catName = (id: string | null) => {
    const c = cats.find((x) => x.id === id);
    return c ? (c.name_bn || c.name_en) : "—";
  };

  return (
    <>
      <PageHeader
        title={tx("Asset Registry", "এসেট রেজিস্ট্রি")}
        description={tx(
          "Central registry of every physical asset, inventory item, and consumable. Each item belongs to a category and tracks its lifecycle.",
          "প্রতিটি ভৌত এসেট, ইনভেন্টরি ও ভোগ্য আইটেমের কেন্দ্রীয় রেজিস্ট্রি। প্রতিটি আইটেম একটি ক্যাটাগরির অধীনে এবং তার লাইফসাইকেল ট্র্যাক করে।",
        )}
        actions={
          <div className="flex gap-2">
            {isAdmin && officeId && (
              <Button variant="outline" size="sm" onClick={async () => {
                try {
                  const r = await seedDemoAssets(officeId, null);
                  toast.success(r.skipped ? tx("Demo already seeded", "ডেমো আগেই যোগ করা") : tx("Demo seeded", "ডেমো যোগ হয়েছে"));
                  load();
                } catch (e: any) { toast.error(e.message); }
              }}><Sparkles className="h-4 w-4 mr-1" />{tx("Seed demo", "ডেমো সিড")}</Button>
            )}
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty); }}>
              <DialogTrigger asChild>
                <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" />{tx("New asset", "নতুন এসেট")}</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                <DialogTitle>{form.id ? tx("Edit asset", "এসেট সম্পাদনা") : tx("New asset", "নতুন এসেট")}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>{tx("Category", "ক্যাটাগরি")}</Label>
                  <Select value={form.asset_category_id} onValueChange={onCatChange}>
                    <SelectTrigger><SelectValue placeholder={tx("Choose category", "ক্যাটাগরি বাছুন")} /></SelectTrigger>
                    <SelectContent>
                      {cats.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.code} — {c.name_bn || c.name_en}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{tx("Asset code", "এসেট কোড")}</Label>
                  <Input value={form.asset_code} onChange={(e) => setForm({ ...form, asset_code: e.target.value })} placeholder="MTR-0001" />
                </div>
                <div>
                  <Label>{tx("Tracking", "ট্র্যাকিং")}</Label>
                  <Select value={form.tracking_mode} onValueChange={(v: any) => setForm({ ...form, tracking_mode: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quantity">{tx("Quantity", "কোয়ান্টিটি")}</SelectItem>
                      <SelectItem value="serial">{tx("Serial", "সিরিয়াল")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{tx("Asset type", "এসেট টাইপ")}</Label>
                  <Select value={form.asset_type} onValueChange={(v: any) => setForm({ ...form, asset_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed_asset">{assetTypeLabel("fixed_asset", tx)}</SelectItem>
                      <SelectItem value="inventory">{assetTypeLabel("inventory", tx)}</SelectItem>
                      <SelectItem value="consumable">{assetTypeLabel("consumable", tx)}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 text-xs text-muted-foreground">
                  {form.asset_type === "fixed_asset"
                    ? tx("Fixed assets are depreciated and tracked individually.", "স্থায়ী এসেট অবচয় হয় এবং পৃথকভাবে ট্র্যাক করা হয়।")
                    : form.asset_type === "inventory"
                    ? tx("Inventory items are tracked by quantity only — no depreciation.", "ইনভেন্টরি শুধু পরিমাণে ট্র্যাক হয় — অবচয় হয় না।")
                    : tx("Consumables can be expensed directly on use.", "ভোগ্য আইটেম ব্যবহারের সাথে সরাসরি খরচ লেখা যায়।")}
                </div>
                <div>
                  <Label>{tx("Name (Bengali)", "নাম (বাংলা)")}</Label>
                  <Input value={form.name_bn} onChange={(e) => setForm({ ...form, name_bn: e.target.value })} placeholder="৫ এইচপি মোটর" />
                </div>
                <div>
                  <Label>{tx("Name (English)", "নাম (English)")}</Label>
                  <Input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} placeholder="5HP Motor" />
                </div>
                <div>
                  <Label>{tx("Serial no.", "সিরিয়াল নম্বর")}</Label>
                  <Input value={form.serial_no} onChange={(e) => setForm({ ...form, serial_no: e.target.value })} placeholder={form.tracking_mode === "serial" ? tx("Required", "আবশ্যক") : tx("Optional", "ঐচ্ছিক")} />
                </div>
                <div>
                  <Label>{tx("Unit", "একক")}</Label>
                  <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder={tx("pcs / m / litre", "পিস / মিটার / লিটার")} />
                </div>
                <div>
                  <Label>{tx("Purchase price", "ক্রয়মূল্য")}</Label>
                  <Input type="number" min={0} value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: Number(e.target.value) })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>{tx("Cancel", "বাতিল")}</Button>
                <Button onClick={save} disabled={saving}>{saving ? "…" : tx("Save", "সংরক্ষণ")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        }
      />
      <Card className="p-3 mb-3">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx("Search code, serial, name…", "কোড, সিরিয়াল, নাম খুঁজুন…")} />
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
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger><SelectValue placeholder={tx("All categories", "সব ক্যাটাগরি")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tx("All categories", "সব ক্যাটাগরি")}</SelectItem>
              {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name_bn || c.name_en}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tx("All statuses", "সব অবস্থা")}</SelectItem>
              {(["purchased","in_stock","transferred","installed","in_use","maintenance","damaged","disposed","scrapped","lost"] as AssetStatus[]).map((s) =>
                <SelectItem key={s} value={s}>{statusLabel(s, tx)}</SelectItem>)}
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
              <TableHead>{tx("Category", "ক্যাটাগরি")}</TableHead>
              <TableHead>{tx("Tracking", "ট্র্যাকিং")}</TableHead>
              <TableHead>{tx("Serial", "সিরিয়াল")}</TableHead>
              <TableHead className="text-right">{tx("Price", "মূল্য")}</TableHead>
              <TableHead>{tx("Status", "অবস্থা")}</TableHead>
              <TableHead className="text-right">{tx("Actions", "অ্যাকশন")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.asset_code}</TableCell>
                <TableCell>{r.name_bn || r.name_en}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{catName(r.asset_category_id)}</TableCell>
                <TableCell>
                  <Badge variant={r.tracking_mode === "serial" ? "default" : "secondary"}>
                    {r.tracking_mode === "serial" ? tx("Serial", "সিরিয়াল") : tx("Quantity", "কোয়ান্টিটি")}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">{r.serial_no || "—"}</TableCell>
                <TableCell className="text-right">{Number(r.purchase_price).toLocaleString()}</TableCell>
                <TableCell><Badge variant={statusVariant(r.current_status)}>{statusLabel(r.current_status, tx)}</Badge></TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex items-center gap-1 justify-end">
                    <Button variant="ghost" size="icon" asChild>
                      <Link to={`/assets/items/${r.id}`} aria-label={tx("View", "দেখুন")}><Eye className="h-4 w-4" /></Link>
                    </Button>
                    {isAdmin && <EditButton onClick={() => openEdit(r)} />}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!visible.length && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">{tx("No assets yet", "এখনও কোনো এসেট নেই")}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
