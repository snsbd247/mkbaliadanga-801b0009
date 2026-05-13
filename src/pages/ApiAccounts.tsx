import { useState } from "react";
import { ApiShell } from "@/components/api/ApiShell";
import { useAccounts, useCreateAccount } from "@/hooks/useAccountingApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

const TYPES = ["asset", "liability", "equity", "income", "expense"] as const;

export default function ApiAccounts() {
  const { data, isLoading } = useAccounts();
  const create = useCreateAccount();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", name_bn: "", type: "asset" as typeof TYPES[number] });

  const submit = async () => {
    try {
      await create.mutateAsync(form);
      toast.success("Account created");
      setOpen(false);
      setForm({ code: "", name: "", name_bn: "", type: "asset" });
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <ApiShell>
      <div className="container mx-auto p-4 space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Chart of Accounts</CardTitle>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button>New Account</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create Account</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Code</Label><Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} /></div>
                  <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                  <div><Label>Name (Bangla)</Label><Input value={form.name_bn} onChange={e => setForm({ ...form, name_bn: e.target.value })} /></div>
                  <div>
                    <Label>Type</Label>
                    <Select value={form.type} onValueChange={(v: any) => setForm({ ...form, type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Button className="w-full" onClick={submit} disabled={create.isPending}>Save</Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {isLoading ? <p>Loading…</p> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Code</TableHead><TableHead>Name</TableHead>
                  <TableHead>Bangla</TableHead><TableHead>Type</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {data?.map(a => (
                    <TableRow key={a.id}>
                      <TableCell>{a.code}</TableCell>
                      <TableCell>{a.name}</TableCell>
                      <TableCell>{a.name_bn || "-"}</TableCell>
                      <TableCell className="capitalize">{a.type}</TableCell>
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
