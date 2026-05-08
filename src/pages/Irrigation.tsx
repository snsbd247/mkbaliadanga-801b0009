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
import { useConfirm } from "@/components/ui/confirm-dialog";

export default function Irrigation() {
  const { t } = useLang();
  const { user, isSuper } = useAuth();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [showDeleted, setShowDeleted] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [lands, setLands] = useState<any[]>([]);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [patwaris, setPatwaris] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ farmer_id: "", land_id: "", season_id: "", basis: "per_size", rate: 0, quantity: 0, base_charge: 0, canal_charge: 0, maintenance_charge: 0, other_charge: 0, paid_amount: 0, patwari_id: "", entry_date: new Date().toISOString().slice(0, 10) });
  const [rateAvailable, setRateAvailable] = useState<boolean | null>(null);

  const [prevDue, setPrevDue] = useState<number>(0);
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => { document.title = `${t("irrigation")} — ${t("appName")}`; load(); }, [showDeleted]);
  useEffect(() => {
    if (!form.farmer_id) { setLands([]); return; }
    (async () => {
      // Own lands (with mouza_id for patwari auto-default)
      const { data: own } = await supabase
        .from("lands")
        .select("id,dag_no,land_size,farmer_id,mouza_id")
        .eq("farmer_id", form.farmer_id)
        .is("deleted_at", null);
      // Sharecropper lands (via land_relations)
      const { data: rels } = await supabase
        .from("land_relations")
        .select("land_id, lands(id,dag_no,land_size,farmer_id,mouza_id)")
        .eq("sharecropper_farmer_id", form.farmer_id)
        .is("deleted_at", null);
      const ownIds = new Set((own ?? []).map((l: any) => l.id));
      const ownMarked = (own ?? []).map((l: any) => ({ ...l, _ownership: "own" as const }));
      const sharecrop = (rels ?? [])
        .map((r: any) => r.lands)
        .filter((l: any) => l && !ownIds.has(l.id))
        .map((l: any) => ({ ...l, _ownership: "sharecrop" as const }));
      setLands([...ownMarked, ...sharecrop]);
    })();
  }, [form.farmer_id]);
  // Auto-default patwari based on land's mouza (admin can override in dropdown)
  useEffect(() => {
    if (!form.land_id || editId) return;
    const ld = lands.find((l: any) => l.id === form.land_id);
    if (!ld?.mouza_id) return;
    const match = patwaris.find((p: any) => p.mouza_id === ld.mouza_id && p.is_active);
    if (match && !form.patwari_id) setForm((f: any) => ({ ...f, patwari_id: match.id }));
  }, [form.land_id, lands, patwaris, editId]);
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
      if (!form.season_id) { setRateAvailable(null); return; }
      const { data } = await supabase
        .from("irrigation_rates")
        .select("base_rate,canal_charge,maintenance_charge,other_charge,basis")
        .eq("season_id", form.season_id)
        .eq("basis", form.basis)
        .eq("is_active", true)
        .maybeSingle();
      if (!data) {
        setRateAvailable(false);
        setForm((f: any) => ({ ...f, rate: 0, canal_charge: 0, maintenance_charge: 0, other_charge: 0 }));
        return;
      }
      setRateAvailable(true);
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
      if (!form.farmer_id) { setPrevDue(0); return; }
      // Total OUTSTANDING irrigation due for this farmer across ALL seasons & lands
      const { data } = await supabase
        .from("irrigation_charges")
        .select("due_amount")
        .eq("farmer_id", form.farmer_id)
        .is("deleted_at", null);
      const sum = (data ?? []).reduce((a: number, r: any) => a + Number(r.due_amount || 0), 0);
      setPrevDue(sum);
    })();
  }, [form.farmer_id]);

  async function load() {
    let q = supabase.from("irrigation_charges").select("*, farmers(name_en,farmer_code,account_number), lands(dag_no), seasons(name), patwaris(name,name_bn,mobile)").order("entry_date", { ascending: false }).limit(200);
    q = showDeleted ? q.not("deleted_at", "is", null) : q.is("deleted_at", null);
    const [r, s, p] = await Promise.all([
      q,
      supabase.from("seasons").select("*").order("year", { ascending: false }),
      supabase.from("patwaris").select("id,name,name_bn,mobile,mouza_id,is_active").eq("is_active", true).order("name"),
    ]);
    setRows(r.data ?? []); setSeasons(s.data ?? []); setPatwaris(p.data ?? []);
  }
  async function restore(id: string) {
    const { error } = await supabase.from("irrigation_charges").update({ deleted_at: null } as any).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("restored")); load();
  }

  const total = +form.base_charge + +form.canal_charge + +form.maintenance_charge + +form.other_charge;

  // Inline validation
  const errors: Record<string, string> = {};
  if (open) {
    if (!form.farmer_id) errors.farmer_id = t("pgIrrSelectFarmer" as any);
    if (!form.land_id) errors.land_id = t("pgIrrSelectLand" as any);
    if (!form.season_id) errors.season_id = t("pgIrrSelectSeason" as any);
    if (form.season_id && rateAvailable === false) errors.season_id = t("pgIrrNoActiveRate" as any);
    if (!(Number(form.rate) > 0)) errors.rate = t("pgIrrRateGt0" as any);
    if (!(Number(form.quantity) > 0)) errors.quantity = t("pgIrrQtyGt0" as any);
    if (Number(form.canal_charge) < 0) errors.canal_charge = t("pgIrrCannotNegative" as any);
    if (Number(form.maintenance_charge) < 0) errors.maintenance_charge = t("pgIrrCannotNegative" as any);
    if (Number(form.other_charge) < 0) errors.other_charge = t("pgIrrCannotNegative" as any);
    if (Number(form.paid_amount) < 0) errors.paid_amount = t("pgIrrCannotNegative" as any);
    if (Number(form.paid_amount) > total + prevDue) errors.paid_amount = t("pgIrrPaidExceedsTotal" as any);
  }
  const hasErrors = Object.keys(errors).length > 0;

  async function save() {
    if (hasErrors) return toast.error(t("fixHighlightedErrors"));
    if (rateAvailable !== true) return toast.error(t("activeIrrigationRateRequired"));
    const payload: any = {
      farmer_id: form.farmer_id, land_id: form.land_id, season_id: form.season_id,
      basis: form.basis as any, quantity: form.quantity,
      base_charge: form.base_charge, canal_charge: form.canal_charge,
      maintenance_charge: form.maintenance_charge, other_charge: form.other_charge,
      paid_amount: form.paid_amount, entry_date: form.entry_date,
      patwari_id: form.patwari_id || null,
    };
    let error;
    if (editId) {
      ({ error } = await supabase.from("irrigation_charges").update(payload).eq("id", editId));
    } else {
      payload.created_by = user?.id;
      ({ error } = await supabase.from("irrigation_charges").insert(payload));
    }
    if (error) return toast.error(error.message);
    if (!editId && form.paid_amount > 0) {
      await supabase.from("payments").insert({ farmer_id: form.farmer_id, kind: "irrigation", amount: form.paid_amount, collected_by: user?.id });
    }
    toast.success(t("saved")); setOpen(false); setEditId(null); load();
  }

  function openEdit(r: any) {
    setEditId(r.id);
    setForm({
      farmer_id: r.farmer_id, land_id: r.land_id, season_id: r.season_id,
      basis: r.basis, rate: Number(r.base_charge) / Math.max(1, Number(r.quantity)),
      quantity: Number(r.quantity), base_charge: Number(r.base_charge),
      canal_charge: Number(r.canal_charge), maintenance_charge: Number(r.maintenance_charge),
      other_charge: Number(r.other_charge), paid_amount: Number(r.paid_amount),
      entry_date: r.entry_date,
      patwari_id: r.patwari_id || "",
    });
    setOpen(true);
  }

  async function softDelete(id: string) {
    const ok = await confirm({
      title: t("pgIrrDeleteTitle" as any),
      description: t("pgIrrDeleteDesc" as any),
      destructive: true, confirmText: t("pgDelete" as any),
    });
    if (!ok) return;
    const { error } = await supabase.from("irrigation_charges").update({ deleted_at: new Date().toISOString() } as any).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("deleted")); await load();
  }

  const [genSeason, setGenSeason] = useState<string>("");
  const [genBasis, setGenBasis] = useState<string>("per_size");
  const [genOpen, setGenOpen] = useState(false);
  const [genBusy, setGenBusy] = useState(false);

  async function generateForSeason() {
    if (!genSeason) return toast.error(t("selectASeason"));
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
      if (!rate) throw new Error(t("pgIrrNoActiveRateGen" as any));

      const { data: lands, error: landsErr } = await supabase
        .from("lands")
        .select("id, farmer_id, land_size, office_id");
      if (landsErr) throw landsErr;
      if (!lands?.length) throw new Error(t("pgIrrNoLandsFound" as any));

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
            <Button variant="outline"><Sparkles className="h-4 w-4 mr-1" />{t("pgGenerateForSeason")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("pgGenerateIrrigationCharges")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>{t("pgSeason")}</Label>
                <Select value={genSeason} onValueChange={setGenSeason}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{seasons.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("pgBasis")}</Label>
                <Select value={genBasis} onValueChange={setGenBasis}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="per_size">{t("perLandSize")}</SelectItem>
                    <SelectItem value="per_day">{t("perDayLong")}</SelectItem>
                    <SelectItem value="per_hour">{t("perHourLong")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("noActiveRateForSeason")}
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setGenOpen(false)}>{t("cancel")}</Button>
              <Button onClick={generateForSeason} disabled={genBusy || !genSeason}>{genBusy ? "…" : t("pgGenerateForSeason")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setRateAvailable(null); } }}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />{t("addEntry")}</Button></DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>{t("irrigation")} — {editId ? t("edit") : t("addEntry")}</DialogTitle></DialogHeader>
            {form.season_id && rateAvailable === false && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 text-destructive text-sm p-2">
                {t("noActiveRateForSeason")} <a href="/irrigation-rates" className="underline">{t("irrigationRatesLink")}</a> {t("pageFirst")}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>{t("selectFarmer")}</Label>
                <FarmerSearchSelect value={form.farmer_id || null}
                  onChange={(id) => setForm({ ...form, farmer_id: id ?? "", land_id: "", patwari_id: "" })}
                  placeholder={t("searchFarmerNameIdMobile")} />
              </div>
              <div><Label>{t("lands")}</Label>
                <Select value={form.land_id} onValueChange={v => setForm({ ...form, land_id: v, patwari_id: "" })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {lands.map((l: any) => (
                      <SelectItem key={l.id} value={l.id}>
                        Dag {l.dag_no} ({l.land_size} শতক) — {l._ownership === "sharecrop" ? "🤝 বর্গা নেয়া" : "🏠 নিজের জমি"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.land_id && (() => {
                  const sel = lands.find((l: any) => l.id === form.land_id);
                  if (!sel) return null;
                  return (
                    <p className={`text-xs mt-1 font-medium ${sel._ownership === "sharecrop" ? "text-amber-600" : "text-emerald-600"}`}>
                      {sel._ownership === "sharecrop" ? "⚠️ এটি বর্গা নেয়া জমি" : "✓ এটি কৃষকের নিজের জমি"}
                    </p>
                  );
                })()}
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
              <div className="col-span-2">
                <Label>পাটুয়ারী (দায়িত্বরত)</Label>
                <Select value={form.patwari_id || "none"} onValueChange={(v) => setForm({ ...form, patwari_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="— পাটুয়ারী নির্বাচন করুন —" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— কোনটি না —</SelectItem>
                    {patwaris.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name_bn || p.name}{p.mobile ? ` — ${p.mobile}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.patwari_id && form.land_id && (() => {
                  const ld = lands.find((l: any) => l.id === form.land_id);
                  const pw = patwaris.find((p: any) => p.id === form.patwari_id);
                  if (!ld?.mouza_id || !pw) return null;
                  const isDefault = pw.mouza_id === ld.mouza_id;
                  return (
                    <p className={`text-xs mt-1 ${isDefault ? "text-muted-foreground" : "text-amber-600 font-medium"}`}>
                      {isDefault ? "✓ মৌজা অনুযায়ী ডিফল্ট" : "⚠️ মৌজার বাইরে — manual override"}
                    </p>
                  );
                })()}
              </div>
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
          <TableHead className="text-right">{t("actions")}</TableHead>
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
              <TableCell className="text-right">
                {showDeleted ? (
                  <Button size="sm" variant="outline" onClick={() => restore(r.id)}>{t("pgRestore")}</Button>
                ) : isSuper ? (
                  <>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(r)} title={t("edit")}>✎</Button>
                    <Button size="icon" variant="ghost" onClick={() => softDelete(r.id)} title={t("delete")}>🗑</Button>
                  </>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">{t("noData")}</TableCell></TableRow>}
        </TableBody>
      </Table></Card>
      {confirmDialog}
    </>
  );
}
