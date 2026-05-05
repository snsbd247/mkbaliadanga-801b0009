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
import { Switch } from "@/components/ui/switch";
import { Plus, Sparkles } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { money, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { FarmerSearchSelect } from "@/components/farmers/FarmerSearchSelect";

export default function Irrigation() {
  const { t } = useLang();
  const { user, isSuper } = useAuth();
  const [showDeleted, setShowDeleted] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [lands, setLands] = useState<any[]>([]);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ farmer_id: "", land_id: "", season_id: "", basis: "per_size", rate: 0, quantity: 0, base_charge: 0, canal_charge: 0, maintenance_charge: 0, other_charge: 0, paid_amount: 0, entry_date: new Date().toISOString().slice(0, 10) });
  const [rateAvailable, setRateAvailable] = useState<boolean | null>(null);

  const [prevDue, setPrevDue] = useState<number>(0);
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => { document.title = `${t("irrigation")} — ${t("appName")}`; load(); }, [showDeleted]);
  useEffect(() => { if (form.farmer_id) supabase.from("lands").select("id,dag_no,land_size").eq("farmer_id", form.farmer_id).then(r => setLands(r.data ?? [])); else setLands([]); }, [form.farmer_id]);
  // Auto-fill quantity from land size when basis = per_size
  useEffect(() => {
    if (form.basis !== "per_size" || !form.land_id) return;
    const ld = lands.find((l: any) => l.id === form.land_id);
    if (ld && Number(ld.land_size) > 0) setForm((f: any) => ({ ...f, quantity: Number(ld.land_size) }));
  }, [form.land_id, form.basis, lands]);
  // Auto-calc base_charge = rate × quantity whenever rate or qty change
  useEffect(() => {
    const calc = +(Number(form.rate || 0) * Number(form.quantity || 0)).toFixed(2);
    setForm((f: any) => f.base_charge === calc ? f : { ...f, base_charge: calc });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.rate, form.quantity]);
  // Auto-fill rate + extra charges from irrigation_rates table when season+basis change
  useEffect(() => {
    (async () => {
      if (!form.season_id) return;
      const { data } = await supabase
        .from("irrigation_rates")
        .select("base_rate,canal_charge,maintenance_charge,other_charge,basis")
        .eq("season_id", form.season_id)
        .eq("basis", form.basis)
        .eq("is_active", true)
        .maybeSingle();
      if (!data) return;
      setForm((f: any) => ({
        ...f,
        rate: Number(data.base_rate) || f.rate,
        canal_charge: Number(data.canal_charge) || 0,
        maintenance_charge: Number(data.maintenance_charge) || 0,
        other_charge: Number(data.other_charge) || 0,
      }));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.season_id, form.basis]);
  useEffect(() => {
    (async () => {
      if (!form.farmer_id || !form.land_id) { setPrevDue(0); return; }
      const { data } = await supabase
        .from("irrigation_charges")
        .select("due_amount, season_id")
        .eq("farmer_id", form.farmer_id)
        .eq("land_id", form.land_id);
      const sum = (data ?? [])
        .filter((r: any) => !form.season_id || r.season_id !== form.season_id)
        .reduce((a: number, r: any) => a + Number(r.due_amount || 0), 0);
      setPrevDue(sum);
    })();
  }, [form.farmer_id, form.land_id, form.season_id]);

  async function load() {
    let q = supabase.from("irrigation_charges").select("*, farmers(name_en,farmer_code,account_number), lands(dag_no), seasons(name)").order("entry_date", { ascending: false }).limit(200);
    q = showDeleted ? q.not("deleted_at", "is", null) : q.is("deleted_at", null);
    const [r, s] = await Promise.all([
      q,
      supabase.from("seasons").select("*").order("year", { ascending: false }),
    ]);
    setRows(r.data ?? []); setSeasons(s.data ?? []);
  }
  async function restore(id: string) {
    const { error } = await supabase.from("irrigation_charges").update({ deleted_at: null } as any).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Restored"); load();
  }

  const total = +form.base_charge + +form.canal_charge + +form.maintenance_charge + +form.other_charge;

  // Inline validation
  const errors: Record<string, string> = {};
  if (open) {
    if (!form.farmer_id) errors.farmer_id = "Select a farmer";
    if (!form.land_id) errors.land_id = "Select a land";
    if (!form.season_id) errors.season_id = "Select a season";
    if (!(Number(form.rate) > 0)) errors.rate = "Rate must be greater than 0";
    if (!(Number(form.quantity) > 0)) errors.quantity = "Quantity must be greater than 0";
    if (Number(form.canal_charge) < 0) errors.canal_charge = "Cannot be negative";
    if (Number(form.maintenance_charge) < 0) errors.maintenance_charge = "Cannot be negative";
    if (Number(form.other_charge) < 0) errors.other_charge = "Cannot be negative";
    if (Number(form.paid_amount) < 0) errors.paid_amount = "Cannot be negative";
    if (Number(form.paid_amount) > total + prevDue) errors.paid_amount = "Paid cannot exceed total";
  }
  const hasErrors = Object.keys(errors).length > 0;

  async function save() {
    if (hasErrors) return toast.error("Please fix the highlighted errors");
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

  const [genSeason, setGenSeason] = useState<string>("");
  const [genBasis, setGenBasis] = useState<string>("per_size");
  const [genOpen, setGenOpen] = useState(false);
  const [genBusy, setGenBusy] = useState(false);

  async function generateForSeason() {
    if (!genSeason) return toast.error("Select a season");
    setGenBusy(true);
    try {
      const { data: rate, error: rateErr } = await supabase
        .from("irrigation_rates")
        .select("base_rate,canal_charge,maintenance_charge,other_charge,office_id")
        .eq("season_id", genSeason)
        .eq("basis", genBasis as any)
        .eq("is_active", true)
        .maybeSingle();
      if (rateErr) throw rateErr;
      if (!rate) throw new Error("No active rate found for this season+basis. Add one in Irrigation Rates.");

      const { data: lands, error: landsErr } = await supabase
        .from("lands")
        .select("id, farmer_id, land_size, office_id");
      if (landsErr) throw landsErr;
      if (!lands?.length) throw new Error("No lands found.");

      const { data: existing } = await supabase
        .from("irrigation_charges")
        .select("land_id")
        .eq("season_id", genSeason);
      const skip = new Set((existing ?? []).map((r: any) => r.land_id));

      const today = new Date().toISOString().slice(0, 10);
      const rows = lands.filter((l: any) => !skip.has(l.id) && Number(l.land_size) > 0).map((l: any) => {
        const qty = Number(l.land_size);
        const base = +(qty * Number(rate.base_rate || 0)).toFixed(2);
        return {
          farmer_id: l.farmer_id,
          land_id: l.id,
          office_id: l.office_id ?? rate.office_id ?? null,
          season_id: genSeason,
          basis: genBasis as any,
          quantity: qty,
          base_charge: base,
          canal_charge: Number(rate.canal_charge || 0),
          maintenance_charge: Number(rate.maintenance_charge || 0),
          other_charge: Number(rate.other_charge || 0),
          paid_amount: 0,
          entry_date: today,
          created_by: user?.id,
          note: "Auto-generated for season",
        };
      });

      if (!rows.length) {
        toast.info(`All ${lands.length} lands already have charges for this season.`);
      } else {
        // Chunk to avoid payload limits
        const SIZE = 200;
        for (let i = 0; i < rows.length; i += SIZE) {
          const { error } = await supabase.from("irrigation_charges").insert(rows.slice(i, i + SIZE));
          if (error) throw error;
        }
        toast.success(`Generated ${rows.length} irrigation charges (skipped ${skip.size} existing).`);
      }
      setGenOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGenBusy(false);
    }
  }

  return (
    <>
      <PageHeader title={t("irrigation")} actions={
        <div className="flex gap-2">
        <Dialog open={genOpen} onOpenChange={setGenOpen}>
          <DialogTrigger asChild>
            <Button variant="outline"><Sparkles className="h-4 w-4 mr-1" />Generate for Season</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Generate Irrigation Charges</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Season</Label>
                <Select value={genSeason} onValueChange={setGenSeason}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{seasons.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Basis</Label>
                <Select value={genBasis} onValueChange={setGenBasis}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="per_size">Per land size</SelectItem>
                    <SelectItem value="per_day">Per day</SelectItem>
                    <SelectItem value="per_hour">Per hour</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Creates one charge per land (skips lands already charged for this season). Uses the active rate from Irrigation Rates × land size.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setGenOpen(false)}>{t("cancel")}</Button>
              <Button onClick={generateForSeason} disabled={genBusy || !genSeason}>{genBusy ? "Generating..." : "Generate"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />{t("addEntry")}</Button></DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>{t("irrigation")} — {t("addEntry")}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>{t("selectFarmer")}</Label>
                <FarmerSearchSelect value={form.farmer_id || null}
                  onChange={(id) => setForm({ ...form, farmer_id: id ?? "", land_id: "" })}
                  placeholder="Search farmer (name / ID / mobile)" />
              </div>
              <div><Label>{t("lands")}</Label>
                <Select value={form.land_id} onValueChange={v => setForm({ ...form, land_id: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{lands.map(l => <SelectItem key={l.id} value={l.id}>Dag {l.dag_no} ({l.land_size} শতক)</SelectItem>)}</SelectContent>
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
              <div>
                <Label>{form.basis === "per_size" ? `${t("quantity")} (শতক — auto from land)` : form.basis === "per_day" ? `${t("quantity")} (days)` : `${t("quantity")} (hours)`}</Label>
                <Input type="number" step="0.01" min="0.01" value={form.quantity} onChange={e => setForm({ ...form, quantity: +e.target.value })} aria-invalid={!!errors.quantity} className={errors.quantity ? "border-destructive" : ""} />
                {errors.quantity && <p className="text-xs text-destructive mt-1">{errors.quantity}</p>}
              </div>
              <div>
                <Label>Rate / unit</Label>
                <Input type="number" step="0.01" min="0.01" value={form.rate} onChange={e => setForm({ ...form, rate: +e.target.value })} aria-invalid={!!errors.rate} className={errors.rate ? "border-destructive" : ""} />
                {errors.rate && <p className="text-xs text-destructive mt-1">{errors.rate}</p>}
              </div>
              <div className="col-span-2"><Label>{t("baseCharge")} (= rate × qty)</Label><Input type="number" value={form.base_charge} readOnly className="bg-muted font-semibold" /></div>
              {/* Canal / Maintenance / Other charges hidden — kept at 0 by default */}
              <div>
                <Label>{t("paidAmount")}</Label>
                <Input type="number" min="0" value={form.paid_amount} onChange={e => setForm({ ...form, paid_amount: +e.target.value })} className={errors.paid_amount ? "border-destructive" : ""} />
                {errors.paid_amount && <p className="text-xs text-destructive mt-1">{errors.paid_amount}</p>}
              </div>
              <div><Label>{t("date")}</Label><Input type="date" value={form.entry_date} onChange={e => setForm({ ...form, entry_date: e.target.value })} /></div>
              <div className="col-span-2 rounded-md border border-dashed p-2 text-sm flex justify-between">
                <span className="text-muted-foreground">{t("previousDue") || "Previous due (auto)"}</span>
                <span className={prevDue > 0 ? "due-text font-semibold" : "font-semibold"}>{money(prevDue)}</span>
              </div>
              <div className="col-span-2 rounded-md bg-muted p-2 text-sm flex justify-between"><span>{t("total")}</span><span className="font-bold">{money(total + prevDue)}</span></div>
            </div>
            <DialogFooter>
              {hasErrors && <span className="text-xs text-destructive mr-auto self-center">Please fix {Object.keys(errors).length} error(s)</span>}
              <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
              <Button onClick={save} disabled={hasErrors}>{t("save")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      } />
      <Card className="p-3 mb-3 flex items-center gap-3">
        <Label className="text-sm flex items-center gap-2 cursor-pointer">
          <Switch checked={showDeleted} onCheckedChange={setShowDeleted} />
          Show archived
        </Label>
        {showDeleted && <span className="text-xs text-muted-foreground">Showing soft-deleted charges only.</span>}
      </Card>
      <Card><Table>
        <TableHeader><TableRow>
          <TableHead>{t("date")}</TableHead><TableHead>{t("farmerName")}</TableHead>
          <TableHead>{t("season")}</TableHead><TableHead>{t("dagNo")}</TableHead>
          <TableHead>{t("total")}</TableHead><TableHead>{t("paidAmount")}</TableHead><TableHead>{t("dueAmount")}</TableHead>
          {showDeleted && <TableHead className="text-right">Actions</TableHead>}
        </TableRow></TableHeader>
        <TableBody>
          {rows.map(r => (
            <TableRow key={r.id}>
              <TableCell>{fmtDate(r.entry_date)}</TableCell>
              <TableCell>{r.farmers?.name_en} <span className="text-xs text-muted-foreground">({r.farmers?.account_number ?? r.farmers?.farmer_code})</span></TableCell>
              <TableCell>{r.seasons?.name}</TableCell>
              <TableCell>{r.lands?.dag_no}</TableCell>
              <TableCell>{money(r.total)}</TableCell>
              <TableCell>{money(r.paid_amount)}</TableCell>
              <TableCell className={r.due_amount > 0 ? "due-text" : ""}>{money(r.due_amount)}</TableCell>
              {showDeleted && (
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => restore(r.id)}>Restore</Button>
                </TableCell>
              )}
            </TableRow>
          ))}
          {rows.length === 0 && <TableRow><TableCell colSpan={showDeleted ? 8 : 7} className="text-center text-muted-foreground py-6">{t("noData")}</TableCell></TableRow>}
        </TableBody>
      </Table></Card>
    </>
  );
}
