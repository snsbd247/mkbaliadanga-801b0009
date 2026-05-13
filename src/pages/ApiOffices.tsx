import { useState } from "react";
import { ApiShell } from "@/components/api/ApiShell";
import { useOffices, useCreateOffice, useUpdateOffice } from "@/hooks/useAdminApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function ApiOffices() {
  const { data, isLoading } = useOffices();
  const create = useCreateOffice();
  const update = useUpdateOffice();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", code: "", address: "" });

  const reset = () => { setForm({ name: "", code: "", address: "" }); setEditing(null); };

  const submit = async () => {
    try {
      if (editing) await update.mutateAsync({ id: editing, ...form });
      else await create.mutateAsync(form);
      toast.success("Saved");
      setOpen(false); reset();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <ApiShell>
      <div className="container mx-auto p-4 space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Offices</CardTitle>
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
              <DialogTrigger asChild><Button>New Office</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editing ? "Edit" : "Create"} Office</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                  <div><Label>Code</Label><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} /></div>
                  <div><Label>Address</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
                  <Button className="w-full" onClick={submit} disabled={create.isPending || update.isPending}>Save</Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {isLoading ? <p>Loading…</p> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Name</TableHead><TableHead>Code</TableHead>
                  <TableHead>Address</TableHead><TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {data?.map(o => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">{o.name}</TableCell>
                      <TableCell>{o.code || "-"}</TableCell>
                      <TableCell>{o.address || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={o.is_active ? "default" : "secondary"}>
                          {o.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => {
                          setEditing(o.id);
                          setForm({ name: o.name, code: o.code || "", address: o.address || "" });
                          setOpen(true);
                        }}>Edit</Button>
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
