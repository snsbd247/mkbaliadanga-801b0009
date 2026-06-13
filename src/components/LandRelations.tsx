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
import { Plus, X, FileText, FileSpreadsheet } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { FarmerSearchSelect } from "@/components/farmers/FarmerSearchSelect";
import { exportLandRelationsPdf, exportLandRelationsExcel, type LandRelationExportRow } from "@/lib/landRelationsExport";

interface Props { farmerId: string; }

export function LandRelations({ farmerId }: Props) {
  const { t, tx } = useLang();
  const { user, isAdmin } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [lands, setLands] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    land_id: "", owner_farmer_id: farmerId, sharecropper_farmer_id: "",
    share_percentage: 50, area_decimal: "", valid_from: new Date().toISOString().slice(0, 10), note: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, [farmerId]);

  function resetForm() {
    setForm({ land_id: "", owner_farmer_id: farmerId, sharecropper_farmer_id: "", share_percentage: 50, area_decimal: "", valid_from: new Date().toISOString().slice(0, 10), note: "" });
  }

  // Owner remaining area for the land currently selected in the form
  const selectedLand = lands.find((l) => l.id === form.land_id);
  const allocatedForSelected = rows
    .filter((r) => r.land_id === form.land_id && !r.valid_to && !r.deleted_at && r.area_decimal != null)
    .reduce((s, r) => s + Number(r.area_decimal || 0), 0);
  const ownerRemaining = selectedLand
    ? Number(selectedLand.land_size || 0) - allocatedForSelected - Number(form.area_decimal || 0)
    : null;

  async function load() {
    const [rels, ld] = await Promise.all([
      supabase.from("land_relations")
        .select("*, lands(dag_no,dag_numbers,mouza,land_size,mouza_id), owner:farmers!land_relations_owner_farmer_id_fkey(name_en,farmer_code,member_no), sc:farmers!land_relations_sharecropper_farmer_id_fkey(name_en,farmer_code,member_no)")
        .is("deleted_at", null)
        .or(`owner_farmer_id.eq.${farmerId},sharecropper_farmer_id.eq.${farmerId}`)
        .order("valid_from", { ascending: false }),
      supabase.from("lands").select("id,dag_no,mouza,land_size,farmer_id").is("deleted_at", null).order("created_at"),
    ]);
    const relsData = rels.data ?? [];
    // Hydrate location chain for involved lands
    const landIds = Array.from(new Set(relsData.map((r: any) => r.land_id).filter(Boolean)));
    let locByLand: Record<string, any> = {};
    if (landIds.length) {
      const { data: locs } = await (supabase.from as any)("lands_with_location")
        .select("id,division_name,district_name,upazila_name,union_name,ward_name,village_name,mouza_name")
        .in("id", landIds);
      (locs ?? []).forEach((l: any) => { locByLand[l.id] = l; });
    }
    setRows(relsData.map((r: any) => ({ ...r, _loc: locByLand[r.land_id] })));
    setLands(ld.data ?? []);
  }

  function buildExportRows(): LandRelationExportRow[] {
    return rows.map((r) => ({
      dag_no: r.lands?.dag_no,
      land_size: r.lands?.land_size,
      mouza: r.lands?.mouza,
      mouza_name: r._loc?.mouza_name,
      division_name: r._loc?.division_name,
      district_name: r._loc?.district_name,
      upazila_name: r._loc?.upazila_name,
      union_name: r._loc?.union_name,
      ward_name: r._loc?.ward_name,
      village_name: r._loc?.village_name,
      owner_name: r.owner?.name_en,
      owner_account: r.owner?.member_no ?? r.owner?.farmer_code,
      sc_name: r.sc?.name_en,
      sc_account: r.sc?.member_no ?? r.sc?.farmer_code,
      share_percentage: r.share_percentage,
      valid_from: r.valid_from,
      valid_to: r.valid_to,
      status: r.valid_to ? "historic" : "active",
    }));
  }

  async function save() {
    if (!form.land_id || !form.owner_farmer_id) return toast.error("Land and Owner required");
    if (form.sharecropper_farmer_id && form.sharecropper_farmer_id === form.owner_farmer_id) {
      return toast.error("Owner and Tenant must be different farmers");
    }
    setSaving(true);
    try {
      // Phase 4: block re-transferring a parcel back to a previous (ended) sharecropper
      if (form.sharecropper_farmer_id) {
        const { data: prior } = await supabase.from("land_relations")
          .select("id")
          .eq("land_id", form.land_id)
          .eq("sharecropper_farmer_id", form.sharecropper_farmer_id)
          .not("valid_to", "is", null)
          .is("deleted_at", null)
          .limit(1);
        if (prior && prior.length) {
          toast.error(tx(
            "This farmer was previously a sharecropper on this parcel — re-transfer is not allowed.",
            "এই কৃষক আগে এই জমির বর্গাদার ছিলেন — পুনরায় ফেরত হস্তান্তর করা যাবে না।",
          ));
          setSaving(false);
          return;
        }
      }
      const { error } = await supabase.from("land_relations").insert({
        land_id: form.land_id,
        owner_farmer_id: form.owner_farmer_id,
        sharecropper_farmer_id: form.sharecropper_farmer_id || null,
        share_percentage: Number(form.share_percentage),
        area_decimal: form.area_decimal === "" ? null : Number(form.area_decimal),
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
      <div className="flex items-center justify-between p-3 border-b gap-2 flex-wrap">
        <div className="text-sm text-muted-foreground">{t("landRelations")} — owner ↔ tenant history</div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={rows.length === 0}
            onClick={() => exportLandRelationsPdf(`Farmer ${farmerId.slice(0, 8)}`, buildExportRows())}>
            <FileText className="h-4 w-4 mr-1" />PDF
          </Button>
          <Button size="sm" variant="outline" disabled={rows.length === 0}
            onClick={() => exportLandRelationsExcel(`Farmer ${farmerId.slice(0, 8)}`, buildExportRows())}>
            <FileSpreadsheet className="h-4 w-4 mr-1" />Excel
          </Button>
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
              <div><Label>{t("tenant")} <span className="text-xs text-muted-foreground">(optional)</span></Label>
                <FarmerSearchSelect value={form.sharecropper_farmer_id || null}
                  onChange={(id) => setForm({ ...form, sharecropper_farmer_id: id ?? "" })}
                  excludeIds={form.owner_farmer_id ? [form.owner_farmer_id] : []}
                  placeholder="Search tenant (optional)" disabled={saving} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t("sharePercent")}</Label><Input type="number" min={0} max={100} step="0.1" disabled={saving} value={form.share_percentage} onChange={e => setForm({ ...form, share_percentage: +e.target.value })} /></div>
                <div><Label>{tx("Borga area (shatak)", "বর্গা পরিমাণ (শতক)")}</Label><Input type="number" min={0} step="0.01" disabled={saving || !form.land_id} value={form.area_decimal} onChange={e => setForm({ ...form, area_decimal: e.target.value })} placeholder={selectedLand ? `≤ ${selectedLand.land_size}` : "—"} /></div>
              </div>
              {selectedLand && (
                <div className={`rounded-md border p-2 text-xs ${ownerRemaining != null && ownerRemaining < 0 ? "border-destructive text-destructive" : "text-muted-foreground"}`}>
                  {tx("Parcel size", "জমির পরিমাণ")}: {selectedLand.land_size} · {tx("Already allocated", "ইতিমধ্যে বরাদ্দ")}: {allocatedForSelected} · {tx("Owner remaining", "মালিকের অবশিষ্ট")}: <strong>{ownerRemaining}</strong>
                  {ownerRemaining != null && ownerRemaining < 0 && <> — {tx("exceeds parcel size!", "জমির পরিমাণ ছাড়িয়ে গেছে!")}</>}
                </div>
              )}
              <div><Label>{t("validFrom")}</Label><Input type="date" disabled={saving} value={form.valid_from} onChange={e => setForm({ ...form, valid_from: e.target.value })} /></div>
              <div><Label>{t("note")}</Label><Input disabled={saving} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></div>
            </div>
            <DialogFooter><Button variant="outline" disabled={saving} onClick={() => setOpen(false)}>{t("cancel")}</Button><Button onClick={save} disabled={saving}>{saving ? "…" : t("save")}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Grouped summary: per land/dag who is sharecropping */}
      {(() => {
        const active = rows.filter(r => !r.valid_to && !r.deleted_at);
        if (active.length === 0) return null;
        const byLand: Record<string, any[]> = {};
        active.forEach(r => { (byLand[r.land_id] ||= []).push(r); });
        return (
          <div className="p-3 border-b space-y-3">
            <div className="text-sm font-medium">{tx("By parcel — sharecroppers", "জমি অনুযায়ী — বর্গাদার")}</div>
            {Object.entries(byLand).map(([landId, list]) => {
              const ld = list[0]?.lands;
              const dags = ld?.dag_numbers?.length ? ld.dag_numbers.join(", ") : ld?.dag_no;
              const size = Number(ld?.land_size || 0);
              const allocated = list.reduce((s, r) => s + Number(r.area_decimal || 0), 0);
              const owner = list[0]?.owner;
              return (
                <div key={landId} className="rounded-md border p-2 text-xs space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span><b>{tx("Dag", "দাগ")}:</b> {dags ?? "—"} · <b>{tx("Mouza", "মৌজা")}:</b> {ld?.mouza ?? "—"} · <b>{tx("Size", "পরিমাণ")}:</b> {size}</span>
                    <span className="text-muted-foreground">{tx("Owner", "মালিক")}: {owner?.name_en} · {tx("Remaining", "অবশিষ্ট")}: <b>{(size - allocated).toFixed(2)}</b></span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {list.filter(r => r.sc).map(r => (
                      <Badge key={r.id} variant="secondary">
                        {r.sc?.name_en} — {r.area_decimal != null ? `${r.area_decimal} ${tx("shatak", "শতক")}` : `${r.share_percentage}%`}
                      </Badge>
                    ))}
                    {list.every(r => !r.sc) && <span className="text-muted-foreground">{tx("No sharecropper", "কোনো বর্গাদার নেই")}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      <Table>
        <TableHeader><TableRow>
          <TableHead>Land</TableHead>
          <TableHead>{t("owner")}</TableHead>
          <TableHead>{t("tenant")}</TableHead>
          <TableHead>{t("sharePercent")}</TableHead>
          <TableHead>{tx("Borga area", "বর্গা পরিমাণ")}</TableHead>
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
                <TableCell>{r.owner?.name_en} <span className="text-xs text-muted-foreground">({r.owner?.member_no ?? r.owner?.farmer_code})</span></TableCell>
                <TableCell>{r.sc?.name_en ? <>{r.sc.name_en} <span className="text-xs text-muted-foreground">({r.sc.member_no ?? r.sc.farmer_code})</span></> : <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>{r.share_percentage}%</TableCell>
                <TableCell>{r.area_decimal != null ? r.area_decimal : <span className="text-muted-foreground">—</span>}</TableCell>
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
          {rows.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">{t("noData")}</TableCell></TableRow>}
        </TableBody>
      </Table>
    </Card>
  );
}
