import { useState } from "react";
import { ApiShell } from "@/components/api/ApiShell";
import { useCreatePayment, useDeletePayment, usePaymentsList } from "@/hooks/usePaymentsApi";
import { useFarmersList } from "@/hooks/useFarmersApi";
import { useLoansList } from "@/hooks/useLoansApi";
import { useSavingsList } from "@/hooks/useSavingsApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus } from "lucide-react";
import type { PaymentAllocation } from "@/lib/api/payments";

function CreatePaymentForm({ onDone }: { onDone: () => void }) {
  const create = useCreatePayment();
  const farmers = useFarmersList({ per_page: 200 });
  const { toast } = useToast();
  const [farmerId, setFarmerId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"cash" | "bank" | "mobile" | "cheque">("cash");
  const [reference, setReference] = useState("");
  const [allocs, setAllocs] = useState<PaymentAllocation[]>([]);
  const loans = useLoansList({ farmer_id: farmerId || undefined, per_page: 100 });
  const savings = useSavingsList({ farmer_id: farmerId || undefined, per_page: 100 });

  const totalAlloc = allocs.reduce((s, a) => s + (Number(a.amount) || 0), 0);
  const remaining = (Number(amount) || 0) - totalAlloc;

  return (
    <form
      className="grid gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (Math.abs(remaining) > 0.01) {
          toast({ title: "Allocation mismatch", description: `Remaining: ${remaining}`, variant: "destructive" });
          return;
        }
        try {
          await create.mutateAsync({
            farmer_id: farmerId,
            amount: Number(amount),
            method,
            reference: reference || undefined,
            allocations: allocs,
          });
          toast({ title: "Payment recorded" });
          onDone();
        } catch (err: any) {
          toast({ title: "Error", description: err.message, variant: "destructive" });
        }
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Farmer</Label>
          <Select value={farmerId} onValueChange={(v) => { setFarmerId(v); setAllocs([]); }}>
            <SelectTrigger><SelectValue placeholder="Select farmer" /></SelectTrigger>
            <SelectContent>
              {farmers.data?.data.map((f) => <SelectItem key={f.id} value={f.id}>{f.code} — {f.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label>Amount</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
        <div className="space-y-1">
          <Label>Method</Label>
          <Select value={method} onValueChange={(v: any) => setMethod(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="bank">Bank</SelectItem>
              <SelectItem value="mobile">Mobile</SelectItem>
              <SelectItem value="cheque">Cheque</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label>Reference</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} /></div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Allocations (remaining: {remaining.toFixed(2)})</Label>
          <Button type="button" size="sm" variant="outline" onClick={() => setAllocs([...allocs, { target_type: "loan", target_id: "", amount: 0 }])}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>
        {allocs.map((a, i) => {
          const opts =
            a.target_type === "loan" ? (loans.data?.data ?? []).map((l) => ({ id: l.id, label: `Loan ${l.id.slice(0, 8)} — ${l.principal}` })) :
            a.target_type === "savings" ? (savings.data?.data ?? []).map((s) => ({ id: s.id, label: `${s.account_no} (bal ${s.balance})` })) :
            [];
          return (
            <div key={i} className="grid grid-cols-[140px_1fr_120px_40px] gap-2">
              <Select value={a.target_type} onValueChange={(v: any) => {
                const next = [...allocs]; next[i] = { ...a, target_type: v, target_id: "" }; setAllocs(next);
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="loan">Loan</SelectItem>
                  <SelectItem value="savings">Savings</SelectItem>
                  <SelectItem value="irrigation_invoice">Irrigation</SelectItem>
                </SelectContent>
              </Select>
              {a.target_type === "irrigation_invoice" ? (
                <Input placeholder="Invoice ID" value={a.target_id} onChange={(e) => { const n = [...allocs]; n[i] = { ...a, target_id: e.target.value }; setAllocs(n); }} />
              ) : (
                <Select value={a.target_id} onValueChange={(v) => { const n = [...allocs]; n[i] = { ...a, target_id: v }; setAllocs(n); }}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {opts.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <Input type="number" step="0.01" value={a.amount} onChange={(e) => { const n = [...allocs]; n[i] = { ...a, amount: Number(e.target.value) }; setAllocs(n); }} />
              <Button type="button" size="icon" variant="ghost" onClick={() => setAllocs(allocs.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
            </div>
          );
        })}
      </div>

      <DialogFooter><Button type="submit" disabled={create.isPending}>{create.isPending ? "Saving…" : "Record payment"}</Button></DialogFooter>
    </form>
  );
}

function Inner() {
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const list = usePaymentsList({ page, per_page: 20 });
  const del = useDeletePayment();
  const { toast } = useToast();

  return (
    <div className="container mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Payments</h1>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent payments</CardTitle>
          <Dialog open={creating} onOpenChange={setCreating}>
            <DialogTrigger asChild><Button>New Payment</Button></DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader>
              <CreatePaymentForm onDone={() => setCreating(false)} />
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {list.isLoading ? <div>Loading…</div> : list.error ? <div className="text-destructive">{(list.error as Error).message}</div> : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Receipt#</TableHead><TableHead>Farmer</TableHead>
                    <TableHead>Amount</TableHead><TableHead>Method</TableHead>
                    <TableHead>Date</TableHead><TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.data?.data.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.receipt_no ?? p.id.slice(0, 8)}</TableCell>
                      <TableCell>{p.farmer_id.slice(0, 8)}…</TableCell>
                      <TableCell>{p.amount}</TableCell>
                      <TableCell>{p.method}</TableCell>
                      <TableCell>{p.occurred_at?.slice(0, 10)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={async () => {
                          if (!confirm("Delete payment? Ledger will reverse.")) return;
                          try { await del.mutateAsync(p.id); toast({ title: "Deleted" }); }
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

export default function ApiPayments() {
  return <ApiShell><Inner /></ApiShell>;
}
