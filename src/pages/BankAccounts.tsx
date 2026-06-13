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
import { Plus, ArrowRightLeft, Banknote, FileDown, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { money, fmtDate } from "@/lib/format";
import { useAuth } from "@/auth/AuthProvider";
import { exportTablePDF, exportExcel } from "@/lib/exports";
import { useLang } from "@/i18n/LanguageProvider";


const sb = supabase as any;
const TXN_TYPES = ["deposit", "withdraw", "charge", "interest"] as const;

const STREAMS: Array<{ value: string; label: string }> = [
  { value: "sech", label: "সেচ (মেইন)" },
  { value: "sech_small", label: "ছোট সেচ" },
  { value: "saving", label: "সেভিং" },
  { value: "other", label: "অন্যান্য" },
];
const streamLabel = (v?: string) => STREAMS.find(s => s.value === v)?.label ?? "অন্যান্য";

export default function BankAccounts() {
  const { user } = useAuth();
  const { t } = useLang();

  const [accounts, setAccounts] = useState<any[]>([]);
  const [txns, setTxns] = useState<any[]>([]);
  const [openA, setOpenA] = useState(false);
  const [openT, setOpenT] = useState(false);
  const [openX, setOpenX] = useState(false); // transfer

  const [a, setA] = useState<any>({ bank_name: "", branch: "", account_no: "", account_title: "", account_type: "savings", stream: "other", opening_balance: 0, is_active: true });
  const [tx, setTx] = useState<any>({ bank_account_id: "", txn_type: "deposit", amount: 0, txn_date: new Date().toISOString().slice(0, 10), reference_no: "", note: "", post_cashbook: true });
  const [xf, setXf] = useState<any>({ from_id: "", to_id: "", amount: 0, txn_date: new Date().toISOString().slice(0, 10), note: "" });

  const [dFrom, setDFrom] = useState("");
  const [dTo, setDTo] = useState("");
  const [dAccount, setDAccount] = useState<string>("__all__");

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
    setA({ bank_name: "", branch: "", account_no: "", account_title: "", account_type: "savings", stream: "other", opening_balance: 0, is_active: true });
  }

  async function isCashbookLocked(dateStr: string): Promise<boolean> {
    const d = new Date(dateStr);
    const year = d.getFullYear(), month = d.getMonth() + 1;
    const { data } = await sb.from("cashbook_submissions").select("id").eq("year", year).eq("month", month).eq("locked", true).limit(1);
    return (data?.length ?? 0) > 0;
  }

  async function saveTxn() {
    if (!tx.bank_account_id || tx.amount <= 0) return toast.error("Account and amount required");
    if (await isCashbookLocked(tx.txn_date)) return toast.error("এই মাসের ক্যাশবুক লক করা — ব্যাংক লেনদেন করা যাবে না");
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
    if (await isCashbookLocked(xf.txn_date)) return toast.error("এই মাসের ক্যাশবুক লক করা — ব্যাংক লেনদেন করা যাবে না");
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
        title={t("bankAccounts")}
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
                  <div className="col-span-2"><Label>স্ট্রিম (খাত)</Label>
                    <Select value={a.stream} onValueChange={v => setA({ ...a, stream: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{STREAMS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
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
                  {(tx.txn_type === "deposit" || tx.txn_type === "withdraw") && (
                    <label className="col-span-2 flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={!!tx.post_cashbook} onChange={e => setTx({ ...tx, post_cashbook: e.target.checked })} />
                      <span>Cashbook এ {tx.txn_type === "deposit" ? "expense (Bank Deposit)" : "receipt (Bank Withdraw)"} হিসেবে যোগ করুন</span>
                    </label>
                  )}
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
          <TabsTrigger value="deposits">Statement (জমা/উত্তোলন)</TabsTrigger>
          <TabsTrigger value="streams">৪ একাউন্ট (স্ট্রিম)</TabsTrigger>
        </TabsList>
        <TabsContent value="accounts">
          <Card className="overflow-x-auto"><Table>
            <TableHeader><TableRow>
              <TableHead>Bank</TableHead><TableHead>Branch</TableHead><TableHead>Account No</TableHead>
              <TableHead>Type</TableHead><TableHead>স্ট্রিম</TableHead><TableHead className="text-right">Opening</TableHead>
              <TableHead className="text-right">Current Balance</TableHead><TableHead>Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {accounts.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No bank accounts yet</TableCell></TableRow>}
              {accounts.map(ac => (
                <TableRow key={ac.id}>
                  <TableCell className="font-medium">{ac.bank_name}</TableCell>
                  <TableCell>{ac.branch}</TableCell>
                  <TableCell className="font-mono text-xs">{ac.account_no}</TableCell>
                  <TableCell>{ac.account_type}</TableCell>
                  <TableCell><Badge variant="outline">{streamLabel(ac.stream)}</Badge></TableCell>
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
        <TabsContent value="deposits">
          {(() => {
            const inRange = (t: any) => (!dFrom || t.txn_date >= dFrom) && (!dTo || t.txn_date <= dTo)
              && (dAccount === "__all__" || t.bank_account_id === dAccount);
            const isIn = (ty: string) => ["deposit", "transfer_in", "interest"].includes(ty);
            // opening balance = account openings + all transactions strictly before dFrom
            const accSubset = dAccount === "__all__" ? accounts : accounts.filter(a => a.id === dAccount);
            let opening = accSubset.reduce((s, a) => s + Number(a.opening_balance || 0), 0);
            txns.forEach((t: any) => {
              if (dAccount !== "__all__" && t.bank_account_id !== dAccount) return;
              if (dFrom && t.txn_date >= dFrom) return;
              opening += (isIn(t.txn_type) ? 1 : -1) * Number(t.amount || 0);
            });
            const rowsTxn = txns.filter(inRange).sort((a, b) => a.txn_date.localeCompare(b.txn_date));
            const totalIn = rowsTxn.filter(t => isIn(t.txn_type)).reduce((s, t) => s + Number(t.amount || 0), 0);
            const totalOut = rowsTxn.filter(t => !isIn(t.txn_type)).reduce((s, t) => s + Number(t.amount || 0), 0);
            const closing = opening + totalIn - totalOut;
            let run = opening;
            const display = rowsTxn.map((t: any) => {
              const inAmt = isIn(t.txn_type) ? Number(t.amount || 0) : 0;
              const outAmt = isIn(t.txn_type) ? 0 : Number(t.amount || 0);
              run += inAmt - outAmt;
              return { ...t, inAmt, outAmt, balance: run };
            });
            const headers = ["Date", "Bank", "Type", "জমা", "উত্তোলন", "Balance", "Note"];
            const pdfRows = display.map((t: any) => [
              fmtDate(t.txn_date), t.account?.bank_name ?? "", t.txn_type,
              t.inAmt || "", t.outAmt || "", t.balance, t.note ?? "",
            ]);
            return (
              <>
                <Card className="p-3 mb-3 flex flex-wrap items-end gap-3">
                  <div><Label>Bank</Label>
                    <Select value={dAccount} onValueChange={setDAccount}>
                      <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All Accounts</SelectItem>
                        {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.bank_name} — {a.account_no}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>From</Label><Input type="date" value={dFrom} onChange={e => setDFrom(e.target.value)} /></div>
                  <div><Label>To</Label><Input type="date" value={dTo} onChange={e => setDTo(e.target.value)} /></div>
                  <div className="ml-auto flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => exportTablePDF("Bank Statement", headers, pdfRows, { from: dFrom, to: dTo })}><FileDown className="h-4 w-4 mr-1" />PDF</Button>
                    <Button size="sm" variant="outline" onClick={() => exportExcel("bank-statement", "Statement", display.map((t: any) => ({ Date: t.txn_date, Bank: t.account?.bank_name, Type: t.txn_type, "জমা": t.inAmt, "উত্তোলন": t.outAmt, Balance: t.balance, Note: t.note })), { from: dFrom, to: dTo })}><FileSpreadsheet className="h-4 w-4 mr-1" />Excel</Button>
                  </div>
                </Card>
                <Card className="p-3 mb-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div><div className="text-xs text-muted-foreground">প্রারম্ভিক ব্যালেন্স</div><div className="text-lg font-bold">{money(opening)}</div></div>
                  <div><div className="text-xs text-muted-foreground">মোট জমা</div><div className="text-lg font-bold text-success">{money(totalIn)}</div></div>
                  <div><div className="text-xs text-muted-foreground">মোট উত্তোলন</div><div className="text-lg font-bold text-destructive">{money(totalOut)}</div></div>
                  <div><div className="text-xs text-muted-foreground">সমাপনী ব্যালেন্স</div><div className="text-lg font-bold text-primary">{money(closing)}</div></div>
                </Card>
                <Card className="overflow-x-auto"><Table>
                  <TableHeader><TableRow>
                    <TableHead>Date</TableHead><TableHead>Bank</TableHead><TableHead>Type</TableHead>
                    <TableHead className="text-right">জমা</TableHead><TableHead className="text-right">উত্তোলন</TableHead>
                    <TableHead className="text-right">Balance</TableHead><TableHead>Note</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    <TableRow className="bg-muted/40">
                      <TableCell colSpan={5} className="text-right font-medium">প্রারম্ভিক ব্যালেন্স</TableCell>
                      <TableCell className="text-right font-bold">{money(opening)}</TableCell>
                      <TableCell />
                    </TableRow>
                    {display.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No transactions in selected range</TableCell></TableRow>}
                    {display.map((t: any) => (
                      <TableRow key={t.id}>
                        <TableCell>{fmtDate(t.txn_date)}</TableCell>
                        <TableCell>{t.account?.bank_name}</TableCell>
                        <TableCell><Badge variant={t.inAmt ? "default" : "destructive"}>{t.txn_type}</Badge></TableCell>
                        <TableCell className="text-right text-success">{t.inAmt ? money(t.inAmt) : "—"}</TableCell>
                        <TableCell className="text-right text-destructive">{t.outAmt ? money(t.outAmt) : "—"}</TableCell>
                        <TableCell className="text-right font-semibold">{money(t.balance)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{t.note}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/60 font-bold">
                      <TableCell colSpan={3} className="text-right">মোট</TableCell>
                      <TableCell className="text-right text-success">{money(totalIn)}</TableCell>
                      <TableCell className="text-right text-destructive">{money(totalOut)}</TableCell>
                      <TableCell className="text-right text-primary">{money(closing)}</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table></Card>
              </>
            );
          })()}
        </TabsContent>

      </Tabs>
    </>
  );
}
