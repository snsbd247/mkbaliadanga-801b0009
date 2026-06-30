import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EditButton, DeleteButton } from "@/components/ui/action-icon-button";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageProvider";

type Row = {
  id: string;
  code: string;
  name: string;
  name_en: string | null;
  name_bn: string | null;
  is_active: boolean;
  sort_order: number;
  deleted_at: string | null;
};

const empty: any = { code: "", name: "", name_en: "", name_bn: "", is_active: true, sort_order: 0 };

function LookupTable({ table, title }: { table: "irrigation_season_types" | "land_types"; title: string }) {
  const { tx } = useLang();
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await db
      .from(table as any)
      .select("*")
      .is("deleted_at", null)
      .order("sort_order")
      .order("name");
    setRows((data as any) ?? []);
  }
  useEffect(() => { load(); }, []);

  function openNew() { setForm({ ...empty }); setOpen(true); }
  function openEdit(r: Row) {
    setForm({
      id: r.id,
      code: r.code,
      name: r.name,
      name_en: r.name_en ?? r.name,
      name_bn: r.name_bn ?? "",
      is_active: r.is_active,
      sort_order: r.sort_order,
    });
    setOpen(true);
  }

  async function save() {
    const code = form.code.trim().toLowerCase().replace(/\s+/g, "_");
    const name = (form.name_en?.trim() || form.name?.trim() || form.name_bn?.trim() || "");
    if (!code) return toast.error(tx("Code is required", "কোড আবশ্যক"));
    if (!/^[a-z0-9_]+$/.test(code)) return toast.error(tx("Code may only contain lowercase letters, numbers and underscore", "কোডে শুধু ছোট হাতের অক্ষর, সংখ্যা ও আন্ডারস্কোর ব্যবহার করা যাবে"));
    if (!name) return toast.error(tx("Enter an English or Bangla name", "ইংরেজি বা বাংলা নাম দিন"));
    const dup = rows.find((r) => r.code?.toLowerCase() === code && r.id !== form.id);
    if (dup) return toast.error(tx(`Code "${code}" already exists`, `"${code}" কোড আগে থেকেই আছে`));
    setBusy(true);
    try {
      const payload = {
        code,
        name,
        name_en: form.name_en?.trim() || name,
        name_bn: form.name_bn?.trim() || null,
        is_active: form.is_active,
        sort_order: Number(form.sort_order) || 0,
      };
      const { error } = form.id
        ? await db.from(table as any).update(payload).eq("id", form.id)
        : await db.from(table as any).insert(payload);
      if (error) throw error;
      toast.success(tx("Saved", "সংরক্ষিত"));
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.message || tx("Save failed", "সংরক্ষণ ব্যর্থ হয়েছে"));
    } finally { setBusy(false); }
  }

  async function softDelete(id: string) {
    const { error } = await db.from(table as any).delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(tx("Deleted", "মুছে ফেলা হয়েছে"));
    load();
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">{title}</h3>
          <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> {tx("New", "নতুন")}</Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tx("Code", "কোড")}</TableHead>
              <TableHead>{tx("Name (EN)", "নাম (EN)")}</TableHead>
              <TableHead>{tx("Bangla", "বাংলা")}</TableHead>
              <TableHead className="text-right">{tx("Order", "ক্রম")}</TableHead>
              <TableHead>{tx("Status", "স্ট্যাটাস")}</TableHead>
              <TableHead className="text-right">{tx("Actions", "কাজ")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.code}</TableCell>
                <TableCell>{r.name_en ?? r.name}</TableCell>
                <TableCell>{r.name_bn ?? "—"}</TableCell>
                <TableCell className="text-right">{r.sort_order}</TableCell>
                <TableCell>
                  <Badge variant={r.is_active ? "default" : "secondary"}>{r.is_active ? tx("Active", "সক্রিয়") : tx("Inactive", "নিষ্ক্রিয়")}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex gap-1 justify-end">
                    <EditButton onClick={() => openEdit(r)} />
                    <DeleteButton onConfirm={() => softDelete(r.id)} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">{tx("No data", "কোনো ডেটা নেই")}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{form.id ? tx("Edit", "সম্পাদনা") : tx("New", "নতুন")} — {title}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3">
              <div>
                <Label>{tx("Code (slug, unique)", "কোড (slug, ইউনিক)")}</Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="boro / pukur / doba" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{tx("Name (English)", "নাম (English)")}</Label>
                  <Input value={form.name_en ?? ""} onChange={(e) => setForm({ ...form, name_en: e.target.value, name: form.name || e.target.value })} />
                </div>
                <div>
                  <Label>{tx("Bangla name", "বাংলা নাম")}</Label>
                  <Input value={form.name_bn ?? ""} onChange={(e) => setForm({ ...form, name_bn: e.target.value, name: form.name || e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{tx("Order", "ক্রম")}</Label>
                  <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: +e.target.value })} />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} id={`active-${table}`} />
                  <Label htmlFor={`active-${table}`}>{tx("Active", "সক্রিয়")}</Label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>{tx("Cancel", "বাতিল")}</Button>
              <Button onClick={save} disabled={busy}>{busy ? "…" : tx("Save", "সংরক্ষণ")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

export default function IrrigationSettings() {
  const { tx } = useLang();
  useEffect(() => { document.title = tx("Irrigation Settings — Admin", "সেচ সেটিংস — Admin"); }, [tx]);
  return (
    <>
      <PageHeader title={tx("Irrigation Settings", "সেচ সেটিংস")} description={tx("Manage season types and land types", "সিজন টাইপ ও জমির ধরন ব্যবস্থাপনা")} />
      <Tabs defaultValue="season">
        <TabsList>
          <TabsTrigger value="season">{tx("Season type", "সিজন টাইপ")}</TabsTrigger>
          <TabsTrigger value="land">{tx("Land type", "জমির ধরন")}</TabsTrigger>
        </TabsList>
        <TabsContent value="season"><LookupTable table="irrigation_season_types" title={tx("Season types", "সিজনের ধরন")} /></TabsContent>
        <TabsContent value="land"><LookupTable table="land_types" title={tx("Land types", "জমির ধরন")} /></TabsContent>
      </Tabs>
    </>
  );
}
