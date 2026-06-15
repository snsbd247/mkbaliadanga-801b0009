import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageProvider";
import { useAuth } from "@/auth/AuthProvider";
import { money } from "@/lib/format";
import { lumpSumInterest, validateLumpSumInterest } from "@/lib/lumpSumLoan";
import { downloadLumpSumReceiptPdf, downloadLumpSumReceiptExcel, lumpSumNet, type LumpSumReceiptData } from "@/lib/lumpSumReceipt";

const sb = supabase as any;

/**
 * Admin-only dialog to record a lump-sum loan repayment with an optional
 * interest discount (waiver). Principal is mandatory; interest is suggested
 * from the plan; discount is subtracted so receipt amounts stay consistent.
 */
export function LumpSumDiscountDialog({
  loan, open, onOpenChange, onDone,
}: {
  loan: any;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone?: () => void;
}) {
  const { tx, lang } = useLang();
  const { user, officeId } = useAuth();
  const paidPrincipal = (loan?.loan_payments ?? []).reduce(
    (s: number, p: any) => s + (Number(p.principal_amount ?? 0) > 0 ? Number(p.principal_amount) : Number(p.amount ?? 0)), 0);
  const remaining = Math.max(0, Number(loan?.principal ?? 0) - paidPrincipal);
  const suggested = lumpSumInterest(remaining, Number(loan?.interest_rate ?? 0));

  const [principal, setPrincipal] = useState<number>(remaining);
  const [interest, setInterest] = useState<number>(suggested);
  const [discount, setDiscount] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [errs, setErrs] = useState<{ principal?: string; interest?: string; discount?: string }>({});

  const net = useMemo(() => lumpSumNet({ principal_amount: principal, interest_amount: interest, discount_amount: discount }), [principal, interest, discount]);

  function buildReceipt(receiptNo: string): LumpSumReceiptData {
    return {
      receipt_no: receiptNo,
      paid_on: new Date().toISOString().slice(0, 10),
      farmer_name: (lang === "bn" ? (loan?.farmers?.name_bn || loan?.farmers?.name_en) : loan?.farmers?.name_en) ?? "",
      member_no: loan?.farmers?.member_no ?? null,
      loan_no: loan?.loan_no ?? null,
      principal_amount: principal,
      interest_amount: interest,
      discount_amount: discount,
      collected_by_name: user?.email ?? null,
    };
  }

  async function submit() {
    const e: typeof errs = {};
    if (!(Number(principal) > 0)) e.principal = tx("Principal is required", "আসল আবশ্যক");
    else if (Number(principal) > remaining) e.principal = tx("Principal exceeds remaining", "আসল বাকির বেশি");
    const iv = validateLumpSumInterest(interest, tx);
    if (!iv.ok) e.interest = iv.error;
    if (Number(discount) < 0) e.discount = tx("Discount cannot be negative", "ছাড় ঋণাত্মক হতে পারে না");
    else if (Number(discount) > Number(interest)) e.discount = tx("Discount cannot exceed interest", "ছাড় লাভের বেশি হতে পারে না");
    setErrs(e);
    if (Object.keys(e).length) return;

    setSaving(true);
    try {
      const receiptNo = `LS-${Date.now()}`;
      const { error } = await sb.from("loan_payments").insert({
        loan_id: loan.id,
        amount: net,
        principal_amount: Number(principal),
        interest_amount: Number(interest),
        discount_amount: Number(discount),
        paid_on: new Date().toISOString().slice(0, 10),
        collected_by: user?.id ?? null,
        office_id: officeId ?? null,
        receipt_no: receiptNo,
        note: discount > 0 ? `Interest waiver ৳${discount}` : null,
      });
      if (error) throw error;
      toast.success(tx("Repayment recorded", "পরিশোধ রেকর্ড হয়েছে"));
      (window as any).__lastLumpSumReceipt = buildReceipt(receiptNo);
      onOpenChange(false);
      onDone?.();
    } catch (err: any) {
      toast.error(err.message || "Failed");
    } finally { setSaving(false); }
  }

  const receiptForExport = () => buildReceipt(`LS-${Date.now()}`);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{tx("Lump-sum Repayment & Discount", "একবারে পরিশোধ ও ছাড়")}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="rounded-md bg-muted p-2 text-sm flex justify-between">
            <span>{tx("Remaining principal", "আসল বাকি")}</span><span className="font-mono">{money(remaining)}</span>
          </div>
          <div>
            <Label>{tx("Principal (৳)", "আসল (৳)")} *</Label>
            <Input type="number" min={0} value={principal} onChange={e => { setPrincipal(+e.target.value); setErrs(s => ({ ...s, principal: undefined })); }} aria-invalid={!!errs.principal} />
            {errs.principal && <p className="text-sm text-destructive mt-1">{errs.principal}</p>}
          </div>
          <div>
            <Label>{tx("Interest (৳)", "লাভ (৳)")} — {tx("suggested", "সাজেস্ট")}: {money(suggested)}</Label>
            <Input type="number" min={0} step="0.01" value={interest} onChange={e => { setInterest(+e.target.value); setErrs(s => ({ ...s, interest: undefined })); }} aria-invalid={!!errs.interest} />
            {errs.interest && <p className="text-sm text-destructive mt-1">{errs.interest}</p>}
          </div>
          <div>
            <Label>{tx("Interest Discount / Waiver (৳)", "লাভ ছাড় (৳)")}</Label>
            <Input type="number" min={0} value={discount} onChange={e => { setDiscount(+e.target.value); setErrs(s => ({ ...s, discount: undefined })); }} aria-invalid={!!errs.discount} />
            {errs.discount && <p className="text-sm text-destructive mt-1">{errs.discount}</p>}
          </div>
          <div className="rounded-md bg-primary/10 p-3 text-sm flex justify-between font-bold">
            <span>{tx("Net Payable", "নিট পরিশোধ")}</span><span className="font-mono">{money(net)}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" type="button" onClick={() => downloadLumpSumReceiptPdf(receiptForExport())}>{tx("PDF (A5)", "PDF (A5)")}</Button>
            <Button variant="outline" size="sm" type="button" onClick={() => downloadLumpSumReceiptExcel(receiptForExport())}>{tx("Excel", "Excel")}</Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>{tx("Cancel", "বাতিল")}</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "…" : tx("Record Repayment", "পরিশোধ রেকর্ড")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
