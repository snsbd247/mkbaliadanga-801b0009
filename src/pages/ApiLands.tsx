import { useState } from "react";
import { ApiShell } from "@/components/api/ApiShell";
import { useLands, useCreateLand, useDeleteLand } from "@/hooks/useCatalogApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MouzaSelect } from "@/components/locations/MouzaSelect";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function ApiLands() {
  const [q, setQ] = useState("");
  const { data, isLoading } = useLands({ q: q || undefined, per_page: 50 });
  const create = useCreateLand();
  const del = useDeleteLand();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ farmer_id: "", khatian_no: "", dag_no: "", area_decimal: 0, mouza: "" });

  const submit = async () => {
    try { await create.mutateAsync(form); toast.success("Saved"); setOpen(false); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <ApiShell>
      <div className="container mx-auto p-4 space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>Lands</CardTitle>
            <div className="flex gap-2">
              <Input placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} className="w-56" />
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild><Button>New Land</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Create Land</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Farmer ID</Label><Input value={form.farmer_id} onChange={e => setForm({ ...form, farmer_id: e.target.value })} /></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><Label>Khatian No</Label><Input value={form.khatian_no} onChange={e => setForm({ ...form, khatian_no: e.target.value })} /></div>
                      <div><Label>Dag No</Label><Input value={form.dag_no} onChange={e => setForm({ ...form, dag_no: e.target.value })} /></div>
                    </div>
                    <div><Label>Area (decimal)</Label><Input type="number" step="0.01" value={form.area_decimal} onChange={e => setForm({ ...form, area_decimal: Number(e.target.value) })} /></div>
                    <div><Label>Mouza</Label><MouzaSelect value={form.mouza} onChange={v => setForm({ ...form, mouza: v })} /></div>
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
                  <TableHead>Khatian</TableHead><TableHead>Dag</TableHead>
                  <TableHead>Mouza</TableHead><TableHead className="text-right">Area</TableHead>
                  <TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {data?.data?.map(l => (
                    <TableRow key={l.id}>
                      <TableCell>{l.khatian_no || "-"}</TableCell>
                      <TableCell>{l.dag_no || "-"}</TableCell>
                      <TableCell>{l.mouza || "-"}</TableCell>
                      <TableCell className="text-right">{l.area_decimal ?? "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => confirm("Delete?") && del.mutate(l.id)}>
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
