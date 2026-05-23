import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, ArrowRightLeft, Banknote } from "lucide-react";
import { toast } from "sonner";
import { money, fmtDate } from "@/lib/format";
import { useAuth } from "@/auth/AuthProvider";

const sb = supabase as any;
const TXN_TYPES = ["deposit", "withdraw", "charge", "interest"] as const;

export default function BankAccounts() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [txns, setTxns] = useState<any[]>([]);
  const [openA, setOpenA] = useState(false);
  const [openT, setOpenT] = useState(false);
  const [openX, setOpenX] = useState(false); // transfer

  const [a, setA] = useState<any>({ bank_name: "", branch: "", account_no: "", account_title: "", account_type: "savings", opening_balance: 0, is_active: true });
  const [tx, setTx] = useState<any>({ bank_account_id: "", txn_type: "deposit", amount: 0, txn_date: new Date().toISOString().slice(0, 10), reference_no: "", note: "", post_cashbook: true });
  const [xf, setXf] = useState<any>({ from_id: "", to_id: "", amount: 0, txn_date: new Date().toISOString().slice(0, 10), note: "" });

  useEffect(() => { document.title = "Bank Accounts — MK Baliadanga"; load(); }, []);

  async function load() {
    const [{ data: acc }, { data: trx }] = await Promise.all([
      sb.from("bank_accounts").select("*").order("bank_name"),
      sb.from("bank_transactions").select("*, account:bank_accounts!bank_transactions_bank_account_id_fkey(bank_name,account_no)").order("txn_date", { ascending: false }).limit(500),
    ]);
    setAccounts(acc ?? []); setTxns(trx ?? []);
  }

  const balances = useMemo(() => {
    const map = new Map<string, number>();
    accounts.forEach(ac => map.set(ac.id, Number(ac.opening_balance || 0)));
    txns.forEach(t => {
      const cur = map.get(t.bank_account_id) ?? 0;
      const sign = ["deposit", "transfer_in", "interest"].includes(t.txn_type) ? 1 : -1;
      map.set(t.bank_account_id, cur + sign * Number(t.amount));
    });
    return map;
  }, [accounts, txns]);

  const totalBal = useMemo(() => Array.from(balances.values()).reduce((a, b) => a + b, 0), [balances]);

  async function saveAccount() {
    if (!a.bank_name || !a.account_no) return toast.error("Bank name and account no required");
    const { error } = await sb.from("bank_accounts").insert(a);
    if (error) return toast.error(error.message);
    toast.success("Account added"); setOpenA(false); load();
    setA({ bank_name: "", branch: "", account_no: "", account_title: "", account_type: "savings", opening_balance: 0, is_active: true });
  }

  async function saveTxn() {
    if (!tx.bank_account_id || tx.amount <= 0) return toast.error("Account and amount required");
    const { post_cashbook, ...txnRow } = tx;
    const { error } = await sb.from("bank_transactions").insert({ ...txnRow, created_by: user?.id });
    if (error) return toast.error(error.message);

    // Auto-link to Cashbook: deposit (cash→bank) = expense; withdraw (bank→cash) = receipt
    if (post_cashbook && (tx.txn_type === "deposit" || tx.txn_type === "withdraw")) {
      const acc = accounts.find(a => a.id === tx.bank_account_id);
      const bankLabel = acc ? `${acc.bank_name} — ${acc.account_no}` : "Bank";
      const ref = tx.reference_no ? ` (Ref: ${tx.reference_no})` : "";
      const noteSuffix = tx.note ? ` · ${tx.note}` : "";
      if (tx.txn_type === "deposit") {
        const { error: eErr } = await supabase.from("expenses").insert({
          head: "Bank Deposit", payee: bankLabel, amount: tx.amount, method: "bank",
          note: `Cash deposited to ${bankLabel}${ref}${noteSuffix}`,
          expense_date: tx.txn_date, created_by: user?.id,
        } as any);
        if (eErr) toast.error("Saved bank txn but cashbook expense failed: " + eErr.message);
      } else {
        const { error: rErr } = await supabase.from("receipts").insert({
          kind: "other", amount: tx.amount, method: "bank",
          note: `Cash withdrawn from ${bankLabel}${ref}${noteSuffix}`,
          receipt_date: tx.txn_date, collected_by: user?.id,
        } as any);
        if (rErr) toast.error("Saved bank txn but cashbook receipt failed: " + rErr.message);
      }
    }

    toast.success("Saved"); setOpenT(false); load();
    setTx({ bank_account_id: "", txn_type: "deposit", amount: 0, txn_date: new Date().toISOString().slice(0, 10), reference_no: "", note: "", post_cashbook: true });
  }

  async function saveTransfer() {
    if (!xf.from_id || !xf.to_id || xf.from_id === xf.to_id) return toast.error("Pick two different accounts");
    if (xf.amount <= 0) return toast.error("Amount required");
    const group = crypto.randomUUID();
    const common = { amount: xf.amount, txn_date: xf.txn_date, note: xf.note, transfer_group: group, created_by: user?.id };
    const { error } = await sb.from("bank_transactions").insert([
      { ...common, bank_account_id: xf.from_id, txn_type: "transfer_out", counterparty_account_id: xf.to_id },
      { ...common, bank_account_id: xf.to_id, txn_type: "transfer_in", counterparty_account_id: xf.from_id },
    ]);
    if (error) return toast.error(error.message);
    toast.success("Transfer recorded"); setOpenX(false); load();
    setXf({ from_id: "", to_id: "", amount: 0, txn_date: new Date().toISOString().slice(0, 10), note: "" });
  }

  return (
    <>
      <PageHeader
        title="ব্যাংক অ্যাকাউন্ট (Bank Accounts)"
        description={`Total balance: ${money(totalBal)}`}
        actions={
          <>
            <Dialog open={openA} onOpenChange={setOpenA}>
              <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" />Account</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Bank Account</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><Label>Bank Name</Label><Input value={a.bank_name} onChange={e => setA({ ...a, bank_name: e.target.value })} placeholder="Sonali Bank" /></div>
                  <div><Label>Branch</Label><Input value={a.branch} onChange={e => setA({ ...a, branch: e.target.value })} /></div>
                  <div><Label>Account No</Label><Input value={a.account_no} onChange={e => setA({ ...a, account_no: e.target.value })} /></div>
                  <div><Label>Account Title</Label><Input value={a.account_title} onChange={e => setA({ ...a, account_title: e.target.value })} /></div>
                  <div><Label>Type</Label>
                    <Select value={a.account_type} onValueChange={v => setA({ ...a, account_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="savings">Savings</SelectItem>
                        <SelectItem value="current">Current</SelectItem>
                        <SelectItem value="fdr">FDR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2"><Label>Opening Balance</Label><Input type="number" value={a.opening_balance || ""} onChange={e => setA({ ...a, opening_balance: +e.target.value })} /></div>
                </div>
                <DialogFooter><Button variant="outline" onClick={() => setOpenA(false)}>Cancel</Button><Button onClick={saveAccount}>Save</Button></DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={openT} onOpenChange={setOpenT}>
              <DialogTrigger asChild><Button size="sm" variant="outline"><Banknote className="h-4 w-4 mr-1" />Transaction</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New Transaction</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><Label>Account</Label>
                    <Select value={tx.bank_account_id} onValueChange={v => setTx({ ...tx, bank_account_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{accounts.map(x => <SelectItem key={x.id} value={x.id}>{x.bank_name} — {x.account_no}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Type</Label>
                    <Select value={tx.txn_type} onValueChange={v => setTx({ ...tx, txn_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TXN_TYPES.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Amount</Label><Input type="number" value={tx.amount || ""} onChange={e => setTx({ ...tx, amount: +e.target.value })} /></div>
                  <div><Label>Date</Label><Input type="date" value={tx.txn_date} onChange={e => setTx({ ...tx, txn_date: e.target.value })} /></div>
                  <div><Label>Reference</Label><Input value={tx.reference_no} onChange={e => setTx({ ...tx, reference_no: e.target.value })} /></div>
                  <div className="col-span-2"><Label>Note</Label><Input value={tx.note} onChange={e => setTx({ ...tx, note: e.target.value })} /></div>
                </div>
                <DialogFooter><Button variant="outline" onClick={() => setOpenT(false)}>Cancel</Button><Button onClick={saveTxn}>Save</Button></DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={openX} onOpenChange={setOpenX}>
              <DialogTrigger asChild><Button size="sm"><ArrowRightLeft className="h-4 w-4 mr-1" />Transfer</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Bank-to-Bank Transfer</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>From</Label>
                    <Select value={xf.from_id} onValueChange={v => setXf({ ...xf, from_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Source" /></SelectTrigger>
                      <SelectContent>{accounts.map(x => <SelectItem key={x.id} value={x.id}>{x.bank_name} ({money(balances.get(x.id) ?? 0)})</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>To</Label>
                    <Select value={xf.to_id} onValueChange={v => setXf({ ...xf, to_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Destination" /></SelectTrigger>
                      <SelectContent>{accounts.map(x => <SelectItem key={x.id} value={x.id}>{x.bank_name} ({money(balances.get(x.id) ?? 0)})</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Amount</Label><Input type="number" value={xf.amount || ""} onChange={e => setXf({ ...xf, amount: +e.target.value })} /></div>
                  <div><Label>Date</Label><Input type="date" value={xf.txn_date} onChange={e => setXf({ ...xf, txn_date: e.target.value })} /></div>
                  <div className="col-span-2"><Label>Note</Label><Input value={xf.note} onChange={e => setXf({ ...xf, note: e.target.value })} /></div>
                </div>
                <DialogFooter><Button variant="outline" onClick={() => setOpenX(false)}>Cancel</Button><Button onClick={saveTransfer}>Transfer</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <Tabs defaultValue="accounts">
        <TabsList>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
        </TabsList>
        <TabsContent value="accounts">
          <Card className="overflow-x-auto"><Table>
            <TableHeader><TableRow>
              <TableHead>Bank</TableHead><TableHead>Branch</TableHead><TableHead>Account No</TableHead>
              <TableHead>Type</TableHead><TableHead className="text-right">Opening</TableHead>
              <TableHead className="text-right">Current Balance</TableHead><TableHead>Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {accounts.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No bank accounts yet</TableCell></TableRow>}
              {accounts.map(ac => (
                <TableRow key={ac.id}>
                  <TableCell className="font-medium">{ac.bank_name}</TableCell>
                  <TableCell>{ac.branch}</TableCell>
                  <TableCell className="font-mono text-xs">{ac.account_no}</TableCell>
                  <TableCell>{ac.account_type}</TableCell>
                  <TableCell className="text-right">{money(ac.opening_balance)}</TableCell>
                  <TableCell className="text-right font-bold">{money(balances.get(ac.id) ?? 0)}</TableCell>
                  <TableCell><Badge variant={ac.is_active ? "default" : "outline"}>{ac.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table></Card>
        </TabsContent>
        <TabsContent value="ledger">
          <Card className="overflow-x-auto"><Table>
            <TableHeader><TableRow>
              <TableHead>Date</TableHead><TableHead>Account</TableHead><TableHead>Type</TableHead>
              <TableHead className="text-right">Amount</TableHead><TableHead>Ref</TableHead><TableHead>Note</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {txns.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No transactions yet</TableCell></TableRow>}
              {txns.map(t => (
                <TableRow key={t.id}>
                  <TableCell>{fmtDate(t.txn_date)}</TableCell>
                  <TableCell className="text-sm">{t.account?.bank_name} — {t.account?.account_no}</TableCell>
                  <TableCell><Badge variant={["deposit", "transfer_in", "interest"].includes(t.txn_type) ? "default" : "destructive"}>{t.txn_type}</Badge></TableCell>
                  <TableCell className="text-right font-semibold">{money(t.amount)}</TableCell>
                  <TableCell className="font-mono text-xs">{t.reference_no}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{t.note}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table></Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
