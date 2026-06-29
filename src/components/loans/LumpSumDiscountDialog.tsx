import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageProvider";
import { useAuth } from "@/auth/AuthProvider";
import { money } from "@/lib/format";
import { lumpSumInterest, validateLumpSumInterest } from "@/lib/lumpSumLoan";
import {
  exportLumpSumReceiptPdf,
  downloadLumpSumReceiptPdf,
  downloadLumpSumReceiptExcel,
  lumpSumNet,
  type LumpSumReceiptData,
} from "@/lib/lumpSumReceipt";

const sb = db as any;

/**
 * Admin-only dialog to record a lump-sum loan repayment with an optional
 * interest discount (waiver). Principal is mandatory; interest is suggested
 * from the plan; discount is subtracted so receipt amounts stay consistent.
 * Staff (non-admin) users get a read-only receipt history view.
 * Every discount/waiver is written to loan_discount_audit (before/after).
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
  const { user, officeId, isAdmin } = useAuth();
  const canApply = isAdmin;

  const paidPrincipal = (loan?.loan_payments ?? []).reduce(
    (s: number, p: any) => s + (Number(p.principal_amount ?? 0) > 0 ? Number(p.principal_amount) : Number(p.amount ?? 0)), 0);
  const remaining = Math.max(0, Number(loan?.principal ?? 0) - paidPrincipal);
  const suggested = lumpSumInterest(remaining, Number(loan?.interest_rate ?? 0));

  const [principal, setPrincipal] = useState<number>(remaining);
  const [interest, setInterest] = useState<number>(suggested);
  const [discount, setDiscount] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [errs, setErrs] = useState<{ principal?: string; interest?: string; discount?: string }>({});
  const [history, setHistory] = useState<any[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const net = useMemo(() => lumpSumNet({ principal_amount: principal, interest_amount: interest, discount_amount: discount }), [principal, interest, discount]);

  useEffect(() => {
    if (!open || !loan?.id) return;
    (async () => {
      const { data } = await sb.from("loan_payments")
        .select("id,receipt_no,paid_on,principal_amount,interest_amount,discount_amount,amount")
        .eq("loan_id", loan.id).order("paid_on", { ascending: false });
      setHistory(data ?? []);
    })();
  }, [open, loan?.id]);

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

  async function preview() {
    const doc = await exportLumpSumReceiptPdf(buildReceipt("PREVIEW"));
    const url = doc.output("bloburl") as unknown as string;
    setPreviewUrl(String(url));
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
      const { data: pay, error } = await sb.from("loan_payments").insert({
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
      }).select("id").maybeSingle();
      if (error) throw error;

      // Audit trail for the discount/waiver (before/after).
      await sb.from("loan_discount_audit").insert({
        loan_id: loan.id,
        payment_id: pay?.id ?? null,
        receipt_no: receiptNo,
        office_id: officeId ?? null,
        changed_by: user?.id ?? null,
        interest_before: Number(suggested),
        interest_after: Number(interest),
        discount_before: 0,
        discount_after: Number(discount),
        note: discount > 0 ? `Interest waiver ৳${discount}` : "No discount",
      });

      toast.success(tx("Repayment recorded", "পরিশোধ রেকর্ড হয়েছে"));
      onOpenChange(false);
      onDone?.();
    } catch (err: any) {
      toast.error(err.message || "Failed");
    } finally { setSaving(false); }
  }

  const receiptForExport = () => buildReceipt(`LS-${Date.now()}`);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {canApply ? tx("Lump-sum Repayment & Discount", "একবারে পরিশোধ ও ছাড়") : tx("Receipt History (view only)", "রশিদ ইতিহাস (শুধু দেখা)")}
          </DialogTitle>
        </DialogHeader>

        {!canApply && (
          <p className="text-sm text-muted-foreground">
            {tx("Only Admin/Super Admin can apply a discount. You can view receipt history below.", "শুধু অ্যাডমিন/সুপার অ্যাডমিন ছাড় দিতে পারবেন। আপনি নিচে রশিদ ইতিহাস দেখতে পারবেন।")}
          </p>
        )}

        {canApply && (
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
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" type="button" onClick={preview}>{tx("Preview (A5)", "প্রিভিউ (A5)")}</Button>
              <Button variant="outline" size="sm" type="button" onClick={() => downloadLumpSumReceiptPdf(receiptForExport())}>{tx("PDF (A5)", "PDF (A5)")}</Button>
              <Button variant="outline" size="sm" type="button" onClick={() => downloadLumpSumReceiptExcel(receiptForExport())}>{tx("Excel", "Excel")}</Button>
            </div>
            {previewUrl && (
              <iframe title="receipt-preview" src={previewUrl} className="w-full h-72 rounded-md border" />
            )}
          </div>
        )}

        {history.length > 0 && (
          <div className="mt-2">
            <div className="text-sm font-medium mb-1">{tx("Receipt History", "রশিদ ইতিহাস")}</div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>{tx("Receipt", "রশিদ")}</TableHead>
                <TableHead>{tx("Date", "তারিখ")}</TableHead>
                <TableHead className="text-right">{tx("Principal", "আসল")}</TableHead>
                <TableHead className="text-right">{tx("Interest", "লাভ")}</TableHead>
                <TableHead className="text-right">{tx("Discount", "ছাড়")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {history.map(h => (
                  <TableRow key={h.id}>
                    <TableCell className="text-xs">{h.receipt_no}</TableCell>
                    <TableCell>{h.paid_on}</TableCell>
                    <TableCell className="text-right font-mono">{money(h.principal_amount ?? 0)}</TableCell>
                    <TableCell className="text-right font-mono">{money(h.interest_amount ?? 0)}</TableCell>
                    <TableCell className="text-right font-mono">{money(h.discount_amount ?? 0)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>{tx("Close", "বন্ধ")}</Button>
          {canApply && <Button onClick={submit} disabled={saving}>{saving ? "…" : tx("Record Repayment", "পরিশোধ রেকর্ড")}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
