import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EditButton, DeleteButton } from "@/components/ui/action-icon-button";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { useLang } from "@/i18n/LanguageProvider";
import { logAssetAudit } from "@/lib/assetAudit";

type TrackingMode = "quantity" | "serial";
type Row = {
  id: string;
  office_id: string | null;
  code: string;
  name_bn: string | null;
  name_en: string;
  tracking_mode: TrackingMode;
  is_active: boolean;
  deleted_at: string | null;
};

const empty = {
  id: "",
  code: "",
  name_bn: "",
  name_en: "",
  tracking_mode: "quantity" as TrackingMode,
  is_active: true,
};

export default function AssetCategories() {
  const { tx } = useLang();
  const { isAdmin, officeId } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(empty);
  const [q, setQ] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");

  useEffect(() => {
    document.title = tx("Asset Categories", "এসেট ক্যাটাগরি");
    load();
  }, []);

  async function load() {
    const { data, error } = await db
      .from("asset_categories" as any)
      .select("*")
      .is("deleted_at", null)
      .order("code");
    if (error) return toast.error(error.message);
    setRows((data as any) ?? []);
  }

  function openNew() { setForm(empty); setOpen(true); }
  function openEdit(r: Row) {
    setForm({
      id: r.id, code: r.code,
      name_bn: r.name_bn ?? "", name_en: r.name_en ?? "",
      tracking_mode: r.tracking_mode, is_active: r.is_active,
    });
    setOpen(true);
  }

  async function save() {
    if (!form.code.trim()) return toast.error(tx("Code required", "কোড দরকার"));
    if (!form.name_en.trim() && !form.name_bn.trim()) return toast.error(tx("Name required", "নাম দরকার"));
    setSaving(true);
    try {
      const payload: any = {
        office_id: officeId,
        code: form.code.trim(),
        name_bn: form.name_bn.trim() || null,
        name_en: form.name_en.trim() || form.name_bn.trim(),
        tracking_mode: form.tracking_mode,
        is_active: form.is_active,
      };
      let error: any;
      if (form.id) {
        ({ error } = await db.from("asset_categories" as any).update(payload).eq("id", form.id));
      } else {
        ({ error } = await db.from("asset_categories" as any).insert(payload));
      }
      if (error) throw error;
      await logAssetAudit({
        office_id: officeId, entity: "asset_category", entity_id: form.id || null,
        action_type: form.id ? "update" : "create", new_data: payload,
      });
      toast.success(tx("Saved", "সংরক্ষিত"));
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally { setSaving(false); }
  }

  async function softDelete(id: string) {
    const { error } = await db
      .from("asset_categories" as any)
      .update({ deleted_at: new Date().toISOString() } as any)
      .eq("id", id);
    if (error) return toast.error(error.message);
    await logAssetAudit({ office_id: officeId, entity: "asset_category", entity_id: id, action_type: "delete" });
    load();
  }

  const visible = rows.filter((r) => {
    if (activeFilter === "active" && !r.is_active) return false;
    if (activeFilter === "inactive" && r.is_active) return false;
    if (!q.trim()) return true;
    const s = q.trim().toLowerCase();
    return (r.code + " " + (r.name_en ?? "") + " " + (r.name_bn ?? "")).toLowerCase().includes(s);
  });

  return (
    <>
      <PageHeader
        title={tx("Asset Categories", "এসেট ক্যাটাগরি")}
        description={tx(
          "Define asset categories like Motor, Pump, Pipe, Tools. Choose Quantity tracking for consumables or Serial tracking for high-value reusable assets.",
          "এসেট ক্যাটাগরি যেমন মোটর, পাম্প, পাইপ, টুলস তৈরি করুন। কনজিউমেবলের জন্য Quantity, পুনর্ব্যবহারযোগ্য মূল্যবান যন্ত্রপাতির জন্য Serial বেছে নিন।",
        )}
        actions={
          isAdmin && (
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty); }}>
              <DialogTrigger asChild>
                <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" />{tx("New", "নতুন")}</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{form.id ? tx("Edit category", "ক্যাটাগরি সম্পাদনা") : tx("New category", "নতুন ক্যাটাগরি")}</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{tx("Code", "কোড")}</Label>
                    <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="MOTOR" />
                  </div>
                  <div>
                    <Label>{tx("Tracking mode", "ট্র্যাকিং মোড")}</Label>
                    <Select value={form.tracking_mode} onValueChange={(v: any) => setForm({ ...form, tracking_mode: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="quantity">{tx("Quantity (consumable)", "কোয়ান্টিটি (কনজিউমেবল)")}</SelectItem>
                        <SelectItem value="serial">{tx("Serial (per unit)", "সিরিয়াল (একক)")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{tx("Name (Bengali)", "নাম (বাংলা)")}</Label>
                    <Input value={form.name_bn} onChange={(e) => setForm({ ...form, name_bn: e.target.value })} placeholder="মোটর" />
                  </div>
                  <div>
                    <Label>{tx("Name (English)", "নাম (English)")}</Label>
                    <Input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} placeholder="Motor" />
                  </div>
                  <div className="col-span-2 flex items-center justify-between border rounded-md p-3">
                    <div className="text-sm font-medium">{tx("Active", "চালু")}</div>
                    <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>{tx("Cancel", "বাতিল")}</Button>
                  <Button onClick={save} disabled={saving}>{saving ? "…" : tx("Save", "সংরক্ষণ")}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )
        }
      />
      <Card className="p-3 mb-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx("Search code or name…", "কোড বা নাম খুঁজুন…")} />
          </div>
          <Select value={activeFilter} onValueChange={(v: any) => setActiveFilter(v)}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tx("All", "সব")}</SelectItem>
              <SelectItem value="active">{tx("Active", "চালু")}</SelectItem>
              <SelectItem value="inactive">{tx("Inactive", "বন্ধ")}</SelectItem>
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
              <TableHead>{tx("Tracking", "ট্র্যাকিং")}</TableHead>
              <TableHead>{tx("Status", "অবস্থা")}</TableHead>
              <TableHead className="text-right">{tx("Actions", "অ্যাকশন")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.code}</TableCell>
                <TableCell>{r.name_bn || r.name_en}</TableCell>
                <TableCell>
                  <Badge variant={r.tracking_mode === "serial" ? "default" : "secondary"}>
                    {r.tracking_mode === "serial" ? tx("Serial", "সিরিয়াল") : tx("Quantity", "কোয়ান্টিটি")}
                  </Badge>
                </TableCell>
                <TableCell>{r.is_active ? <Badge variant="secondary">{tx("Active", "চালু")}</Badge> : <Badge variant="outline">{tx("Inactive", "বন্ধ")}</Badge>}</TableCell>
                <TableCell className="text-right">
                  {isAdmin && (
                    <div className="inline-flex items-center gap-1 justify-end">
                      <EditButton onClick={() => openEdit(r)} />
                      <DeleteButton onConfirm={() => softDelete(r.id)} />
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!visible.length && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">{tx("No categories yet", "এখনও কোনো ক্যাটাগরি নেই")}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
