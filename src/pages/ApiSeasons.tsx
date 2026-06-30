import { useState } from "react";
import { ApiShell } from "@/components/api/ApiShell";
import { useSeasons, useCreateSeason, useUpdateSeason, useActivateSeason } from "@/hooks/useCatalogApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

type FormState = { name: string; year: number; start_date: string; end_date: string };
const emptyForm = (): FormState => ({ name: "", year: new Date().getFullYear(), start_date: "", end_date: "" });

export default function ApiSeasons() {
  const { data, isLoading } = useSeasons();
  const create = useCreateSeason();
  const update = useUpdateSeason();
  const activate = useActivateSeason();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());

  const openCreate = () => { setEditId(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (s: any) => {
    setEditId(s.id);
    setForm({ name: s.name || "", year: s.year || new Date().getFullYear(), start_date: s.start_date || "", end_date: s.end_date || "" });
    setOpen(true);
  };

  const submit = async () => {
    try {
      if (editId) await update.mutateAsync({ id: editId, ...form });
      else await create.mutateAsync(form);
      toast.success("Saved");
      setOpen(false);
    } catch (e: any) { toast.error(e.message); }
  };

  const saving = create.isPending || update.isPending;

  return (
    <ApiShell>
      <div className="container mx-auto p-4 space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Seasons</CardTitle>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button onClick={openCreate}>New Season</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editId ? "Edit Season" : "Create Season"}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Boro 2026" /></div>
                  <div><Label>Year</Label><Input type="number" value={form.year} onChange={e => setForm({ ...form, year: Number(e.target.value) })} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>Start</Label><Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
                    <div><Label>End</Label><Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} /></div>
                  </div>
                  <Button className="w-full" onClick={submit} disabled={saving}>Save</Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {isLoading ? <p>Loading…</p> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Name</TableHead><TableHead>Year</TableHead>
                  <TableHead>Start</TableHead><TableHead>End</TableHead>
                  <TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {data?.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{s.year || "-"}</TableCell>
                      <TableCell>{s.start_date || "-"}</TableCell>
                      <TableCell>{s.end_date || "-"}</TableCell>
                      <TableCell><Badge variant={s.is_active ? "default" : "secondary"}>{s.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button size="sm" variant="outline" onClick={() => openEdit(s)}>Edit</Button>
                        {!s.is_active && <Button size="sm" variant="outline" onClick={() => activate.mutate(s.id)}>Activate</Button>}
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
