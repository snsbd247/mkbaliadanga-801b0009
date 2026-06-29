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
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { useLang } from "@/i18n/LanguageProvider";
import { logAudit } from "@/lib/audit";

type Row = {
  id: string;
  office_id: string | null;
  code: string;
  name_bn: string | null;
  name_en: string | null;
  calculation_basis: "per_shotok" | "per_bigha" | "flat" | "custom";
  allow_manual_negotiation: boolean;
  is_active: boolean;
  deleted_at: string | null;
};

const empty = {
  id: "",
  code: "",
  name_bn: "",
  name_en: "",
  calculation_basis: "per_shotok" as Row["calculation_basis"],
  allow_manual_negotiation: false,
  is_active: true,
};

export default function IrrigationCategories() {
  const { tx } = useLang();
  const { isAdmin, officeId } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(empty);

  useEffect(() => {
    document.title = tx("Irrigation Categories", "সেচ ক্যাটাগরি");
    load();
  }, []);

  async function load() {
    const { data, error } = await db
      .from("irrigation_categories" as any)
      .select("*")
      .is("deleted_at", null)
      .order("code");
    if (error) return toast.error(error.message);
    setRows((data as any) ?? []);
  }

  function openNew() { setForm(empty); setOpen(true); }
  function openEdit(r: Row) {
    setForm({
      id: r.id,
      code: r.code,
      name_bn: r.name_bn ?? "",
      name_en: r.name_en ?? "",
      calculation_basis: r.calculation_basis,
      allow_manual_negotiation: r.allow_manual_negotiation,
      is_active: r.is_active,
    });
    setOpen(true);
  }

  async function save() {
    if (!form.code.trim()) return toast.error(tx("Code required", "কোড দরকার"));
    if (!form.name_bn.trim() && !form.name_en.trim()) return toast.error(tx("Name required", "নাম দরকার"));
    setSaving(true);
    try {
      const payload: any = {
        office_id: officeId,
        code: form.code.trim(),
        name_bn: form.name_bn.trim() || null,
        name_en: form.name_en.trim() || null,
        calculation_basis: form.calculation_basis,
        allow_manual_negotiation: form.allow_manual_negotiation,
        is_active: form.is_active,
      };
      let error: any;
      if (form.id) {
        ({ error } = await db.from("irrigation_categories" as any).update(payload).eq("id", form.id));
      } else {
        ({ error } = await db.from("irrigation_categories" as any).insert(payload));
      }
      if (error) throw error;
      await logAudit({
        office_id: officeId,
        module: "irrigation_invoice",
        action_type: form.id ? "update" : "create",
        reference_id: form.id || null,
        new_data: payload,
      });
      toast.success(tx("Saved", "সংরক্ষিত"));
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function softDelete(id: string) {
    const { error } = await db
      .from("irrigation_categories" as any)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    await logAudit({ office_id: officeId, module: "irrigation_invoice", action_type: "delete", reference_id: id });
    load();
  }

  const basisLabel = (b: Row["calculation_basis"]) =>
    ({ per_shotok: tx("Per shotok", "প্রতি শতক"), per_bigha: tx("Per bigha", "প্রতি বিঘা"), flat: tx("Flat", "ফ্ল্যাট"), custom: tx("Custom", "কাস্টম") }[b]);

  return (
    <>
      <PageHeader
        title={tx("Irrigation Categories", "সেচ ক্যাটাগরি")}
        description={tx(
          "Define irrigation usage categories (e.g. seedling, vegetables, pond) — separate from land types.",
          "সেচ ব্যবহারের ক্যাটাগরি (যেমন: ধানের চারা, সবজি, পুকুর) — জমির ধরন থেকে আলাদা।",
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
                    <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="seedling" />
                  </div>
                  <div>
                    <Label>{tx("Calculation basis", "হিসাবের ভিত্তি")}</Label>
                    <Select value={form.calculation_basis} onValueChange={(v: any) => setForm({ ...form, calculation_basis: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="per_shotok">{tx("Per shotok", "প্রতি শতক")}</SelectItem>
                        <SelectItem value="per_bigha">{tx("Per bigha", "প্রতি বিঘা")}</SelectItem>
                        <SelectItem value="flat">{tx("Flat", "ফ্ল্যাট")}</SelectItem>
                        <SelectItem value="custom">{tx("Custom", "কাস্টম")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{tx("Name (Bengali)", "নাম (বাংলা)")}</Label>
                    <Input value={form.name_bn} onChange={(e) => setForm({ ...form, name_bn: e.target.value })} placeholder="ধানের চারা" />
                  </div>
                  <div>
                    <Label>{tx("Name (English)", "নাম (English)")}</Label>
                    <Input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} placeholder="Seedling" />
                  </div>
                  <div className="col-span-2 flex items-center justify-between border rounded-md p-3">
                    <div>
                      <div className="text-sm font-medium">{tx("Allow manual negotiation", "ম্যানুয়াল আলোচনা অনুমতি")}</div>
                      <div className="text-xs text-muted-foreground">{tx("Lets staff override the rate per invoice with a reason.", "প্রতি ইনভয়েসে কারণ সহ রেট ওভাররাইড করার সুযোগ দেয়।")}</div>
                    </div>
                    <Switch checked={form.allow_manual_negotiation} onCheckedChange={(v) => setForm({ ...form, allow_manual_negotiation: v })} />
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
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tx("Code", "কোড")}</TableHead>
              <TableHead>{tx("Name", "নাম")}</TableHead>
              <TableHead>{tx("Basis", "ভিত্তি")}</TableHead>
              <TableHead>{tx("Negotiable", "নেগোশিয়েবল")}</TableHead>
              <TableHead>{tx("Status", "অবস্থা")}</TableHead>
              <TableHead className="text-right">{tx("Actions", "অ্যাকশন")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.code}</TableCell>
                <TableCell>{r.name_bn || r.name_en}</TableCell>
                <TableCell>{basisLabel(r.calculation_basis)}</TableCell>
                <TableCell>{r.allow_manual_negotiation ? <Badge>{tx("Yes", "হ্যাঁ")}</Badge> : <span className="text-muted-foreground text-xs">—</span>}</TableCell>
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
            {!rows.length && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">{tx("No categories yet", "এখনও কোনো ক্যাটাগরি নেই")}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
