import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { FarmerSearchSelect } from "@/components/farmers/FarmerSearchSelect";

interface Props { farmerId: string; }

export function LandRelations({ farmerId }: Props) {
  const { t } = useLang();
  const { user, isAdmin } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [lands, setLands] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    land_id: "", owner_farmer_id: farmerId, sharecropper_farmer_id: "",
    share_percentage: 50, valid_from: new Date().toISOString().slice(0, 10), note: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, [farmerId]);

  function resetForm() {
    setForm({ land_id: "", owner_farmer_id: farmerId, sharecropper_farmer_id: "", share_percentage: 50, valid_from: new Date().toISOString().slice(0, 10), note: "" });
  }

  async function load() {
    const [rels, ld] = await Promise.all([
      supabase.from("land_relations")
        .select("*, lands(dag_no,mouza,land_size), owner:farmers!land_relations_owner_farmer_id_fkey(name_en,farmer_code,account_number), sc:farmers!land_relations_sharecropper_farmer_id_fkey(name_en,farmer_code,account_number)")
        .or(`owner_farmer_id.eq.${farmerId},sharecropper_farmer_id.eq.${farmerId}`)
        .order("valid_from", { ascending: false }),
      supabase.from("lands").select("id,dag_no,mouza,land_size,farmer_id").order("created_at"),
    ]);
    setRows(rels.data ?? []);
    setLands(ld.data ?? []);
  }

  async function save() {
    if (!form.land_id || !form.owner_farmer_id) return toast.error("Land and Owner required");
    setSaving(true);
    try {
      const { error } = await supabase.from("land_relations").insert({
        land_id: form.land_id,
        owner_farmer_id: form.owner_farmer_id,
        sharecropper_farmer_id: form.sharecropper_farmer_id || null,
        share_percentage: Number(form.share_percentage),
        valid_from: form.valid_from,
        note: form.note,
        created_by: user?.id,
      });
      if (error) { toast.error(error.message); return; }
      toast.success(t("saved"));
      setOpen(false);
      resetForm();
      load();
    } finally { setSaving(false); }
  }

  async function endRelation(id: string) {
    const { error } = await supabase.from("land_relations").update({ valid_to: new Date().toISOString().slice(0, 10) }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("saved"));
    load();
  }

  return (
    <Card>
      <div className="flex items-center justify-between p-3 border-b">
        <div className="text-sm text-muted-foreground">{t("landRelations")} — owner ↔ sharecropper history</div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />{t("addNew")}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("addNew")} — {t("landRelations")}</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div>
                <Label>{t("owner")} <span className="text-destructive">*</span></Label>
                <FarmerSearchSelect value={form.owner_farmer_id}
                  onChange={(id) => setForm({ ...form, owner_farmer_id: id ?? "", land_id: "" })}
                  placeholder="Search owner farmer (name / ID / mobile)" disabled={saving} />
              </div>
              <div><Label>{t("lands")} <span className="text-destructive">*</span></Label>
                <Select value={form.land_id} onValueChange={v => setForm({ ...form, land_id: v })} disabled={saving || !form.owner_farmer_id}>
                  <SelectTrigger><SelectValue placeholder={form.owner_farmer_id ? "—" : "Select owner first"} /></SelectTrigger>
                  <SelectContent>
                    {lands.filter(l => l.farmer_id === form.owner_farmer_id).map(l => (
                      <SelectItem key={l.id} value={l.id}>Dag {l.dag_no} · {l.mouza} · {l.land_size}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>{t("sharecropper")} <span className="text-xs text-muted-foreground">(optional)</span></Label>
                <FarmerSearchSelect value={form.sharecropper_farmer_id || null}
                  onChange={(id) => setForm({ ...form, sharecropper_farmer_id: id ?? "" })}
                  excludeIds={form.owner_farmer_id ? [form.owner_farmer_id] : []}
                  placeholder="Search sharecropper (optional)" disabled={saving} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t("sharePercent")}</Label><Input type="number" min={0} max={100} step="0.1" disabled={saving} value={form.share_percentage} onChange={e => setForm({ ...form, share_percentage: +e.target.value })} /></div>
                <div><Label>{t("validFrom")}</Label><Input type="date" disabled={saving} value={form.valid_from} onChange={e => setForm({ ...form, valid_from: e.target.value })} /></div>
              </div>
              <div><Label>{t("note")}</Label><Input disabled={saving} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></div>
            </div>
            <DialogFooter><Button variant="outline" disabled={saving} onClick={() => setOpen(false)}>{t("cancel")}</Button><Button onClick={save} disabled={saving}>{saving ? "…" : t("save")}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader><TableRow>
          <TableHead>Land</TableHead>
          <TableHead>{t("owner")}</TableHead>
          <TableHead>{t("sharecropper")}</TableHead>
          <TableHead>{t("sharePercent")}</TableHead>
          <TableHead>{t("validFrom")}</TableHead>
          <TableHead>{t("validTo")}</TableHead>
          <TableHead>{t("status")}</TableHead>
          <TableHead className="text-right">{t("actions")}</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {rows.map(r => {
            const active = !r.valid_to;
            return (
              <TableRow key={r.id}>
                <TableCell>Dag {r.lands?.dag_no} <span className="text-xs text-muted-foreground">({r.lands?.mouza})</span></TableCell>
                <TableCell>{r.owner?.name_en} <span className="text-xs text-muted-foreground">({r.owner?.account_number ?? r.owner?.farmer_code})</span></TableCell>
                <TableCell>{r.sc?.name_en ? <>{r.sc.name_en} <span className="text-xs text-muted-foreground">({r.sc.account_number ?? r.sc.farmer_code})</span></> : <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>{r.share_percentage}%</TableCell>
                <TableCell>{fmtDate(r.valid_from)}</TableCell>
                <TableCell>{r.valid_to ? fmtDate(r.valid_to) : <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell><Badge variant={active ? "default" : "secondary"}>{active ? t("activeRelation") : t("historic")}</Badge></TableCell>
                <TableCell className="text-right">
                  {isAdmin && active && (
                    <Button size="icon" variant="ghost" onClick={() => endRelation(r.id)} title={t("endRelation")}>
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
          {rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">{t("noData")}</TableCell></TableRow>}
        </TableBody>
      </Table>
    </Card>
  );
}
