import { useState } from "react";
import { ApiShell } from "@/components/api/ApiShell";
import { useIrrigationRates, useCreateIrrigationRate, useDeleteIrrigationRate, useSeasons } from "@/hooks/useCatalogApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function ApiIrrigationRates() {
  const [seasonFilter, setSeasonFilter] = useState<string>("");
  const { data: seasons } = useSeasons();
  const { data, isLoading } = useIrrigationRates({ season_id: seasonFilter || undefined });
  const create = useCreateIrrigationRate();
  const del = useDeleteIrrigationRate();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ season_id: "", crop: "", rate_per_decimal: 0, effective_from: "", effective_to: "" });

  const submit = async () => {
    try { await create.mutateAsync(form); toast.success("Saved"); setOpen(false); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <ApiShell>
      <div className="container mx-auto p-4 space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>Irrigation Rates</CardTitle>
            <div className="flex gap-2">
              <Select value={seasonFilter} onValueChange={setSeasonFilter}>
                <SelectTrigger className="w-48"><SelectValue placeholder="All seasons" /></SelectTrigger>
                <SelectContent>
                  {seasons?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild><Button>New Rate</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Create Rate</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label>Season</Label>
                      <Select value={form.season_id} onValueChange={v => setForm({ ...form, season_id: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{seasons?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Crop</Label><Input value={form.crop} onChange={e => setForm({ ...form, crop: e.target.value })} /></div>
                    <div><Label>Rate / decimal</Label><Input type="number" step="0.01" value={form.rate_per_decimal} onChange={e => setForm({ ...form, rate_per_decimal: Number(e.target.value) })} /></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><Label>Effective From</Label><Input type="date" value={form.effective_from} onChange={e => setForm({ ...form, effective_from: e.target.value })} /></div>
                      <div><Label>Effective To</Label><Input type="date" value={form.effective_to} onChange={e => setForm({ ...form, effective_to: e.target.value })} /></div>
                    </div>
                    <Button className="w-full" onClick={submit} disabled={create.isPending}>Save</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? <p>Loading…</p> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Season</TableHead><TableHead>Crop</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead>From</TableHead><TableHead>To</TableHead>
                  <TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {data?.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">{seasons?.find(s => s.id === r.season_id)?.name || "-"}</TableCell>
                      <TableCell>{r.crop || "-"}</TableCell>
                      <TableCell className="text-right">{Number(r.rate_per_decimal).toFixed(2)}</TableCell>
                      <TableCell>{r.effective_from || "-"}</TableCell>
                      <TableCell>{r.effective_to || "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => confirm("Delete?") && del.mutate(r.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </ApiShell>
  );
}
