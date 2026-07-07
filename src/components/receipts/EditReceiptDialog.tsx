import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";
import { useLang } from "@/i18n/LanguageProvider";
import { money } from "@/lib/format";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FarmerSearchSelect } from "@/components/farmers/FarmerSearchSelect";
import { MouzaSelect } from "@/components/locations/MouzaSelect";
import { fetchReceiptAuditLogs } from "@/lib/receiptAudit";
import { previewEdit, checkConsistency, type EditBaseline } from "@/lib/combinedReceiptValidation";

type EditForm = { mouza: string; land_size: number; owner_farmer_id: string; delay_fee: number; amount: number; note: string; reason: string };

const EMPTY: EditForm = { mouza: "", land_size: 0, owner_farmer_id: "", delay_fee: 0, amount: 0, note: "", reason: "" };

/** Human-readable field labels used by the master-detail edit history. */
function useFieldLabels() {
  const { tx } = useLang();
  return useMemo<Record<string, string>>(() => ({
    amount: tx("Amount", "টাকা"),
    delay_fee: tx("Delay fee", "জরিমানা"),
    mouza: tx("Mouza", "মৌজা"),
    land_size: tx("Land size", "জমির পরিমাণ"),
    owner_farmer_id: tx("Owner", "মালিক"),
    note: tx("Note", "নোট"),
  }), [tx]);
}

