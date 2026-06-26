import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { useLang } from "@/i18n/LanguageProvider";
import { buildAutoLandChangeRemark } from "@/lib/landChangeRemark";


const SEASONS = ["Boro", "Aman", "Aus", "Rabi"];
const sb = supabase as any;

type Props = { farmerId: string };

/**
 * Per-farmer Land History panel.
 * Shows all land_history rows where this farmer is either the owner (farmer_id)
 * OR the cultivator (cultivator_farmer_id) — supports borga handover scenarios.
 */
export default function FarmerLandHistoryTab({ farmerId }: Props) {
  const { user, isAdmin } = useAuth();
  const { tx } = useLang();

  const [rows, setRows] = useState<any[]>([]);
  const [farmers, setFarmers] = useState<any[]>([]);
  const [year, setYear] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const currentFY = new Date().getFullYear() - (new Date().getMonth() < 6 ? 1 : 0);
  const emptyForm = {
    farmer_id: farmerId,
    fiscal_year: currentFY,
    season: "Boro",
    mouza: "",
    dag_no: "",
    land_size: 0,
    owner_type: "owner",
    field_type: "medium_land",
    cultivator_farmer_id: "",
    remarks: "",
  };
  const [f, setF] = useState<any>(emptyForm);

  useEffect(() => {
    sb.from("farmers").select("id,name_en,farmer_code").order("name_en")
      .then(({ data }: any) => setFarmers(data ?? []));
  }, []);

  useEffect(() => { if (farmerId) load(); /* eslint-disable-next-line */ }, [farmerId, year]);

  async function load() {
    setLoading(true);
    let q = sb.from("land_history")
      .select("*, farmer:farmers!land_history_farmer_id_fkey(name_en,farmer_code), cultivator:farmers!land_history_cultivator_farmer_id_fkey(name_en,farmer_code)")
      .or(`farmer_id.eq.${farmerId},cultivator_farmer_id.eq.${farmerId}`)
      .order("fiscal_year", { ascending: false });
    if (year) q = q.eq("fiscal_year", Number(year));
    const { data, error } = await q;
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setRows(data ?? []);
  }

  async function save() {
    if (!f.farmer_id) return toast.error("Owner farmer required");
    if (!f.land_size || f.land_size <= 0) return toast.error("Land size required");
    const autoRemark = await buildAutoLandChangeRemark(f.farmer_id, f);
    const mergedRemarks = autoRemark
      ? (f.remarks ? `${autoRemark} ${f.remarks}` : autoRemark)
      : f.remarks;
    const payload: any = { ...f, remarks: mergedRemarks, recorded_by: user?.id };
    if (!payload.cultivator_farmer_id) delete payload.cultivator_farmer_id;
    const { error } = await sb.from("land_history").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(autoRemark ? "Saved — auto land-change remark added" : "Saved");
    setOpen(false);
    setF({ ...emptyForm });
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this history row?")) return;
    const { error } = await sb.from("land_history").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  const years = useMemo(() => Array.from({ length: 8 }, (_, i) => currentFY - i), [currentFY]);

  return (
    <div className="space-y-3">
      <Card className="p-3 flex flex-wrap items-end gap-3">
        <div className="min-w-[180px]">
          <Label>{tx("Fiscal Year", "অর্থবছর")}</Label>
          <Select value={year || "all"} onValueChange={v => setYear(v === "all" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder={tx("All", "সব")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tx("All Years", "সব বছর")}</SelectItem>
              {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto">
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) setF({ ...emptyForm }); }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" />{tx("Add Record", "রেকর্ড যোগ")}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>{tx("Add Land History", "জমির ইতিহাস যোগ")}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>{tx("Owner Farmer", "মালিক কৃষক")}</Label>
                  <Select value={f.farmer_id} onValueChange={v => setF({ ...f, farmer_id: v })}>
                    <SelectTrigger><SelectValue placeholder={tx("Select farmer", "কৃষক নির্বাচন")} /></SelectTrigger>
                    <SelectContent>{farmers.map(x => <SelectItem key={x.id} value={x.id}>{x.farmer_code} — {x.name_en}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>{tx("Fiscal Year", "অর্থবছর")}</Label><Input type="number" value={f.fiscal_year} onChange={e => setF({ ...f, fiscal_year: +e.target.value })} /></div>
                <div><Label>{tx("Season", "মৌসুম")}</Label>
                  <Select value={f.season} onValueChange={v => setF({ ...f, season: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SEASONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>{tx("Mouza", "মৌজা")}</Label><MouzaSelect value={f.mouza} onChange={v => setF({ ...f, mouza: v })} disabled={!isAdmin} /></div>
                <div><Label>{tx("Dag No", "দাগ নম্বর")}</Label><Input value={f.dag_no} onChange={e => setF({ ...f, dag_no: e.target.value })} disabled={!isAdmin} title={!isAdmin ? tx("Only admin can edit Dag No", "শুধু অ্যাডমিন দাগ পরিবর্তন করতে পারে") : undefined} /></div>
                <div><Label>{tx("Land Size (Shotok)", "জমির পরিমাণ (শতক)")}</Label><Input type="number" step="0.001" value={f.land_size || ""} onChange={e => setF({ ...f, land_size: +e.target.value })} disabled={!isAdmin} title={!isAdmin ? tx("Only admin can edit land size", "শুধু অ্যাডমিন জমির পরিমাণ পরিবর্তন করতে পারে") : undefined} /></div>
                <div><Label>{tx("Owner Type", "মালিকানা ধরন")}</Label>
                  <Select value={f.owner_type} onValueChange={v => setF({ ...f, owner_type: v })} disabled={!isAdmin}>
                    <SelectTrigger title={!isAdmin ? tx("Only admin can change owner type", "শুধু অ্যাডমিন মালিকানা ধরন পরিবর্তন করতে পারে") : undefined}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">{tx("Owner", "নিজস্ব")}</SelectItem>
                      <SelectItem value="borga">{tx("Borga", "বর্গা")}</SelectItem>
                      <SelectItem value="lease">{tx("Lease", "লিজ")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {!isAdmin && (
                  <div className="col-span-2 text-[11px] text-muted-foreground">
                    {tx("Mouza/Dag/Land/Ownership changes are reserved for admin only.", "মৌজা/দাগ/জমি/মালিকানা পরিবর্তন শুধু অ্যাডমিনের জন্য সংরক্ষিত।")}
                  </div>
                )}
                <div className="col-span-2"><Label>{tx("Cultivator (if different — e.g. borgadar)", "চাষী (ভিন্ন হলে — যেমন বর্গাদার)")}</Label>
                  <Select value={f.cultivator_farmer_id || "none"} onValueChange={v => setF({ ...f, cultivator_farmer_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{tx("— None —", "— কেউ না —")}</SelectItem>
                      {farmers.map(x => <SelectItem key={x.id} value={x.id}>{x.farmer_code} — {x.name_en}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2"><Label>{tx("Remarks", "মন্তব্য")}</Label><Input value={f.remarks} onChange={e => setF({ ...f, remarks: e.target.value })} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>{tx("Cancel", "বাতিল")}</Button>
                <Button onClick={save}>{tx("Save", "সংরক্ষণ")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tx("Year", "বছর")}</TableHead>
              <TableHead>{tx("Season", "মৌসুম")}</TableHead>
              <TableHead>{tx("Role", "ভূমিকা")}</TableHead>
              <TableHead>{tx("Mouza / Dag", "মৌজা / দাগ")}</TableHead>
              <TableHead className="text-right">{tx("Size", "পরিমাণ")}</TableHead>
              <TableHead>{tx("Owner", "মালিক")}</TableHead>
              <TableHead>{tx("Cultivator", "চাষী")}</TableHead>
              <TableHead>{tx("Remarks", "মন্তব্য")}</TableHead>
              {isAdmin && <TableHead></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">{tx("Loading…", "লোড হচ্ছে…")}</TableCell></TableRow>}
            {!loading && rows.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">{tx("No history yet", "কোনো ইতিহাস নেই")}</TableCell></TableRow>
            )}
            {rows.map(r => {
              const isOwnerRow = r.farmer_id === farmerId;
              const role = isOwnerRow
                ? (r.cultivator_farmer_id ? tx("Owner (gave borga)", "মালিক (বর্গা দিয়েছেন)") : tx("Self-cultivated", "নিজে চাষ"))
                : tx("Cultivator (borga)", "চাষী (বর্গা)");
              return (
                <TableRow key={r.id}>
                  <TableCell>{r.fiscal_year}</TableCell>
                  <TableCell>{r.season}</TableCell>
                  <TableCell className="text-xs">{role}</TableCell>
                  <TableCell className="text-sm">{r.mouza || "—"} / {r.dag_no || "—"}</TableCell>
                  <TableCell className="text-right">{Number(r.land_size).toFixed(2)}</TableCell>
                  <TableCell className="text-xs">{r.farmer?.farmer_code} — {r.farmer?.name_en}</TableCell>
                  <TableCell className="text-xs">{r.cultivator ? `${r.cultivator.farmer_code} — ${r.cultivator.name_en}` : "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.remarks}</TableCell>
                  {isAdmin && (
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => remove(r.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

