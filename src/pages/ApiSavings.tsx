import { useState } from "react";
import { ApiShell } from "@/components/api/ApiShell";
import { useDeposit, useOpenSavings, useSavingsList, useWithdraw } from "@/hooks/useSavingsApi";
import { useFarmersList } from "@/hooks/useFarmersApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

function TxnDialog({
  accountId, kind, onDone,
}: { accountId: string; kind: "deposit" | "withdraw"; onDone: () => void }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const dep = useDeposit();
  const wd = useWithdraw();
  const { toast } = useToast();
  const busy = dep.isPending || wd.isPending;
  return (
    <form
      className="grid gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          const args = { id: accountId, amount: Number(amount), note: note || undefined };
          if (kind === "deposit") await dep.mutateAsync(args);
          else await wd.mutateAsync(args);
          toast({ title: kind === "deposit" ? "Deposited" : "Withdrawn" });
          onDone();
        } catch (err: any) {
          toast({ title: "Error", description: err.message, variant: "destructive" });
        }
      }}
    >
      <div className="space-y-1"><Label>Amount</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
      <div className="space-y-1"><Label>Note</Label><Input value={note} onChange={(e) => setNote(e.target.value)} /></div>
      <DialogFooter><Button type="submit" disabled={busy}>{kind === "deposit" ? "Deposit" : "Withdraw"}</Button></DialogFooter>
    </form>
  );
}

function Inner() {
  const [page, setPage] = useState(1);
  const [opening, setOpening] = useState(false);
  const [txn, setTxn] = useState<{ id: string; kind: "deposit" | "withdraw" } | null>(null);
  const list = useSavingsList({ page, per_page: 20 });
  const farmers = useFarmersList({ per_page: 200 });
  const open = useOpenSavings();
  const { toast } = useToast();
  const [farmerId, setFarmerId] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");

  return (
    <div className="container mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Savings</h1>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Accounts</CardTitle>
          <Dialog open={opening} onOpenChange={setOpening}>
            <DialogTrigger asChild><Button>Open Account</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Open savings account</DialogTitle></DialogHeader>
              <form
                className="grid gap-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await open.mutateAsync({ farmer_id: farmerId, opening_balance: openingBalance ? Number(openingBalance) : undefined });
                    setOpening(false); setFarmerId(""); setOpeningBalance("");
                    toast({ title: "Account opened" });
                  } catch (err: any) {
                    toast({ title: "Error", description: err.message, variant: "destructive" });
                  }
                }}
              >
                <div className="space-y-1">
                  <Label>Farmer</Label>
                  <Select value={farmerId} onValueChange={setFarmerId}>
                    <SelectTrigger><SelectValue placeholder="Select farmer" /></SelectTrigger>
                    <SelectContent>
                      {farmers.data?.data.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.code} — {f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Opening balance (optional)</Label><Input type="number" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} /></div>
                <DialogFooter><Button type="submit" disabled={open.isPending}>{open.isPending ? "…" : "Open"}</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {list.isLoading ? <div>Loading…</div> : list.error ? <div className="text-destructive">{(list.error as Error).message}</div> : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account#</TableHead><TableHead>Farmer</TableHead>
                    <TableHead>Balance</TableHead><TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.data?.data.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.account_no}</TableCell>
                      <TableCell>{s.farmer_id.slice(0, 8)}…</TableCell>
                      <TableCell>{s.balance}</TableCell>
                      <TableCell>{s.status}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="icon" variant="ghost" title="Deposit" onClick={() => setTxn({ id: s.id, kind: "deposit" })}>
                          <ArrowDownToLine className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" title="Withdraw" onClick={() => setTxn({ id: s.id, kind: "withdraw" })}>
                          <ArrowUpFromLine className="h-4 w-4" />
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

      <Dialog open={!!txn} onOpenChange={(o) => !o && setTxn(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{txn?.kind === "deposit" ? "Deposit" : "Withdraw"}</DialogTitle></DialogHeader>
          {txn && <TxnDialog accountId={txn.id} kind={txn.kind} onDone={() => setTxn(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ApiSavings() {
  return <ApiShell><Inner /></ApiShell>;
}
