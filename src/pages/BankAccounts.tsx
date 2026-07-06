import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, ArrowRightLeft, Banknote, FileDown, FileSpreadsheet, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { money, fmtDate } from "@/lib/format";
import { useAuth } from "@/auth/AuthProvider";
import { exportTablePDF, exportExcel } from "@/lib/exports";
import { useLang } from "@/i18n/LanguageProvider";
import { logAudit } from "@/lib/audit";
import { postBankOpening } from "@/lib/accountingPosting";


const sb = db as any;
const TXN_TYPES = ["deposit", "withdraw", "charge", "interest"] as const;

const STREAMS: Array<{ value: string; label: string }> = [
  { value: "sech", label: "সেচ (মেইন)" },
  { value: "sech_small", label: "ছোট সেচ" },
  { value: "saving", label: "সেভিং" },
  { value: "other", label: "অন্যান্য" },
];
const streamLabel = (v?: string) => STREAMS.find(s => s.value === v)?.label ?? "অন্যান্য";

// Map a bank account's stream to a cashbook cash stream so deposits/withdrawals
// post to the correct cash (সেচ vs সেভিং). Irrigation accounts → irrigation cash.
type CashStream = "irrigation" | "savings";
const cashbookStreamForAccount = (accStream?: string): CashStream =>
  (accStream === "sech" || accStream === "sech_small") ? "irrigation" : "savings";

