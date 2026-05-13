import { useState } from "react";
import { ApiShell } from "@/components/api/ApiShell";
import { useAssets, useCreateAsset } from "@/hooks/useCatalogApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function ApiAssets() {
  const [q, setQ] = useState("");
  const { data, isLoading } = useAssets({ q: q || undefined, per_page: 50 });
  const create = useCreateAsset();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", category: "", serial_no: "", purchase_date: "", cost: 0, status: "active" });

  const submit = async () => {
    try { await create.mutateAsync(form); toast.success("Saved"); setOpen(false); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <ApiShell>
      <div className="container mx-auto p-4 space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>Assets</CardTitle>
            <div className="flex gap-2">
              <Input placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} className="w-56" />
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild><Button>New Asset</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Create Asset</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><Label>Category</Label><Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} /></div>
                      <div><Label>Serial No</Label><Input value={form.serial_no} onChange={e => setForm({ ...form, serial_no: e.target.value })} /></div>
                      <div><Label>Purchase Date</Label><Input type="date" value={form.purchase_date} onChange={e => setForm({ ...form, purchase_date: e.target.value })} /></div>
                      <div><Label>Cost</Label><Input type="number" step="0.01" value={form.cost} onChange={e => setForm({ ...form, cost: Number(e.target.value) })} /></div>
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
                  <TableHead>Name</TableHead><TableHead>Category</TableHead>
                  <TableHead>Serial</TableHead><TableHead>Purchased</TableHead>
                  <TableHead className="text-right">Cost</TableHead><TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {data?.data?.map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.name}</TableCell>
                      <TableCell>{a.category || "-"}</TableCell>
                      <TableCell className="text-xs">{a.serial_no || "-"}</TableCell>
                      <TableCell>{a.purchase_date || "-"}</TableCell>
                      <TableCell className="text-right">{Number(a.cost || 0).toFixed(2)}</TableCell>
                      <TableCell><Badge variant="secondary">{a.status || "-"}</Badge></TableCell>
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
