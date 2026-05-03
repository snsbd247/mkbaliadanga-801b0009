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
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { useAuth } from "@/auth/AuthProvider";
import { toast } from "sonner";
import { money } from "@/lib/format";

type Row = {
  id: string;
  office_id: string;
  season_id: string;
  basis: "per_size" | "per_day" | "per_hour";
  base_rate: number;
  canal_charge: number;
  maintenance_charge: number;
  other_charge: number;
  is_active: boolean;
  note: string | null;
  seasons?: { name: string | null; year: number | null; type: string | null };
};

const empty = {
  id: "",
  season_id: "",
  basis: "per_size" as const,
  base_rate: 0,
  canal_charge: 0,
  maintenance_charge: 0,
  other_charge: 0,
  is_active: true,
  note: "",
};

export default function IrrigationRates() {
  const { t } = useLang();
  const { isAdmin, officeId, user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<typeof empty & { id: string }>(empty);

  useEffect(() => {
    document.title = `Irrigation Rates — ${t("appName")}`;
    load();
  }, []);

  async function load() {
    const [r, s] = await Promise.all([
      supabase
        .from("irrigation_rates")
        .select("*, seasons(name,year,type)")
        .order("created_at", { ascending: false }),
      supabase.from("seasons").select("*").order("year", { ascending: false }),
    ]);
    setRows((r.data as any) ?? []);
    setSeasons(s.data ?? []);
  }

  function openNew() {
    setForm(empty);
    setOpen(true);
  }
  function openEdit(r: Row) {
    setForm({
      id: r.id,
      season_id: r.season_id,
      basis: r.basis,
      base_rate: Number(r.base_rate),
      canal_charge: Number(r.canal_charge),
      maintenance_charge: Number(r.maintenance_charge),
      other_charge: Number(r.other_charge),
      is_active: r.is_active,
      note: r.note ?? "",
    });
    setOpen(true);
  }

  async function save() {
    if (saving) return;
    if (!form.season_id) return toast.error("Select a season");
    if (!(Number(form.base_rate) > 0)) return toast.error("Base rate must be > 0");
    setSaving(true);
    try {
      const payload = {
        office_id: officeId,
        season_id: form.season_id,
        basis: form.basis,
        base_rate: Number(form.base_rate),
        canal_charge: Number(form.canal_charge),
        maintenance_charge: Number(form.maintenance_charge),
        other_charge: Number(form.other_charge),
        is_active: form.is_active,
        note: form.note || null,
        created_by: user?.id,
      };
      const { error } = form.id
        ? await supabase.from("irrigation_rates").update(payload).eq("id", form.id)
        : await supabase.from("irrigation_rates").insert(payload);
      if (error) throw error;
      toast.success(t("saved"));
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function del(id: string) {
    if (!confirm(t("confirmDelete"))) return;
    const { error } = await supabase.from("irrigation_rates").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  return (
    <>
      <PageHeader
        title="Irrigation Rates"
        actions={
          isAdmin && (
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty); }}>
              <DialogTrigger asChild>
                <Button onClick={openNew}>
                  <Plus className="h-4 w-4 mr-1" />
                  {t("addNew")}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>
                    {form.id ? t("edit") : t("addNew")} — Irrigation Rate
                  </DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label>{t("season")}</Label>
                    <Select
                      value={form.season_id}
                      onValueChange={(v) => setForm({ ...form, season_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        {seasons.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name || `${s.type} ${s.year}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t("basis")}</Label>
                    <Select
                      value={form.basis}
                      onValueChange={(v: any) => setForm({ ...form, basis: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="per_size">{t("perSize")}</SelectItem>
                        <SelectItem value="per_day">{t("perDay")}</SelectItem>
                        <SelectItem value="per_hour">{t("perHour")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Base rate / unit</Label>
                    <Input type="number" min="0" step="0.01" value={form.base_rate}
                      onChange={(e) => setForm({ ...form, base_rate: +e.target.value })} />
                  </div>
                  <div>
                    <Label>{t("canalCharge")}</Label>
                    <Input type="number" min="0" step="0.01" value={form.canal_charge}
                      onChange={(e) => setForm({ ...form, canal_charge: +e.target.value })} />
                  </div>
                  <div>
                    <Label>{t("maintenanceCharge")}</Label>
                    <Input type="number" min="0" step="0.01" value={form.maintenance_charge}
                      onChange={(e) => setForm({ ...form, maintenance_charge: +e.target.value })} />
                  </div>
                  <div className="col-span-2">
                    <Label>{t("otherCharge")}</Label>
                    <Input type="number" min="0" step="0.01" value={form.other_charge}
                      onChange={(e) => setForm({ ...form, other_charge: +e.target.value })} />
                  </div>
                  <div className="col-span-2">
                    <Label>{t("note")}</Label>
                    <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>{t("cancel")}</Button>
                  <Button onClick={save} disabled={saving}>{saving ? "…" : t("save")}</Button>
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
              <TableHead>{t("season")}</TableHead>
              <TableHead>{t("basis")}</TableHead>
              <TableHead className="text-right">Base</TableHead>
              <TableHead className="text-right">{t("canalCharge")}</TableHead>
              <TableHead className="text-right">{t("maintenanceCharge")}</TableHead>
              <TableHead className="text-right">{t("otherCharge")}</TableHead>
              <TableHead className="text-right">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.seasons?.name || `${r.seasons?.type} ${r.seasons?.year}`}</TableCell>
                <TableCell>{t(r.basis as any)}</TableCell>
                <TableCell className="text-right">{money(Number(r.base_rate))}</TableCell>
                <TableCell className="text-right">{money(Number(r.canal_charge))}</TableCell>
                <TableCell className="text-right">{money(Number(r.maintenance_charge))}</TableCell>
                <TableCell className="text-right">{money(Number(r.other_charge))}</TableCell>
                <TableCell className="text-right">
                  {isAdmin && (
                    <>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => del(r.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  {t("noData")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
