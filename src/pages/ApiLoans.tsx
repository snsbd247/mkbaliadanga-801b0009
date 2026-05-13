import { useState } from "react";
import { ApiShell } from "@/components/api/ApiShell";
import { useApproveLoan, useCreateLoan, useDeleteLoan, useLoanPlans, useLoansList } from "@/hooks/useLoansApi";
import { useFarmersList } from "@/hooks/useFarmersApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Trash2, CheckCircle2 } from "lucide-react";

function Inner() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  const list = useLoansList({ page, per_page: 20, status: status || undefined });
  const farmers = useFarmersList({ per_page: 200 });
  const plans = useLoanPlans();
  const create = useCreateLoan();
  const approve = useApproveLoan();
  const del = useDeleteLoan();

  const [form, setForm] = useState({ farmer_id: "", loan_plan_id: "", principal: "", interest_rate: "", tenure_months: "" });

  return (
    <div className="container mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Loans</h1>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>List</CardTitle>
          <div className="flex gap-2">
            <Select value={status || "all"} onValueChange={(v) => { setStatus(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Dialog open={creating} onOpenChange={setCreating}>
              <DialogTrigger asChild><Button>New Loan</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create loan</DialogTitle></DialogHeader>
                <form
                  className="grid gap-3"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      await create.mutateAsync({
                        farmer_id: form.farmer_id,
                        loan_plan_id: form.loan_plan_id || undefined,
                        principal: Number(form.principal),
                        interest_rate: Number(form.interest_rate),
                        tenure_months: Number(form.tenure_months),
                      } as any);
                      setCreating(false);
                      setForm({ farmer_id: "", loan_plan_id: "", principal: "", interest_rate: "", tenure_months: "" });
                      toast({ title: "Loan created" });
                    } catch (err: any) {
                      toast({ title: "Error", description: err.message, variant: "destructive" });
                    }
                  }}
                >
                  <div className="space-y-1">
                    <Label>Farmer</Label>
                    <Select value={form.farmer_id} onValueChange={(v) => setForm({ ...form, farmer_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select farmer" /></SelectTrigger>
                      <SelectContent>
                        {farmers.data?.data.map((f) => (
                          <SelectItem key={f.id} value={f.id}>{f.code} — {f.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Plan (optional)</Label>
                    <Select
                      value={form.loan_plan_id}
                      onValueChange={(v) => {
                        const p = plans.data?.find((x) => x.id === v);
                        setForm({
                          ...form,
                          loan_plan_id: v,
                          interest_rate: p ? String(p.interest_rate) : form.interest_rate,
                          tenure_months: p ? String(p.tenure_months) : form.tenure_months,
                        });
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
                      <SelectContent>
                        {plans.data?.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name} ({p.interest_rate}%, {p.tenure_months}m)</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1"><Label>Principal</Label><Input type="number" value={form.principal} onChange={(e) => setForm({ ...form, principal: e.target.value })} required /></div>
                    <div className="space-y-1"><Label>Interest %</Label><Input type="number" step="0.01" value={form.interest_rate} onChange={(e) => setForm({ ...form, interest_rate: e.target.value })} required /></div>
                    <div className="space-y-1"><Label>Tenure (mo)</Label><Input type="number" value={form.tenure_months} onChange={(e) => setForm({ ...form, tenure_months: e.target.value })} required /></div>
                  </div>
                  <DialogFooter><Button type="submit" disabled={create.isPending}>{create.isPending ? "Saving…" : "Create"}</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {list.isLoading ? (
            <div>Loading…</div>
          ) : list.error ? (
            <div className="text-destructive">{(list.error as Error).message}</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Farmer</TableHead>
                    <TableHead>Principal</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead>Tenure</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Outstanding</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.data?.data.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>{l.farmer_id.slice(0, 8)}…</TableCell>
                      <TableCell>{l.principal}</TableCell>
                      <TableCell>{l.interest_rate}%</TableCell>
                      <TableCell>{l.tenure_months}m</TableCell>
                      <TableCell><Badge variant={l.status === "active" ? "default" : "secondary"}>{l.status}</Badge></TableCell>
                      <TableCell>{l.outstanding ?? "—"}</TableCell>
                      <TableCell className="text-right space-x-1">
                        {l.status === "pending" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Approve"
                            onClick={async () => {
                              try { await approve.mutateAsync(l.id); toast({ title: "Approved" }); }
                              catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
                            }}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={async () => {
                            if (!confirm("Delete loan?")) return;
                            try { await del.mutateAsync(l.id); toast({ title: "Deleted" }); }
                            catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {list.data?.meta && (
                <div className="flex justify-between items-center mt-4 text-sm">
                  <span>Page {list.data.meta.current_page} / {list.data.meta.last_page} · {list.data.meta.total} total</span>
                  <div className="space-x-2">
                    <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
                    <Button size="sm" variant="outline" disabled={page >= list.data.meta.last_page} onClick={() => setPage((p) => p + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ApiLoans() {
  return <ApiShell><Inner /></ApiShell>;
}
