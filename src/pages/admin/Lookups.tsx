import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { toast } from "sonner";

type Row = {
  id: string;
  code: string;
  name: string;
  name_bn: string | null;
  is_active: boolean;
  sort_order: number;
};

const empty: Omit<Row, "id"> & { id?: string } = {
  code: "",
  name: "",
  name_bn: "",
  is_active: true,
  sort_order: 0,
};

function LookupTable({ table, title }: { table: "season_types" | "field_types"; title: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<typeof empty>(empty);
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await supabase.from(table as any).select("*").order("sort_order").order("name");
    setRows((data as any) ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  function openNew() {
    setForm({ ...empty });
    setOpen(true);
  }
  function openEdit(r: Row) {
    setForm({ id: r.id, code: r.code, name: r.name, name_bn: r.name_bn ?? "", is_active: r.is_active, sort_order: r.sort_order });
    setOpen(true);
  }

  async function save() {
    if (!form.code.trim() || !form.name.trim()) return toast.error("কোড ও নাম দিন");
    setBusy(true);
    try {
      const payload = {
        code: form.code.trim().toLowerCase().replace(/\s+/g, "_"),
        name: form.name.trim(),
        name_bn: form.name_bn?.trim() || null,
        is_active: form.is_active,
        sort_order: Number(form.sort_order) || 0,
      };
      const { error } = form.id
        ? await supabase.from(table as any).update(payload).eq("id", form.id)
        : await supabase.from(table as any).insert(payload);
      if (error) throw error;
      toast.success("সংরক্ষিত");
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function del(id: string) {
    const { error } = await supabase.from(table as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">{title}</h3>
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" /> নতুন
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>কোড</TableHead>
              <TableHead>নাম</TableHead>
              <TableHead>বাংলা</TableHead>
              <TableHead className="text-right">ক্রম</TableHead>
              <TableHead>সক্রিয়</TableHead>
              <TableHead className="text-right">কাজ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.code}</TableCell>
                <TableCell>{r.name}</TableCell>
                <TableCell>{r.name_bn ?? "—"}</TableCell>
                <TableCell className="text-right">{r.sort_order}</TableCell>
                <TableCell>{r.is_active ? "✓" : "—"}</TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex gap-1 justify-end">
                    <EditButton onClick={() => openEdit(r)} />
                    <DeleteButton onConfirm={() => del(r.id)} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  কোনো ডেটা নেই
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{form.id ? "সম্পাদনা" : "নতুন"} — {title}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3">
              <div>
                <Label>কোড (slug, ইউনিক)</Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="boro / pukur / doba" />
              </div>
              <div>
                <Label>নাম</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>বাংলা নাম</Label>
                <Input value={form.name_bn ?? ""} onChange={(e) => setForm({ ...form, name_bn: e.target.value })} />
              </div>
              <div>
                <Label>ক্রম</Label>
                <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: +e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} id={`active-${table}`} />
                <Label htmlFor={`active-${table}`}>সক্রিয়</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>বাতিল</Button>
              <Button onClick={save} disabled={busy}>{busy ? "…" : "সংরক্ষণ"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

export default function AdminLookups() {
  useEffect(() => { document.title = "Lookups — Admin"; }, []);
  return (
    <>
      <PageHeader title="সিজন ও জমির ধরন" description="সিজন টাইপ ও জমির ধরন ব্যবস্থাপনা" />
      <Tabs defaultValue="season">
        <TabsList>
          <TabsTrigger value="season">সিজন টাইপ</TabsTrigger>
          <TabsTrigger value="field">জমির ধরন</TabsTrigger>
        </TabsList>
        <TabsContent value="season"><LookupTable table="season_types" title="সিজনের ধরন" /></TabsContent>
        <TabsContent value="field"><LookupTable table="field_types" title="জমির ধরন" /></TabsContent>
      </Tabs>
    </>
  );
}
