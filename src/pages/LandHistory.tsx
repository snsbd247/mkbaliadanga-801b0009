import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
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
import { buildAutoLandChangeRemark } from "@/lib/landChangeRemark";

const SEASONS = ["Boro", "Aman", "Aus", "Rabi"];
const sb = supabase as any;

export default function LandHistory() {
  const { user, isAdmin } = useAuth();
  const [farmers, setFarmers] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [farmerId, setFarmerId] = useState<string>("");
  const [year, setYear] = useState<string>("");
  const [open, setOpen] = useState(false);
  const currentFY = new Date().getFullYear() - (new Date().getMonth() < 6 ? 1 : 0);
  const [f, setF] = useState<any>({
    farmer_id: "", fiscal_year: currentFY, season: "Boro",
    mouza: "", dag_no: "", land_size: 0, owner_type: "owner",
    field_type: "medium_land", cultivator_farmer_id: "", remarks: "",
  });

  useEffect(() => {
    document.title = "Land History — MK Baliadanga";
    sb.from("farmers").select("id,name_en,farmer_code").order("name_en").then(({ data }: any) => setFarmers(data ?? []));
  }, []);

  useEffect(() => { load(); }, [farmerId, year]);

  async function load() {
    let q = sb.from("land_history").select("*, farmer:farmers!land_history_farmer_id_fkey(name_en,farmer_code), cultivator:farmers!land_history_cultivator_farmer_id_fkey(name_en)").order("fiscal_year", { ascending: false });
    if (farmerId) q = q.eq("farmer_id", farmerId);
    if (year) q = q.eq("fiscal_year", Number(year));
    const { data, error } = await q;
    if (error) { toast.error(error.message); return; }
    setRows(data ?? []);
  }

  async function save() {
    if (!f.farmer_id) return toast.error("Farmer required");
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
    setOpen(false); load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this history row?")) return;
    const { error } = await sb.from("land_history").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  const years = useMemo(() => Array.from({ length: 8 }, (_, i) => currentFY - i), [currentFY]);

  return (
    <>
      <PageHeader
        title="ভূমির ইতিহাস (Land History)"
        description="৫-৭ বছরের ভূমি রেকর্ড সংরক্ষণ"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Record</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Add Land History</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>Farmer</Label>
                  <Select value={f.farmer_id} onValueChange={v => setF({ ...f, farmer_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select farmer" /></SelectTrigger>
                    <SelectContent>{farmers.map(x => <SelectItem key={x.id} value={x.id}>{x.farmer_code} — {x.name_en}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Fiscal Year</Label><Input type="number" value={f.fiscal_year} onChange={e => setF({ ...f, fiscal_year: +e.target.value })} /></div>
                <div><Label>Season</Label>
                  <Select value={f.season} onValueChange={v => setF({ ...f, season: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SEASONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Mouza</Label><Input value={f.mouza} onChange={e => setF({ ...f, mouza: e.target.value })} disabled={!isAdmin} title={!isAdmin ? "Only admin can edit Mouza" : undefined} /></div>
                <div><Label>Dag No</Label><Input value={f.dag_no} onChange={e => setF({ ...f, dag_no: e.target.value })} disabled={!isAdmin} title={!isAdmin ? "Only admin can edit Dag No" : undefined} /></div>
                <div><Label>Land Size (শতক)</Label><Input type="number" step="0.001" value={f.land_size || ""} onChange={e => setF({ ...f, land_size: +e.target.value })} disabled={!isAdmin} title={!isAdmin ? "Only admin can edit land size" : undefined} /></div>
                <div><Label>Owner Type</Label>
                  <Select value={f.owner_type} onValueChange={v => setF({ ...f, owner_type: v })} disabled={!isAdmin}>
                    <SelectTrigger title={!isAdmin ? "Only admin can change owner type" : undefined}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">নিজস্ব (Owner)</SelectItem>
                      <SelectItem value="borga">বর্গা (Borga)</SelectItem>
                      <SelectItem value="lease">লিজ (Lease)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {!isAdmin && (
                  <div className="col-span-2 text-[11px] text-muted-foreground">
                    মৌজা/দাগ/জমি/মালিকানা পরিবর্তন শুধু অ্যাডমিনের জন্য সংরক্ষিত।
                  </div>
                )}
                <div className="col-span-2"><Label>Cultivator (if different)</Label>
                  <Select value={f.cultivator_farmer_id} onValueChange={v => setF({ ...f, cultivator_farmer_id: v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{farmers.map(x => <SelectItem key={x.id} value={x.id}>{x.farmer_code} — {x.name_en}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-2"><Label>Remarks</Label><Input value={f.remarks} onChange={e => setF({ ...f, remarks: e.target.value })} /></div>
              </div>
              <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <Card className="p-3 mb-3 grid gap-3 md:grid-cols-3">
        <div><Label>Filter by Farmer</Label>
          <Select value={farmerId || "all"} onValueChange={v => setFarmerId(v === "all" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Farmers</SelectItem>
              {farmers.map(x => <SelectItem key={x.id} value={x.id}>{x.farmer_code} — {x.name_en}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label>Fiscal Year</Label>
          <Select value={year || "all"} onValueChange={v => setYear(v === "all" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>
      <Card className="overflow-x-auto"><Table>
        <TableHeader><TableRow>
          <TableHead>Year</TableHead><TableHead>Season</TableHead><TableHead>Farmer</TableHead>
          <TableHead>Mouza/Dag</TableHead><TableHead className="text-right">Size</TableHead>
          <TableHead>Owner</TableHead><TableHead>Cultivator</TableHead><TableHead>Remarks</TableHead>
          {isAdmin && <TableHead></TableHead>}
        </TableRow></TableHeader>
        <TableBody>
          {rows.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No history yet</TableCell></TableRow>}
          {rows.map(r => (
            <TableRow key={r.id}>
              <TableCell>{r.fiscal_year}</TableCell>
              <TableCell>{r.season}</TableCell>
              <TableCell className="text-sm">{r.farmer?.farmer_code} — {r.farmer?.name_en}</TableCell>
              <TableCell className="text-sm">{r.mouza} / {r.dag_no}</TableCell>
              <TableCell className="text-right">{Number(r.land_size).toFixed(2)}</TableCell>
              <TableCell>{r.owner_type}</TableCell>
              <TableCell className="text-sm">{r.cultivator?.name_en ?? "—"}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{r.remarks}</TableCell>
              {isAdmin && <TableCell><Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>}
            </TableRow>
          ))}
        </TableBody>
      </Table></Card>
    </>
  );
}
