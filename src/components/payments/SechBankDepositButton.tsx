// One-click সেচ নগদ ↔ ব্যাংক deposit/withdraw button.
// Confirms before creating the guarded bank transaction (no auto-post).
import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { useAuth } from "@/auth/AuthProvider";
import { useLang } from "@/i18n/LanguageProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Landmark } from "lucide-react";
import { toast } from "sonner";
import { isSechStream } from "@/lib/cashStreamGuard";
import { runSechBankTransfer } from "@/lib/sechBankTransfer";

const sb = db as any;

export function SechBankDepositButton({ defaultAmount = 0 }: { defaultAmount?: number }) {
  const { user } = useAuth();
  const { lang } = useLang();
  const bn = lang === "bn";
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({
    bank_account_id: "", direction: "deposit", amount: defaultAmount || 0,
    txn_date: new Date().toISOString().slice(0, 10), note: "",
  });

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const { data } = await sb.from("bank_accounts").select("*").order("bank_name");
      setAccounts((data ?? []).filter((a: any) => isSechStream(a.stream)));
    })();
  }, [open]);

  async function submit() {
    const acc = accounts.find((a) => a.id === form.bank_account_id);
    if (!acc) return toast.error(bn ? "সেচ ব্যাংক অ্যাকাউন্ট নির্বাচন করুন" : "Select a Sech bank account");
    setSaving(true);
    try {
      const res = await runSechBankTransfer({
        account: acc, direction: form.direction, amount: Number(form.amount),
        txnDate: form.txn_date, note: form.note, createdBy: user?.id,
      });
      if (!res.ok) { toast.error(res.message ?? "ব্যর্থ"); return; }
      toast.success(bn ? "ব্যাংক লেনদেন তৈরি হয়েছে" : "Bank transaction created");
      setOpen(false);
      setForm({ bank_account_id: "", direction: "deposit", amount: 0, txn_date: new Date().toISOString().slice(0, 10), note: "" });
    } finally { setSaving(false); }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Landmark className="h-4 w-4 mr-1" />{bn ? "সেচ নগদ ↔ ব্যাংক" : "Sech cash ↔ bank"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{bn ? "সেচ নগদ ব্যাংকে জমা / উত্তোলন" : "Sech cash deposit / withdraw"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{bn ? "ধরন" : "Type"}</Label>
              <Select value={form.direction} onValueChange={(v) => setForm({ ...form, direction: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="deposit">{bn ? "নগদ → ব্যাংক (জমা)" : "Cash → Bank (deposit)"}</SelectItem>
                  <SelectItem value="withdraw">{bn ? "ব্যাংক → নগদ (উত্তোলন)" : "Bank → Cash (withdraw)"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{bn ? "সেচ ব্যাংক অ্যাকাউন্ট" : "Sech bank account"}</Label>
              <Select value={form.bank_account_id} onValueChange={(v) => setForm({ ...form, bank_account_id: v })}>
                <SelectTrigger><SelectValue placeholder={bn ? "নির্বাচন করুন" : "Select"} /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.bank_name} — {a.account_no}</SelectItem>
                  ))}
                  {accounts.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">{bn ? "কোন সেচ অ্যাকাউন্ট নেই" : "No Sech accounts"}</div>}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{bn ? "পরিমাণ" : "Amount"}</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              <div><Label>{bn ? "তারিখ" : "Date"}</Label><Input type="date" value={form.txn_date} onChange={(e) => setForm({ ...form, txn_date: e.target.value })} /></div>
            </div>
            <div><Label>{bn ? "নোট" : "Note"}</Label><Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{bn ? "বাতিল" : "Cancel"}</Button>
            <Button onClick={submit} disabled={saving}>{bn ? "নিশ্চিত করুন" : "Confirm"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
