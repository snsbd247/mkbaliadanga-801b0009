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
import { Plus } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { money, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";

export default function Irrigation() {
  const { t } = useLang();
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [farmers, setFarmers] = useState<any[]>([]);
  const [lands, setLands] = useState<any[]>([]);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ farmer_id: "", land_id: "", season_id: "", basis: "per_size", quantity: 0, base_charge: 0, canal_charge: 0, maintenance_charge: 0, other_charge: 0, paid_amount: 0, entry_date: new Date().toISOString().slice(0, 10) });

  useEffect(() => { document.title = `${t("irrigation")} — ${t("appName")}`; load(); }, []);
  useEffect(() => { if (form.farmer_id) supabase.from("lands").select("id,dag_no,land_size").eq("farmer_id", form.farmer_id).then(r => setLands(r.data ?? [])); }, [form.farmer_id]);

  async function load() {
    const [r, f, s] = await Promise.all([
      supabase.from("irrigation_charges").select("*, farmers(name_en,farmer_code), lands(dag_no), seasons(name)").order("entry_date", { ascending: false }).limit(200),
      supabase.from("farmers").select("id,name_en,farmer_code").order("name_en"),
      supabase.from("seasons").select("*").order("year", { ascending: false }),
    ]);
    setRows(r.data ?? []); setFarmers(f.data ?? []); setSeasons(s.data ?? []);
  }

  const total = +form.base_charge + +form.canal_charge + +form.maintenance_charge + +form.other_charge;

  async function save() {
    if (!form.farmer_id || !form.land_id || !form.season_id) return toast.error("All fields required");
    const { error } = await supabase.from("irrigation_charges").insert({
      farmer_id: form.farmer_id, land_id: form.land_id, season_id: form.season_id,
      basis: form.basis as any, quantity: form.quantity,
      base_charge: form.base_charge, canal_charge: form.canal_charge,
      maintenance_charge: form.maintenance_charge, other_charge: form.other_charge,
      paid_amount: form.paid_amount, entry_date: form.entry_date, created_by: user?.id,
    });
    if (error) return toast.error(error.message);
    if (form.paid_amount > 0) {
      await supabase.from("payments").insert({ farmer_id: form.farmer_id, kind: "irrigation", amount: form.paid_amount, collected_by: user?.id });
    }
    toast.success(t("saved")); setOpen(false); load();
  }

  return (
    <>
      <PageHeader title={t("irrigation")} actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />{t("addEntry")}</Button></DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>{t("irrigation")} — {t("addEntry")}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>{t("selectFarmer")}</Label>
                <Select value={form.farmer_id} onValueChange={v => setForm({ ...form, farmer_id: v, land_id: "" })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{farmers.map(f => <SelectItem key={f.id} value={f.id}>{f.farmer_code} — {f.name_en}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>{t("lands")}</Label>
                <Select value={form.land_id} onValueChange={v => setForm({ ...form, land_id: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{lands.map(l => <SelectItem key={l.id} value={l.id}>Dag {l.dag_no} ({l.land_size})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>{t("season")}</Label>
                <Select value={form.season_id} onValueChange={v => setForm({ ...form, season_id: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{seasons.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>{t("basis")}</Label>
                <Select value={form.basis} onValueChange={v => setForm({ ...form, basis: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="per_size">{t("perSize")}</SelectItem>
                    <SelectItem value="per_day">{t("perDay")}</SelectItem>
                    <SelectItem value="per_hour">{t("perHour")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>{t("quantity")}</Label><Input type="number" step="0.01" value={form.quantity} onChange={e => setForm({ ...form, quantity: +e.target.value })} /></div>
              <div><Label>{t("baseCharge")}</Label><Input type="number" value={form.base_charge} onChange={e => setForm({ ...form, base_charge: +e.target.value })} /></div>
              <div><Label>{t("canalCharge")}</Label><Input type="number" value={form.canal_charge} onChange={e => setForm({ ...form, canal_charge: +e.target.value })} /></div>
              <div><Label>{t("maintenanceCharge")}</Label><Input type="number" value={form.maintenance_charge} onChange={e => setForm({ ...form, maintenance_charge: +e.target.value })} /></div>
              <div><Label>{t("otherCharge")}</Label><Input type="number" value={form.other_charge} onChange={e => setForm({ ...form, other_charge: +e.target.value })} /></div>
              <div><Label>{t("paidAmount")}</Label><Input type="number" value={form.paid_amount} onChange={e => setForm({ ...form, paid_amount: +e.target.value })} /></div>
              <div><Label>{t("date")}</Label><Input type="date" value={form.entry_date} onChange={e => setForm({ ...form, entry_date: e.target.value })} /></div>
              <div className="col-span-2 rounded-md bg-muted p-2 text-sm flex justify-between"><span>{t("total")}</span><span className="font-bold">{money(total)}</span></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button><Button onClick={save}>{t("save")}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      } />
      <Card><Table>
        <TableHeader><TableRow>
          <TableHead>{t("date")}</TableHead><TableHead>{t("farmerName")}</TableHead>
          <TableHead>{t("season")}</TableHead><TableHead>{t("dagNo")}</TableHead>
          <TableHead>{t("total")}</TableHead><TableHead>{t("paidAmount")}</TableHead><TableHead>{t("dueAmount")}</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {rows.map(r => (
            <TableRow key={r.id}>
              <TableCell>{fmtDate(r.entry_date)}</TableCell>
              <TableCell>{r.farmers?.name_en} <span className="text-xs text-muted-foreground">({r.farmers?.farmer_code})</span></TableCell>
              <TableCell>{r.seasons?.name}</TableCell>
              <TableCell>{r.lands?.dag_no}</TableCell>
              <TableCell>{money(r.total)}</TableCell>
              <TableCell>{money(r.paid_amount)}</TableCell>
              <TableCell className={r.due_amount > 0 ? "due-text" : ""}>{money(r.due_amount)}</TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">{t("noData")}</TableCell></TableRow>}
        </TableBody>
      </Table></Card>
    </>
  );
}