export default function BankAccounts() {
  const { user } = useAuth();
  const { t } = useLang();

  const [accounts, setAccounts] = useState<any[]>([]);
  const [txns, setTxns] = useState<any[]>([]);
  const [openA, setOpenA] = useState(false);
  const [openT, setOpenT] = useState(false);
  const [openX, setOpenX] = useState(false); // transfer
  const [editAccId, setEditAccId] = useState<string | null>(null);
  const [editTxn, setEditTxn] = useState<any | null>(null);
  const [pendingDelete, setPendingDelete] = useState<
    | { kind: "account"; item: any }
    | { kind: "txn"; item: any }
    | null
  >(null);
  const [deleting, setDeleting] = useState(false);

  const [a, setA] = useState<any>({ bank_name: "", branch: "", account_no: "", account_title: "", account_type: "savings", stream: "other", opening_balance: 0, is_active: true });
  const [tx, setTx] = useState<any>({ bank_account_id: "", txn_type: "deposit", amount: 0, txn_date: new Date().toISOString().slice(0, 10), reference_no: "", note: "", post_cashbook: true });
  const [xf, setXf] = useState<any>({ from_id: "", to_id: "", amount: 0, txn_date: new Date().toISOString().slice(0, 10), note: "" });

  const [dFrom, setDFrom] = useState("");
  const [dTo, setDTo] = useState("");
  const [dAccount, setDAccount] = useState<string>("__all__");

  // Opening-post status + audit + preview
  const [openingStatus, setOpeningStatus] = useState<{ journalCount: number; ledgerCount: number; lastRun: string | null }>({ journalCount: 0, ledgerCount: 0, lastRun: null });
  const [openingAudit, setOpeningAudit] = useState<any[]>([]);
  const [openingPreview, setOpeningPreview] = useState<
    | { toPost: any[]; existing: any[] }
    | null
  >(null);
  const [posting, setPosting] = useState(false);



  useEffect(() => { document.title = "Bank Accounts — MK Baliadanga"; load(); }, []);

  async function load() {
    const [{ data: acc }, { data: trx }] = await Promise.all([
      sb.from("bank_accounts").select("*").order("bank_name"),
      sb.from("bank_transactions").select("*, account:bank_accounts!bank_transactions_bank_account_id_fkey(bank_name,account_no)").order("txn_date", { ascending: false }).limit(500),
    ]);
    setAccounts(acc ?? []); setTxns(trx ?? []);
    void loadOpeningStatus();
  }

  // Load opening-post ledger status (journal + ledger entry counts, last run)
  // and the bank-opening audit trail.
  async function loadOpeningStatus() {
    try {
      const [{ data: journals }, { data: audit }] = await Promise.all([
        sb.from("journal_entries").select("id,posted_at,created_at").like("reference", "OPENING-BANK-%").is("deleted_at", null),
        sb.from("system_audit_logs").select("*").eq("module", "bank_opening").order("created_at", { ascending: false }).limit(50),
      ]);
      const jids = (journals ?? []).map((j: any) => j.id);
      let ledgerCount = 0;
      if (jids.length) {
        const { count } = await sb.from("ledger_entries").select("id", { count: "exact", head: true }).eq("reference_type", "journal").in("reference_id", jids);
        ledgerCount = count ?? 0;
      }
      const lastRun = (journals ?? []).reduce((mx: string | null, j: any) => {
        const t = j.posted_at || j.created_at;
        return !mx || (t && t > mx) ? t : mx;
      }, null as string | null);
      setOpeningStatus({ journalCount: jids.length, ledgerCount, lastRun });
      setOpeningAudit(audit ?? []);
    } catch { /* status is best-effort */ }
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

  const emptyAccount = () => ({ bank_name: "", branch: "", account_no: "", account_title: "", account_type: "savings", stream: "other", opening_balance: 0, is_active: true });

  function openAddAccount() { setEditAccId(null); setA(emptyAccount()); setOpenA(true); }
  function openEditAccount(ac: any) {
    setEditAccId(ac.id);
    setA({ bank_name: ac.bank_name ?? "", branch: ac.branch ?? "", account_no: ac.account_no ?? "", account_title: ac.account_title ?? "", account_type: ac.account_type ?? "savings", stream: ac.stream ?? "other", opening_balance: ac.opening_balance ?? 0, is_active: ac.is_active ?? true });
    setOpenA(true);
  }

  async function saveAccount() {
    if (!a.bank_name || !a.account_no) return toast.error("Bank name and account no required");
    if (editAccId) {
      const prev = accounts.find(x => x.id === editAccId) ?? null;
      const { error } = await sb.from("bank_accounts").update(a).eq("id", editAccId);
      if (error) return toast.error("আপডেট ব্যর্থ: " + error.message);
      void logAudit({ office_id: (prev as any)?.office_id ?? null, module: "bank_account", action_type: "update", reference_id: editAccId, old_data: prev, new_data: a });
      // Re-post opening journal only when the opening balance actually changed.
      if (Number(prev?.opening_balance || 0) !== Number(a.opening_balance || 0)) {
        void postBankOpening({ bankAccountId: editAccId, openingBalance: Number(a.opening_balance || 0), bankLabel: `${a.bank_name} ${a.account_no}`, officeId: (prev as any)?.office_id ?? null, createdBy: user?.id, force: true });
      }
      toast.success("Account updated");
    } else {
      const { data, error } = await sb.from("bank_accounts").insert(a).select();
      if (error) return toast.error("যোগ ব্যর্থ: " + error.message);
      const created = Array.isArray(data) ? data[0] : data;
      void logAudit({ office_id: created?.office_id ?? null, module: "bank_account", action_type: "create", reference_id: created?.id ?? null, new_data: created ?? a });
      if (created?.id) {
        void postBankOpening({ bankAccountId: created.id, openingBalance: Number(created.opening_balance || 0), bankLabel: `${a.bank_name} ${a.account_no}`, officeId: created?.office_id ?? null, createdBy: user?.id });
      }
      toast.success("Account added");
    }
    setOpenA(false); setEditAccId(null); load();
    setA(emptyAccount());
  }

  // Step 1 — build a preview of what the backfill will change (which accounts
  // will get a new opening journal vs. which already have one). Shown in a
  // confirmation dialog before anything is written.
  async function previewOpenings() {
    const list = accounts.filter(ac => Number(ac.opening_balance || 0) !== 0);
    if (list.length === 0) return toast.info("কোন ওপেনিং ব্যালেন্স নেই");
    const { data: journals } = await sb.from("journal_entries").select("reference").like("reference", "OPENING-BANK-%").is("deleted_at", null);
    const posted = new Set((journals ?? []).map((j: any) => String(j.reference)));
    const toPost: any[] = [];
    const existing: any[] = [];
    for (const ac of list) {
      (posted.has(`OPENING-BANK-${ac.id}`) ? existing : toPost).push(ac);
    }
    setOpeningPreview({ toPost, existing });
  }

  // Step 2 — run the backfill after the user confirms, then record an audit log.
  async function runOpenings() {
    if (!openingPreview) return;
    setPosting(true);
    let posted = 0, existed = 0;
    const details: any[] = [];
    try {
      for (const ac of [...openingPreview.toPost, ...openingPreview.existing]) {
        const res = await postBankOpening({ bankAccountId: ac.id, openingBalance: Number(ac.opening_balance || 0), bankLabel: `${ac.bank_name} ${ac.account_no}`, officeId: ac.office_id ?? null, createdBy: user?.id });
        if (res === "posted") { posted++; details.push({ bank_account_id: ac.id, bank: `${ac.bank_name} ${ac.account_no}`, opening_balance: Number(ac.opening_balance || 0), result: res }); }
        else if (res === "exists") existed++;
      }
      void logAudit({ module: "bank_opening", action_type: "backfill", new_data: { total: openingPreview.toPost.length + openingPreview.existing.length, posted, already_existed: existed, accounts: details } });
      toast.success(`ওপেনিং পোস্ট সম্পন্ন — নতুন: ${posted}, আগে থেকেই ছিল: ${existed}`);
    } finally {
      setPosting(false);
      setOpeningPreview(null);
      load();
    }
  }


  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      if (pendingDelete.kind === "account") {
        const ac = pendingDelete.item;
        const { error } = await sb.from("bank_accounts").delete().eq("id", ac.id);
        if (error) { toast.error("অ্যাকাউন্ট ডিলিট ব্যর্থ: " + error.message); return; }
        void logAudit({ office_id: ac.office_id ?? null, module: "bank_account", action_type: "delete", reference_id: ac.id, old_data: ac });
        toast.success("Account deleted");
      } else {
        const t = pendingDelete.item;
        const { error } = await sb.from("bank_transactions").delete().eq("id", t.id);
        if (error) { toast.error("লেনদেন ডিলিট ব্যর্থ: " + error.message); return; }
        // Remove any mirrored cashbook rows created with the same link_id.
        if (t.link_id) {
          await db.from("expenses").delete().eq("link_id", t.link_id);
          await db.from("receipts").delete().eq("link_id", t.link_id);
        }
        void logAudit({ office_id: t.office_id ?? null, module: "bank_transaction", action_type: "delete", reference_id: t.id, old_data: t });
        toast.success("Transaction deleted");
      }
      setPendingDelete(null); load();
    } finally {
      setDeleting(false);
    }
  }

  function deleteAccount(ac: any) { setPendingDelete({ kind: "account", item: ac }); }
  function deleteTxn(t: any) { setPendingDelete({ kind: "txn", item: t }); }

  async function saveEditTxn() {
    if (!editTxn) return;
    if (Number(editTxn.amount) <= 0) return toast.error("Amount required");
    const prev = txns.find(x => x.id === editTxn.id) ?? null;
    const changes = { txn_type: editTxn.txn_type, amount: editTxn.amount, txn_date: editTxn.txn_date, reference_no: editTxn.reference_no, note: editTxn.note };
    const { error } = await sb.from("bank_transactions").update(changes).eq("id", editTxn.id);
    if (error) return toast.error("লেনদেন আপডেট ব্যর্থ: " + error.message);
    void logAudit({ office_id: (prev as any)?.office_id ?? null, module: "bank_transaction", action_type: "update", reference_id: editTxn.id, old_data: prev, new_data: changes });
    toast.success("Transaction updated"); setEditTxn(null); load();
  }



  // Stream-aware lock: only the cash stream the bank account belongs to blocks the txn.
  async function isCashbookLocked(dateStr: string, stream?: CashStream): Promise<boolean> {
    const d = new Date(dateStr);
    const year = d.getFullYear(), month = d.getMonth() + 1;
    let q = sb.from("cashbook_submissions").select("id").eq("year", year).eq("month", month).eq("locked", true);
    if (stream) q = q.eq("stream", stream);
    const { data } = await q.limit(1);
    return (data?.length ?? 0) > 0;
  }

  async function saveTxn() {
    if (!tx.bank_account_id || tx.amount <= 0) return toast.error("Account and amount required");
    const acc = accounts.find(a => a.id === tx.bank_account_id);
    const cbStream = cashbookStreamForAccount(acc?.stream);
    if (await isCashbookLocked(tx.txn_date, cbStream)) return toast.error("এই মাসের ক্যাশবুক লক করা — ব্যাংক লেনদেন করা যাবে না");
    const { post_cashbook, ...txnRow } = tx;
    // Link the bank row with its mirrored cashbook row so edits/deletes stay paired.
    const linkId = (post_cashbook && (tx.txn_type === "deposit" || tx.txn_type === "withdraw"))
      ? crypto.randomUUID() : null;
    const { error } = await sb.from("bank_transactions").insert({ ...txnRow, created_by: user?.id, link_id: linkId });
    if (error) return toast.error("লেনদেন সংরক্ষণ ব্যর্থ: " + error.message);
    void logAudit({ office_id: acc?.office_id ?? null, module: "bank_transaction", action_type: "create", reference_id: tx.bank_account_id, new_data: { ...txnRow, link_id: linkId } });

    // Auto-link to Cashbook: deposit (cash→bank) = expense; withdraw (bank→cash) = receipt.
    // Routed to the correct cash stream based on the bank account's stream.
    if (linkId) {
      const bankLabel = acc ? `${acc.bank_name} — ${acc.account_no}` : "Bank";
      const ref = tx.reference_no ? ` (Ref: ${tx.reference_no})` : "";
      const noteSuffix = tx.note ? ` · ${tx.note}` : "";
      if (tx.txn_type === "deposit") {
        const { error: eErr } = await db.from("expenses").insert({
          head: "Bank Deposit", payee: bankLabel, amount: tx.amount, method: "bank",
          note: `Cash deposited to ${bankLabel}${ref}${noteSuffix}`,
          expense_date: tx.txn_date, created_by: user?.id, stream: cbStream, link_id: linkId,
          is_bank_deposit: true, bank_account_id: tx.bank_account_id,
        } as any);
        if (eErr) toast.error("Saved bank txn but cashbook expense failed: " + eErr.message);
      } else {
        // irrigation accounts feed irrigation cash ("irrigation" kind); others feed savings ("other").
        const wKind = cbStream === "irrigation" ? "irrigation" : "other";
        const { error: rErr } = await db.from("receipts").insert({
          kind: wKind, amount: tx.amount, method: "bank",
          note: `Cash withdrawn from ${bankLabel}${ref}${noteSuffix}`,
          receipt_date: tx.txn_date, collected_by: user?.id, link_id: linkId,
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
    const fromAcc = accounts.find(a => a.id === xf.from_id);
    const toAcc = accounts.find(a => a.id === xf.to_id);
    const streams = new Set<CashStream>([cashbookStreamForAccount(fromAcc?.stream), cashbookStreamForAccount(toAcc?.stream)]);
    for (const s of streams) {
      if (await isCashbookLocked(xf.txn_date, s)) return toast.error("এই মাসের ক্যাশবুক লক করা — ব্যাংক লেনদেন করা যাবে না");
    }
    const group = crypto.randomUUID();
    const common = { amount: xf.amount, txn_date: xf.txn_date, note: xf.note, transfer_group: group, created_by: user?.id };
    const { error } = await sb.from("bank_transactions").insert([
      { ...common, bank_account_id: xf.from_id, txn_type: "transfer_out", counterparty_account_id: xf.to_id },
      { ...common, bank_account_id: xf.to_id, txn_type: "transfer_in", counterparty_account_id: xf.from_id },
    ]);
    if (error) return toast.error("ট্রান্সফার ব্যর্থ: " + error.message);
    void logAudit({ office_id: fromAcc?.office_id ?? null, module: "bank_transaction", action_type: "create", reference_id: group, new_data: { transfer_group: group, from_id: xf.from_id, to_id: xf.to_id, amount: xf.amount, txn_date: xf.txn_date } });
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
            <Button size="sm" variant="outline" onClick={previewOpenings}><Banknote className="h-4 w-4 mr-1" />ওপেনিং পোস্ট</Button>
            <Dialog open={openA} onOpenChange={(o) => { setOpenA(o); if (!o) setEditAccId(null); }}>
              <DialogTrigger asChild><Button size="sm" variant="outline" onClick={openAddAccount}><Plus className="h-4 w-4 mr-1" />Account</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editAccId ? "Edit Bank Account" : "Add Bank Account"}</DialogTitle></DialogHeader>
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
              <TableHead className="text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {accounts.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No bank accounts yet</TableCell></TableRow>}
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
                  <TableCell className="text-right whitespace-nowrap">
                    <Button size="icon" variant="ghost" onClick={() => openEditAccount(ac)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteAccount(ac)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
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
              <TableHead className="text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {txns.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No transactions yet</TableCell></TableRow>}
              {txns.map(t => (
                <TableRow key={t.id}>
                  <TableCell>{fmtDate(t.txn_date)}</TableCell>
                  <TableCell className="text-sm">{t.account?.bank_name} — {t.account?.account_no}</TableCell>
                  <TableCell><Badge variant={["deposit", "transfer_in", "interest"].includes(t.txn_type) ? "default" : "destructive"}>{t.txn_type}</Badge></TableCell>
                  <TableCell className="text-right font-semibold">{money(t.amount)}</TableCell>
                  <TableCell className="font-mono text-xs">{t.reference_no}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{t.note}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {["transfer_in", "transfer_out"].includes(t.txn_type) ? (
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteTxn(t)}><Trash2 className="h-4 w-4" /></Button>
                    ) : (
                      <>
                        <Button size="icon" variant="ghost" onClick={() => setEditTxn({ ...t })}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteTxn(t)}><Trash2 className="h-4 w-4" /></Button>
                      </>
                    )}
                  </TableCell>
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
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    <TableRow className="bg-muted/40">
                      <TableCell colSpan={5} className="text-right font-medium">প্রারম্ভিক ব্যালেন্স</TableCell>
                      <TableCell className="text-right font-bold">{money(opening)}</TableCell>
                      <TableCell colSpan={2} />
                    </TableRow>
                    {display.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No transactions in selected range</TableCell></TableRow>}
                    {display.map((t: any) => (
                      <TableRow key={t.id}>
                        <TableCell>{fmtDate(t.txn_date)}</TableCell>
                        <TableCell>{t.account?.bank_name}</TableCell>
                        <TableCell><Badge variant={t.inAmt ? "default" : "destructive"}>{t.txn_type}</Badge></TableCell>
                        <TableCell className="text-right text-success">{t.inAmt ? money(t.inAmt) : "—"}</TableCell>
                        <TableCell className="text-right text-destructive">{t.outAmt ? money(t.outAmt) : "—"}</TableCell>
                        <TableCell className="text-right font-semibold">{money(t.balance)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{t.note}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {["transfer_in", "transfer_out"].includes(t.txn_type) ? (
                            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteTxn(t)}><Trash2 className="h-4 w-4" /></Button>
                          ) : (
                            <>
                              <Button size="icon" variant="ghost" onClick={() => setEditTxn({ ...t })}><Pencil className="h-4 w-4" /></Button>
                              <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteTxn(t)}><Trash2 className="h-4 w-4" /></Button>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/60 font-bold">
                      <TableCell colSpan={3} className="text-right">মোট</TableCell>
                      <TableCell className="text-right text-success">{money(totalIn)}</TableCell>
                      <TableCell className="text-right text-destructive">{money(totalOut)}</TableCell>
                      <TableCell className="text-right text-primary">{money(closing)}</TableCell>
                      <TableCell colSpan={2} />
                    </TableRow>
                  </TableBody>
                </Table></Card>
              </>
            );
          })()}
        </TabsContent>

        <TabsContent value="streams">
          {(() => {
            const byStream = STREAMS.map(s => {
              const accs = accounts.filter(a => (a.stream ?? "other") === s.value);
              const opening = accs.reduce((sum, a) => sum + Number(a.opening_balance || 0), 0);
              const balance = accs.reduce((sum, a) => sum + (balances.get(a.id) ?? 0), 0);
              return { ...s, accs, opening, balance };
            });
            return (
              <Card className="overflow-x-auto p-3">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {byStream.map(col => (
                    <div key={col.value} className="rounded-lg border p-3">
                      <div className="font-semibold mb-2">{col.label}</div>
                      <div className="space-y-1 text-sm">
                        {col.accs.length === 0 && <div className="text-muted-foreground">কোনো একাউন্ট নেই</div>}
                        {col.accs.map(ac => (
                          <div key={ac.id} className="flex justify-between gap-2">
                            <span className="truncate">{ac.bank_name} <span className="text-xs text-muted-foreground">{ac.account_no}</span></span>
                            <span className="font-medium whitespace-nowrap">{money(balances.get(ac.id) ?? 0)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 pt-2 border-t flex justify-between text-sm">
                        <span className="text-muted-foreground">প্রারম্ভিক</span><span>{money(col.opening)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-primary">
                        <span>বর্তমান</span><span>{money(col.balance)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex justify-end">
                  <Button size="sm" variant="outline" onClick={() => exportTablePDF("Bank Stream Summary", ["স্ট্রিম", "প্রারম্ভিক", "বর্তমান ব্যালেন্স"], byStream.map(c => [c.label, c.opening, c.balance]))}><FileDown className="h-4 w-4 mr-1" />PDF</Button>
                </div>
              </Card>
            );
          })()}
        </TabsContent>

      </Tabs>

      <Dialog open={!!editTxn} onOpenChange={(o) => { if (!o) setEditTxn(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Transaction</DialogTitle></DialogHeader>
          {editTxn && (
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Type</Label>
                <Select value={editTxn.txn_type} onValueChange={(v) => setEditTxn({ ...editTxn, txn_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TXN_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Amount</Label><Input type="number" value={editTxn.amount} onChange={e => setEditTxn({ ...editTxn, amount: Number(e.target.value) })} /></div>
              <div><Label>Date</Label><Input type="date" value={(editTxn.txn_date ?? "").slice(0, 10)} onChange={e => setEditTxn({ ...editTxn, txn_date: e.target.value })} /></div>
              <div><Label>Reference No</Label><Input value={editTxn.reference_no ?? ""} onChange={e => setEditTxn({ ...editTxn, reference_no: e.target.value })} /></div>
              <div className="col-span-2"><Label>Note</Label><Input value={editTxn.note ?? ""} onChange={e => setEditTxn({ ...editTxn, note: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setEditTxn(null)}>Cancel</Button><Button onClick={saveEditTxn}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => { if (!o && !deleting) setPendingDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingDelete?.kind === "account" ? "ব্যাংক অ্যাকাউন্ট ডিলিট করবেন?" : "লেনদেন ডিলিট করবেন?"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                {pendingDelete?.kind === "account" ? (
                  <>
                    <p>নিচের অ্যাকাউন্টটি স্থায়ীভাবে মুছে যাবে। এটি ফিরিয়ে আনা যাবে না।</p>
                    <div className="rounded-md border p-2 bg-muted/40">
                      <div><span className="text-muted-foreground">ব্যাংক:</span> {pendingDelete.item.bank_name} — {pendingDelete.item.account_no}</div>
                      <div><span className="text-muted-foreground">স্ট্রিম:</span> {streamLabel(pendingDelete.item.stream)}</div>
                      <div><span className="text-muted-foreground">বর্তমান ব্যালেন্স:</span> {money(balances.get(pendingDelete.item.id) ?? 0)}</div>
                    </div>
                    <p className="text-destructive">সতর্কতা: অ্যাকাউন্ট মুছলে এর লেনদেনগুলো অনাথ (orphan) হয়ে যেতে পারে।</p>
                  </>
                ) : pendingDelete ? (
                  <>
                    <p>নিচের লেনদেনটি মুছে যাবে। এটি ফিরিয়ে আনা যাবে না।</p>
                    <div className="rounded-md border p-2 bg-muted/40">
                      <div><span className="text-muted-foreground">তারিখ:</span> {fmtDate(pendingDelete.item.txn_date)}</div>
                      <div><span className="text-muted-foreground">ধরন:</span> {pendingDelete.item.txn_type}</div>
                      <div><span className="text-muted-foreground">পরিমাণ:</span> {money(pendingDelete.item.amount)}</div>
                      {pendingDelete.item.note && <div><span className="text-muted-foreground">নোট:</span> {pendingDelete.item.note}</div>}
                    </div>
                    {pendingDelete.item.link_id && <p className="text-destructive">সংযুক্ত ক্যাশবুক এন্ট্রিও (জমা/উত্তোলন) একসাথে মুছে ফেলা হবে।</p>}
                  </>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>বাতিল</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmDelete(); }} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "ডিলিট হচ্ছে…" : "ডিলিট করুন"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
