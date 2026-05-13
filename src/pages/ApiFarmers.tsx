import { useState } from "react";
import { Navigate } from "react-router-dom";
import { LaravelAuthProvider, useLaravelAuth } from "@/auth/LaravelAuthProvider";
import { useCreateFarmer, useDeleteFarmer, useFarmersList, useUpdateFarmer } from "@/hooks/useFarmersApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Farmer } from "@/lib/api/farmers";
import { Pencil, Trash2 } from "lucide-react";

function FarmerForm({
  initial, onSubmit, busy,
}: { initial?: Partial<Farmer>; onSubmit: (v: Partial<Farmer>) => Promise<void>; busy: boolean }) {
  const [v, setV] = useState<Partial<Farmer>>(initial ?? {});
  const set = (k: keyof Farmer) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });
  return (
    <form
      onSubmit={async (e) => { e.preventDefault(); await onSubmit(v); }}
      className="grid gap-3"
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label>Code</Label><Input value={v.code ?? ""} onChange={set("code")} required /></div>
        <div className="space-y-1"><Label>Name</Label><Input value={v.name ?? ""} onChange={set("name")} required /></div>
        <div className="space-y-1"><Label>Father</Label><Input value={v.father_name ?? ""} onChange={set("father_name")} /></div>
        <div className="space-y-1"><Label>Mother</Label><Input value={v.mother_name ?? ""} onChange={set("mother_name")} /></div>
        <div className="space-y-1"><Label>Phone</Label><Input value={v.phone ?? ""} onChange={set("phone")} /></div>
        <div className="space-y-1"><Label>NID</Label><Input value={v.nid ?? ""} onChange={set("nid")} /></div>
        <div className="space-y-1"><Label>Village</Label><Input value={v.village ?? ""} onChange={set("village")} /></div>
        <div className="space-y-1"><Label>Union</Label><Input value={v.union ?? ""} onChange={set("union")} /></div>
      </div>
      <DialogFooter><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button></DialogFooter>
    </form>
  );
}

function FarmersInner() {
  const { user, loading, signOut } = useLaravelAuth();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Farmer | null>(null);
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  const list = useFarmersList({ q, page, per_page: 20 });
  const create = useCreateFarmer();
  const update = useUpdateFarmer();
  const del = useDeleteFarmer();

  if (loading) return <div className="p-8">Loading…</div>;
  if (!user) return <Navigate to="/api/auth" replace />;

  return (
    <div className="container mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Farmers (Laravel API)</h1>
        <div className="flex gap-2 items-center">
          <span className="text-sm text-muted-foreground">{user.email}</span>
          <Button variant="outline" size="sm" onClick={() => signOut()}>Logout</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>List</CardTitle>
          <div className="flex gap-2">
            <Input placeholder="Search…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="w-64" />
            <Dialog open={creating} onOpenChange={setCreating}>
              <DialogTrigger asChild><Button>New Farmer</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create farmer</DialogTitle></DialogHeader>
                <FarmerForm
                  busy={create.isPending}
                  onSubmit={async (v) => {
                    try { await create.mutateAsync(v); setCreating(false); toast({ title: "Created" }); }
                    catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {list.isLoading ? <div>Loading…</div> : list.error ? <div className="text-destructive">{(list.error as Error).message}</div> : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead><TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead><TableHead>Village</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.data?.data.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell>{f.code}</TableCell>
                      <TableCell>{f.name}</TableCell>
                      <TableCell>{f.phone ?? "—"}</TableCell>
                      <TableCell>{f.village ?? "—"}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="icon" variant="ghost" onClick={() => setEditing(f)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={async () => {
                          if (!confirm(`Delete ${f.name}?`)) return;
                          try { await del.mutateAsync(f.id); toast({ title: "Deleted" }); }
                          catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
                        }}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {list.data?.meta && (
                <div className="flex justify-between items-center mt-4 text-sm">
                  <span>Page {list.data.meta.current_page} / {list.data.meta.last_page} · {list.data.meta.total} total</span>
                  <div className="space-x-2">
                    <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
                    <Button size="sm" variant="outline" disabled={page >= list.data.meta.last_page} onClick={() => setPage(p => p + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit farmer</DialogTitle></DialogHeader>
          {editing && (
            <FarmerForm
              initial={editing}
              busy={update.isPending}
              onSubmit={async (v) => {
                try { await update.mutateAsync({ id: editing.id, payload: v }); setEditing(null); toast({ title: "Updated" }); }
                catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ApiFarmers() {
  return (
    <LaravelAuthProvider>
      <FarmersInner />
    </LaravelAuthProvider>
  );
}
