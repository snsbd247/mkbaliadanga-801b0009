import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { fmtDate } from "@/lib/format";
import { EditButton, DeleteButton } from "@/components/ui/action-icon-button";

export default function Offices() {
  const { t } = useLang();
  const { isSuper } = useAuth();
  const [list, setList] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<{ name: string; registration_no: string; established_on: string; contact: string; address: string; payment_priority: string[] }>({ name: "", registration_no: "", established_on: "", contact: "", address: "", payment_priority: ["irrigation", "loan", "savings"] });

  useEffect(() => { document.title = `${t("offices")} — ${t("appName")}`; load(); }, []);

  async function load() {
    const { data } = await supabase.from("offices").select("*").order("name");
    setList(data ?? []);
  }
  function openNew() { setEditing(null); setForm({ name: "", registration_no: "", established_on: "", contact: "", address: "", payment_priority: ["irrigation", "loan", "savings"] }); setOpen(true); }
  function openEdit(o: any) { setEditing(o); setForm({ name: o.name, registration_no: o.registration_no ?? "", established_on: o.established_on ?? "", contact: o.contact ?? "", address: o.address ?? "", payment_priority: (o.payment_priority?.length ? o.payment_priority : ["irrigation", "loan", "savings"]) }); setOpen(true); }
  function movePriority(idx: number, dir: -1 | 1) {
    const arr = [...form.payment_priority];
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    setForm({ ...form, payment_priority: arr });
  }
  async function save() {
    if (!form.name) return toast.error(t("nameRequired"));
    const payload = { ...form, established_on: form.established_on || null };
    const { error } = editing
      ? await supabase.from("offices").update(payload).eq("id", editing.id)
      : await supabase.from("offices").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(t("saved")); setOpen(false); load();
  }
  async function del(id: string) {
    const { error } = await supabase.from("offices").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  return (
    <>
      <PageHeader title={t("offices")} actions={isSuper && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4 mr-1" />{t("addNew")}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? t("edit") : t("addNew")} — {t("offices")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>{t("name")}</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t("registrationNo")}</Label><Input value={form.registration_no} onChange={e => setForm({ ...form, registration_no: e.target.value })} /></div>
                <div><Label>{t("establishedOn")}</Label><Input type="date" value={form.established_on} onChange={e => setForm({ ...form, established_on: e.target.value })} /></div>
              </div>
              <div><Label>{t("contact")}</Label><Input value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} /></div>
              <div><Label>{t("address")}</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
              <div>
                <Label>{t("paymentAllocationPriority")}</Label>
                <p className="text-xs text-muted-foreground mb-2">{t("autoAllocPriorityHint")}</p>
                <div className="space-y-1">
                  {form.payment_priority.map((p, i) => (
                    <div key={p} className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5">
                      <span className="text-xs font-mono w-6">{i + 1}.</span>
                      <span className="flex-1 capitalize">{p}</span>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => movePriority(i, -1)} disabled={i === 0}>↑</Button>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => movePriority(i, 1)} disabled={i === form.payment_priority.length - 1}>↓</Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button><Button onClick={save}>{t("save")}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )} />
      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t("name")}</TableHead><TableHead>{t("registrationNo")}</TableHead>
            <TableHead>{t("establishedOn")}</TableHead><TableHead>{t("contact")}</TableHead>
            <TableHead>{t("address")}</TableHead>{isSuper && <TableHead className="text-right">{t("actions")}</TableHead>}
          </TableRow></TableHeader>
          <TableBody>
            {list.map(o => (
              <TableRow key={o.id}>
                <TableCell className="font-medium">{o.name}</TableCell>
                <TableCell>{o.registration_no}</TableCell>
                <TableCell>{fmtDate(o.established_on)}</TableCell>
                <TableCell>{o.contact}</TableCell>
                <TableCell>{o.address}</TableCell>
                {isSuper && (
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1">
                      <EditButton onClick={() => openEdit(o)} />
                      <DeleteButton onConfirm={() => del(o.id)} />
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {list.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{t("noData")}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
