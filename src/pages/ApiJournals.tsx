import { useMemo, useState } from "react";
import { ApiShell } from "@/components/api/ApiShell";
import { useJournals, useCreateJournal, useAccounts } from "@/hooks/useAccountingApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

type Line = { account_id: string; debit: number; credit: number; memo?: string };

export default function ApiJournals() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { data, isLoading } = useJournals({ from: from || undefined, to: to || undefined, per_page: 50 });
  const { data: accounts } = useAccounts();
  const create = useCreateJournal();

  const [open, setOpen] = useState(false);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState("");
  const [reference, setReference] = useState("");
  const [lines, setLines] = useState<Line[]>([
    { account_id: "", debit: 0, credit: 0 },
    { account_id: "", debit: 0, credit: 0 },
  ]);

  const totals = useMemo(() => lines.reduce(
    (a, l) => ({ d: a.d + Number(l.debit || 0), c: a.c + Number(l.credit || 0) }), { d: 0, c: 0 }
  ), [lines]);
  const balanced = Math.abs(totals.d - totals.c) < 0.01 && totals.d > 0;

  const submit = async () => {
    if (!balanced) return toast.error("Debit & Credit must match");
    if (lines.some(l => !l.account_id)) return toast.error("All lines need an account");
    try {
      await create.mutateAsync({ entry_date: entryDate, memo, reference, lines });
      toast.success("Journal posted");
      setOpen(false);
      setLines([{ account_id: "", debit: 0, credit: 0 }, { account_id: "", debit: 0, credit: 0 }]);
      setMemo(""); setReference("");
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <ApiShell>
      <div className="container mx-auto p-4 space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle>Journal Entries</CardTitle>
            <div className="flex items-end gap-2">
              <div><Label className="text-xs">From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
              <div><Label className="text-xs">To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild><Button>New Entry</Button></DialogTrigger>
                <DialogContent className="max-w-3xl">
                  <DialogHeader><DialogTitle>Post Journal Entry</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      <div><Label>Date</Label><Input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} /></div>
                      <div><Label>Reference</Label><Input value={reference} onChange={e => setReference(e.target.value)} /></div>
                      <div><Label>Memo</Label><Input value={memo} onChange={e => setMemo(e.target.value)} /></div>
                    </div>
                    <div className="space-y-2">
                      {lines.map((l, i) => (
                        <div key={i} className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-5">
                            <Select value={l.account_id} onValueChange={v => {
                              const n = [...lines]; n[i].account_id = v; setLines(n);
                            }}>
                              <SelectTrigger><SelectValue placeholder="Account" /></SelectTrigger>
                              <SelectContent>
                                {accounts?.map(a => <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <Input className="col-span-2" type="number" step="0.01" placeholder="Debit"
                            value={l.debit || ""} onChange={e => { const n = [...lines]; n[i].debit = Number(e.target.value); setLines(n); }} />
                          <Input className="col-span-2" type="number" step="0.01" placeholder="Credit"
                            value={l.credit || ""} onChange={e => { const n = [...lines]; n[i].credit = Number(e.target.value); setLines(n); }} />
                          <Input className="col-span-2" placeholder="Memo"
                            value={l.memo || ""} onChange={e => { const n = [...lines]; n[i].memo = e.target.value; setLines(n); }} />
                          <Button variant="ghost" size="icon" className="col-span-1"
                            onClick={() => setLines(lines.filter((_, x) => x !== i))} disabled={lines.length <= 2}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button variant="outline" size="sm"
                        onClick={() => setLines([...lines, { account_id: "", debit: 0, credit: 0 }])}>
                        <Plus className="h-4 w-4 mr-1" /> Add line
                      </Button>
                    </div>
                    <div className="flex justify-between text-sm border-t pt-2">
                      <span>Debit: <b>{totals.d.toFixed(2)}</b></span>
                      <span>Credit: <b>{totals.c.toFixed(2)}</b></span>
                      <span className={balanced ? "text-primary" : "text-destructive"}>
                        {balanced ? "✓ Balanced" : `Diff: ${Math.abs(totals.d - totals.c).toFixed(2)}`}
                      </span>
                    </div>
                    <Button className="w-full" onClick={submit} disabled={!balanced || create.isPending}>Post Entry</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? <p>Loading…</p> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Date</TableHead><TableHead>Reference</TableHead>
                  <TableHead>Memo</TableHead><TableHead>Lines</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {data?.data?.map(j => {
                    const total = j.lines.reduce((a, l) => a + Number(l.debit || 0), 0);
                    return (
                      <TableRow key={j.id}>
                        <TableCell>{j.entry_date}</TableCell>
                        <TableCell>{j.reference || "-"}</TableCell>
                        <TableCell>{j.memo || "-"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {j.lines.map(l => `${l.account?.code ?? ""}`).join(", ")}
                        </TableCell>
                        <TableCell className="text-right font-medium">{total.toFixed(2)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </ApiShell>
  );
}
