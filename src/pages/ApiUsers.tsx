import { useMemo, useState } from "react";
import { ApiShell } from "@/components/api/ApiShell";
import {
  useUsers, useCreateUser, useUpdateUser, useDeleteUser,
  useRoles, useAssignRole, useRemoveRole,
} from "@/hooks/useAdminApi";
import { useOffices } from "@/hooks/useAdminApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Trash2, Shield } from "lucide-react";
import { toast } from "sonner";

export default function ApiUsers() {
  const [q, setQ] = useState("");
  const { data, isLoading } = useUsers({ q: q || undefined, per_page: 50 });
  const { data: roles } = useRoles();
  const { data: offices } = useOffices();
  const create = useCreateUser();
  const del = useDeleteUser();
  const assign = useAssignRole();
  const remove = useRemoveRole();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", office_id: "" });

  const submit = async () => {
    try {
      await create.mutateAsync({ ...form, office_id: form.office_id || undefined });
      toast.success("User created");
      setOpen(false);
      setForm({ name: "", email: "", phone: "", password: "", office_id: "" });
    } catch (e: any) { toast.error(e.message); }
  };

  const rows = useMemo(() => data?.data ?? [], [data]);

  return (
    <ApiShell>
      <div className="container mx-auto p-4 space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>Users</CardTitle>
            <div className="flex gap-2">
              <Input placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} className="w-56" />
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild><Button>New User</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Create User</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                    <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                    <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
                    <div><Label>Password</Label><Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></div>
                    <div>
                      <Label>Office</Label>
                      <Select value={form.office_id} onValueChange={v => setForm({ ...form, office_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                        <SelectContent>
                          {offices?.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
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
                  <TableHead>Name</TableHead><TableHead>Email</TableHead>
                  <TableHead>Roles</TableHead><TableHead className="text-right">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {rows.map(u => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {u.roles?.map(r => (
                            <Badge key={r.id} variant="secondary" className="cursor-pointer"
                              onClick={() => remove.mutate({ id: u.id, roleId: r.id })}>
                              {r.name} ✕
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Select onValueChange={v => assign.mutate({ id: u.id, role_id: v })}>
                          <SelectTrigger className="inline-flex w-auto h-8 mr-1"><Shield className="h-4 w-4" /></SelectTrigger>
                          <SelectContent>
                            {roles?.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon"
                          onClick={() => confirm(`Delete ${u.name}?`) && del.mutate(u.id)}>
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
