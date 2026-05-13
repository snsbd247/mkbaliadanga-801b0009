import { useState } from "react";
import { ApiShell } from "@/components/api/ApiShell";
import { useLoanPlans, useCreateLoanPlan, useDeleteLoanPlan } from "@/hooks/useCatalogApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function ApiLoanPlans() {
  const { data, isLoading } = useLoanPlans();
  const create = useCreateLoanPlan();
  const del = useDeleteLoanPlan();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", principal: 0, interest_rate: 0, tenure_months: 12, processing_fee: 0 });

  const submit = async () => {
    try { await create.mutateAsync(form); toast.success("Saved"); setOpen(false); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <ApiShell>
      <div className="container mx-auto p-4 space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Loan Plans</CardTitle>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button>New Plan</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create Loan Plan</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>Principal</Label><Input type="number" step="0.01" value={form.principal} onChange={e => setForm({ ...form, principal: Number(e.target.value) })} /></div>
                    <div><Label>Rate (%)</Label><Input type="number" step="0.01" value={form.interest_rate} onChange={e => setForm({ ...form, interest_rate: Number(e.target.value) })} /></div>
                    <div><Label>Tenure (months)</Label><Input type="number" value={form.tenure_months} onChange={e => setForm({ ...form, tenure_months: Number(e.target.value) })} /></div>
                    <div><Label>Processing Fee</Label><Input type="number" step="0.01" value={form.processing_fee} onChange={e => setForm({ ...form, processing_fee: Number(e.target.value) })} /></div>
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
                  <TableHead>Name</TableHead><TableHead className="text-right">Principal</TableHead>
                  <TableHead className="text-right">Rate</TableHead><TableHead className="text-right">Tenure</TableHead>
                  <TableHead className="text-right">Fee</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {data?.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-right">{Number(p.principal).toFixed(2)}</TableCell>
                      <TableCell className="text-right">{p.interest_rate}%</TableCell>
                      <TableCell className="text-right">{p.tenure_months}m</TableCell>
                      <TableCell className="text-right">{Number(p.processing_fee || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => confirm("Delete?") && del.mutate(p.id)}>
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