export function EditReceiptDialog({
  payment,
  open,
  onOpenChange,
  onSaved,
}: {
  payment: any | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved?: () => void;
}) {
  const { t, tx } = useLang();
  const labels = useFieldLabels();
  const [loading, setLoading] = useState(false);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [landId, setLandId] = useState<string | null>(null);
  const [baseline, setBaseline] = useState<EditBaseline | null>(null);
  const [form, setForm] = useState<EditForm>(EMPTY);
  const [history, setHistory] = useState<any[]>([]);

  const preview = useMemo(() => {
    if (!baseline) return null;
    return previewEdit(baseline, { delay_fee: form.delay_fee, amount: form.amount });
  }, [baseline, form.delay_fee, form.amount]);

  useEffect(() => {
    if (!open || !payment) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      fetchReceiptAuditLogs({ paymentId: payment.id, limit: 50 })
        .then((r) => { if (!cancelled) setHistory(r.rows); })
        .catch(() => { if (!cancelled) setHistory([]); });
      const irrAlloc = (payment.payment_allocations ?? []).find((a: any) => a.kind === "irrigation" && a.reference_id)
        ?? (payment.kind === "irrigation" && payment.reference_id ? { reference_id: payment.reference_id, amount: payment.amount } : null);
      const invId = irrAlloc?.reference_id ?? null;
      let mouza = "", land_size = 0, owner = "", delay = 0, lId: string | null = null;
      let base: EditBaseline | null = null;
      if (invId) {
        const { data: inv } = await db.from("irrigation_invoices")
          .select("land_id,owner_farmer_id,delay_fee,payable_amount,due_amount,paid_amount,lands(mouza,land_size)").eq("id", invId).maybeSingle();
        if (inv) {
          lId = (inv as any).land_id ?? null;
          owner = (inv as any).owner_farmer_id ?? "";
          delay = Number((inv as any).delay_fee || 0);
          mouza = (inv as any).lands?.mouza ?? "";
          land_size = Number((inv as any).lands?.land_size || 0);
          base = {
            payable_amount: Number((inv as any).payable_amount || 0),
            due_amount: Number((inv as any).due_amount || 0),
            paid_amount: Number((inv as any).paid_amount || 0),
            delay_fee: delay,
            amount: Number(payment.amount || 0),
          };
        }
      }
      if (cancelled) return;
      setInvoiceId(invId);
      setLandId(lId);
      setBaseline(base);
      setForm({ mouza, land_size, owner_farmer_id: owner, delay_fee: delay, amount: Number(payment.amount || 0), note: payment.note ?? "", reason: "" });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, payment]);

  async function save() {
    if (!payment) return;
    if (!form.reason.trim()) return toast.error(tx("Reason is required", "কারণ আবশ্যক"));
    const amt = Math.round(Number(form.amount) || 0);
    if (amt < 0 || Number.isNaN(amt)) return toast.error(tx("Enter a valid amount", "সঠিক অঙ্ক দিন"));
    if (baseline && amt > baseline.payable_amount + (Math.round(Number(form.delay_fee) || 0) - baseline.delay_fee)) {
      return toast.error(tx("Amount exceeds payable", "অঙ্ক প্রদেয়র চেয়ে বেশি"));
    }
    if (invoiceId && !form.owner_farmer_id) return toast.error(tx("Select a farmer", "কৃষক নির্বাচন করুন"));
    if (baseline && preview) {
      const { ok, errors } = checkConsistency({
        invoicePaid: preview.paid,
        allocationAmount: amt,
        paymentAmount: amt,
        payable: preview.payable,
        due: preview.due,
      });
      if (!ok) return toast.error(tx("Cannot save: ", "সংরক্ষণ করা যাচ্ছে না: ") + errors.join("; "));
    }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("payment-edit", {
      body: {
        payment_id: payment.id,
        reason: form.reason.trim(),
        amount: amt,
        note: form.note,
        mouza: landId ? form.mouza : null,
        land_size: landId ? form.land_size : null,
        owner_farmer_id: invoiceId ? (form.owner_farmer_id || null) : null,
        delay_fee: invoiceId ? Math.round(Number(form.delay_fee) || 0) : null,
      },
    });
    setLoading(false);
    if (error || (data as any)?.error) {
      return toast.error((data as any)?.error || error?.message || tx("Failed to update receipt", "রসিদ হালনাগাদ ব্যর্থ হয়েছে"));
    }
    toast.success(tx("Receipt updated", "রসিদ হালনাগাদ হয়েছে"));
    onOpenChange(false);
    onSaved?.();
  }

  /** Render a before→after diff of one history entry as readable rows. */
  function renderDiff(h: any) {
    const before = h.old_values || {};
    const { reason, ...after } = (h.new_values || {}) as Record<string, unknown>;
    const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))
      .filter((k) => labels[k] && String(before[k] ?? "") !== String((after as any)[k] ?? ""));
    if (keys.length === 0) return <div className="text-muted-foreground">{tx("No field changes", "কোনো পরিবর্তন নেই")}</div>;
    return (
      <div className="space-y-0.5">
        {keys.map((k) => (
          <div key={k} className="flex flex-wrap gap-1">
            <span className="font-medium">{labels[k]}:</span>
            <span className="text-destructive line-through">{String(before[k] ?? "—")}</span>
            <span>→</span>
            <span className="text-success">{String((after as any)[k] ?? "—")}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{tx("Edit receipt", "রসিদ এডিট")} {payment?.receipt_no ? `— ${payment.receipt_no}` : ""}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="py-6 text-center text-muted-foreground">{tx("Loading…", "লোড হচ্ছে…")}</div>
        ) : (
          <div className="space-y-3">
            {!invoiceId && (
              <p className="text-xs text-muted-foreground">{tx("This receipt has no linked irrigation invoice; only amount can be edited.", "এই রসিদে কোনো সেচ ইনভয়েস যুক্ত নেই; শুধু টাকা এডিট করা যাবে।")}</p>
            )}
            {invoiceId && (<>
              <div>
                <Label>{tx("Owner", "মালিক")}</Label>
                <FarmerSearchSelect value={form.owner_farmer_id || null} onChange={(id) => setForm((f) => ({ ...f, owner_farmer_id: id ?? "" }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{tx("Mouza", "মৌজা")}</Label>
                  <MouzaSelect value={form.mouza} onChange={(v) => setForm((f) => ({ ...f, mouza: v }))} />
                </div>
                <div>
                  <Label>{tx("Land size", "জমির পরিমাণ")}</Label>
                  <Input type="number" step="0.01" value={form.land_size || ""} onChange={(e) => setForm((f) => ({ ...f, land_size: Number(e.target.value || 0) }))} />
                </div>
              </div>
              <div>
                <Label>{tx("Delay fee / penalty", "জরিমানা")}</Label>
                <Input type="number" step={1} value={form.delay_fee || ""} onChange={(e) => setForm((f) => ({ ...f, delay_fee: Math.round(Number(e.target.value || 0)) }))} />
              </div>
            </>)}
            <div>
              <Label>{tx("Amount (৳)", "টাকা (৳)")}</Label>
              <Input type="number" step={1} value={form.amount || ""} onChange={(e) => setForm((f) => ({ ...f, amount: Math.round(Number(e.target.value || 0)) }))} />
            </div>
            <div>
              <Label>{tx("Note", "নোট")}</Label>
              <Input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder={tx("Remark / note", "মন্তব্য / নোট")} />
            </div>
            <div>
              <Label>{tx("Reason for change", "পরিবর্তনের কারণ")} *</Label>
              <Input value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder={tx("Why are you editing this receipt?", "কেন এই রসিদ এডিট করছেন?")} />
            </div>
            {invoiceId && preview && (
              <div className="rounded-md border bg-muted/40 p-2 space-y-1">
                <div className="text-xs font-medium text-muted-foreground">{tx("Recalculated preview", "পুনঃগণনা প্রিভিউ")}</div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>{tx("Payable", "প্রদেয়")}<div className="font-semibold">{money(preview.payable)}</div></div>
                  <div>{tx("Paid", "পরিশোধিত")}<div className="font-semibold">{money(preview.paid)}</div></div>
                  <div>{tx("Due", "বকেয়া")}<div className="font-semibold">{money(preview.due)}</div></div>
                </div>
                <div className="text-xs text-muted-foreground">{tx("Status", "অবস্থা")}: {preview.status}</div>
              </div>
            )}
            {history.length > 0 && (
              <div className="rounded-md border p-2 max-h-48 overflow-auto space-y-2">
                <div className="text-xs font-medium text-muted-foreground">{tx("Edit history", "এডিট ইতিহাস")}</div>
                {history.map((h) => (
                  <div key={h.id} className="text-xs border-b pb-1 last:border-0">
                    <div className="text-muted-foreground">{new Date(h.created_at).toLocaleString()} · {h.new_values?.reason || "—"}</div>
                    {renderDiff(h)}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
          <Button onClick={save} disabled={loading}>{tx("Save changes", "সংরক্ষণ")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
