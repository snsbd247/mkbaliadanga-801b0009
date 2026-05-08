import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { DeleteButton } from "@/components/ui/action-icon-button";

export default function Seasons() {
  const { t } = useLang();
  const { isAdmin } = useAuth();
  const [list, setList] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ year: new Date().getFullYear(), type: "boro", name: "" });

  useEffect(() => { document.title = `${t("seasons")} — ${t("appName")}`; load(); }, []);
  async function load() {
    const { data } = await supabase.from("seasons").select("*").order("year", { ascending: false });
    setList(data ?? []);
  }
  async function save() {
    const payload = { year: form.year, type: form.type as any, name: form.name || `${t(form.type as any)} ${form.year}` };
    const { error } = await supabase.from("seasons").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(t("saved")); setOpen(false); load();
  }
  async function del(id: string) {
    if (!confirm(t("confirmDelete"))) return;
    const { error } = await supabase.from("seasons").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  return (
    <>
      <PageHeader title={t("seasons")} actions={isAdmin && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />{t("addNew")}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("addNew")} — {t("seasons")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>{t("year")}</Label><Input type="number" value={form.year} onChange={e => setForm({ ...form, year: +e.target.value })} /></div>
              <div><Label>{t("season")}</Label>
                <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aman">{t("aman")}</SelectItem>
                    <SelectItem value="boro">{t("boro")}</SelectItem>
                    <SelectItem value="iri">{t("iri")}</SelectItem>
                    <SelectItem value="other">{t("other")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>{t("name")}</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="optional" /></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button><Button onClick={save}>{t("save")}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )} />
      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>{t("year")}</TableHead><TableHead>{t("season")}</TableHead><TableHead>{t("name")}</TableHead><TableHead className="text-right">{t("actions")}</TableHead></TableRow></TableHeader>
          <TableBody>
            {list.map(s => (
              <TableRow key={s.id}>
                <TableCell>{s.year}</TableCell><TableCell>{t(s.type as any)}</TableCell><TableCell>{s.name}</TableCell>
                <TableCell className="text-right">{isAdmin && <DeleteButton onClick={() => del(s.id)} />}</TableCell>
              </TableRow>
            ))}
            {list.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{t("noData")}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
