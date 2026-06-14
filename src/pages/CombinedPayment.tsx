// Combined Payment — record Savings + Share + Loan in one transaction and
// print a single combined receipt PDF. All three lines share the SAME monthly
// receipt number (COMBO-YYYY-MM-NNNN) generated server-side.
import { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";

import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FarmerSearchSelect } from "@/components/farmers/FarmerSearchSelect";
import { Printer, Save } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { useLang } from "@/i18n/LanguageProvider";
import { useBranding } from "@/lib/branding";
import { money } from "@/lib/format";
import { toBnDigits, bnAmountInWords } from "@/lib/bnNumber";
import { ensureBanglaFont } from "@/lib/pdfFonts";
import { nextMonthlyReceiptNo, nextUnifiedReceiptNo } from "@/lib/monthlyReceiptNo";

import { useUnsavedFormGuard } from "@/hooks/useUnsavedFormGuard";
import { useQueryClient } from "@tanstack/react-query";
import { getFarmerDues, type FarmerDuesBreakdown } from "@/lib/farmerDues";

type LoanRow = {
  id: string; principal: number; total_payable: number; issued_on: string; remaining: number;
  interest_rate: number; duration_months: number; last_payment_on: string | null;
};

const EMPTY = { farmer_id: "", savings: 0, share: 0, loan_id: "", loan_principal: 0, loan_interest: 0, note: "", receipt_no: "" };

export default function CombinedPayment() {
  const { user, officeId } = useAuth();
  const { t, lang } = useLang();
  const brand = useBranding();
  const qc = useQueryClient();
  const [form, setForm] = useState({ ...EMPTY });
  const [farmer, setFarmer] = useState<any>(null);
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<{ no: string; rows: any[]; total: number; farmerName: string; verifyUrl?: string | null } | null>(null);
  const [dues, setDues] = useState<FarmerDuesBreakdown | null>(null);
  const [autoDownload, setAutoDownload] = useState<boolean>(() => {
    try { return localStorage.getItem("combined:autoDl") === "1"; } catch { return false; }
  });
  const isDirty = JSON.stringify(form) !== JSON.stringify(EMPTY);
  const guard = useUnsavedFormGuard("combined-payment-draft", form, isDirty);
  const selectedLoan = useMemo(() => loans.find(l => l.id === form.loan_id), [loans, form.loan_id]);
  const loanAmt = Number(form.loan_principal || 0) + Number(form.loan_interest || 0);
  // Only the principal is capped by the remaining balance; interest is optional.
  const loanExceeds = !!selectedLoan && Number(form.loan_principal || 0) > selectedLoan.remaining;
  // Suggested accrued interest = remaining principal × (rate%/duration) × months elapsed since last payment/issue
  const suggestedInterest = useMemo(() => {
    if (!selectedLoan) return 0;
    const rate = Number(selectedLoan.interest_rate || 0);
    const dur = Number(selectedLoan.duration_months || 0);
    if (rate <= 0 || dur <= 0) return 0;
    const since = selectedLoan.last_payment_on || selectedLoan.issued_on;
    if (!since) return 0;
    const months = Math.max(0, Math.round((Date.now() - new Date(since).getTime()) / (1000 * 60 * 60 * 24 * 30)));
    const principalRemaining = Math.min(selectedLoan.principal, selectedLoan.remaining);
    return Math.round(principalRemaining * (rate / 100 / dur) * months);
  }, [selectedLoan]);
  // Remaining (unpaid) profit after the amount entered in this transaction —
  // shown as a profit due so partial profit payments leave a visible balance.
  const profitDue = useMemo(
    () => (!selectedLoan ? 0 : Math.max(0, suggestedInterest - Number(form.loan_interest || 0))),
    [selectedLoan, suggestedInterest, form.loan_interest],
  );


  useEffect(() => {
    document.title = `${lang === "bn" ? "সম্মিলিত পেমেন্ট" : "Combined Payment"} — ${t("appName")}`;
    if (guard.hasDraft()) {
      toast.message(lang === "bn" ? "অসমাপ্ত খসড়া পাওয়া গেছে" : "Unsaved draft found", {
        description: lang === "bn" ? "পুনরুদ্ধার করবেন?" : "Restore it?",
        action: {
          label: lang === "bn" ? "পুনরুদ্ধার" : "Restore",
          onClick: () => { const r = guard.restore(); if (r) setForm(r as typeof EMPTY); },
        },
        cancel: { label: lang === "bn" ? "বাতিল" : "Discard", onClick: () => guard.clear() },
        duration: 10000,
      });
    }
  }, []);

  useEffect(() => {
    if (!form.farmer_id) { setFarmer(null); setLoans([]); setDues(null); return; }
    (async () => {
      const [f, lq] = await Promise.all([
        supabase.from("farmers").select("id,name_en,name_bn,farmer_code,member_no,mobile,village,is_voter,savings_inactive,n").eq("id", form.farmer_id).maybeSingle(),
        supabase.from("loans").select("id,principal,total_payable,issued_on,interest_rate,loan_plans(interest_rate,duration_months),loan_payments(amount,paid_on)").eq("farmer_id", form.farmer_id).eq("status", "approved"),
      ]);
      setFarmer(f.data ?? null);
      const rows: LoanRow[] = (lq.data ?? []).map((l: any) => {
        const pays = l.loan_payments ?? [];
        // Remaining is PRINCIPAL only — interest is optional/suggested and is
        // never carried as a due (client requirement).
        const principal = Number(l.principal || 0);
        const principalPaid = pays.reduce((s: number, p: any) => {
          const pa = Number(p.principal_amount ?? 0);
          return s + (pa > 0 ? pa : Number(p.amount || 0));
        }, 0);
        const lastPay = pays.map((p: any) => p.paid_on).filter(Boolean).sort().pop() ?? null;
        return {
          id: l.id, principal,
          total_payable: Number(l.total_payable || l.principal || 0),
          issued_on: l.issued_on,
          remaining: Math.max(0, principal - principalPaid),
          interest_rate: Number(l.interest_rate || l.loan_plans?.interest_rate || 0),
          duration_months: Number(l.loan_plans?.duration_months || 0),
          last_payment_on: lastPay,
        };
      }).filter(r => r.remaining > 0);
      setLoans(rows);
      try { setDues(await getFarmerDues(form.farmer_id)); } catch { setDues(null); }
    })();
  }, [form.farmer_id]);

  const total = useMemo(
    () => Number(form.savings || 0) + Number(form.share || 0) + Number(form.loan_principal || 0) + Number(form.loan_interest || 0),
    [form.savings, form.share, form.loan_principal, form.loan_interest],
  );

  function reset() { setForm({ ...EMPTY }); setLastReceipt(null); guard.clear(); }

  async function submit() {
    if (!form.farmer_id) return toast.error(lang === "bn" ? "কৃষক নির্বাচন করুন" : "Select a farmer");
    if (total <= 0) return toast.error(lang === "bn" ? "অন্তত একটি amount দিন" : "Enter at least one amount");
    if ((farmer as any)?.savings_inactive) return toast.error(lang === "bn" ? `${farmer?.name_en ?? "এই সদস্য"} ইনঅ্যাক্টিভ — নতুন লেনদেন করা যাবে না।` : "Member is inactive — new transactions are not allowed.");
    if (loanAmt > 0 && !form.loan_id) return toast.error(lang === "bn" ? "ঋণ নির্বাচন করুন" : "Select a loan");
    if (loanAmt > 0 && Number(form.loan_principal || 0) <= 0) return toast.error(lang === "bn" ? "আসল টাকা বাধ্যতামূলক" : "Principal amount is required");
    if (loanAmt > 0 && !farmer?.is_voter) return toast.error(lang === "bn" ? "শুধু সঞ্চয় সদস্যকে ঋণ দেওয়া যাবে" : "Loans are only allowed for savings members");
    if (loanExceeds) return toast.error(lang === "bn" ? "ঋণের বাকির চেয়ে বেশি দেওয়া যাবে না" : "Loan repayment cannot exceed remaining balance");
    if (Number(form.savings) < 0 || Number(form.share) < 0 || Number(form.loan_principal) < 0 || Number(form.loan_interest) < 0) return toast.error(lang === "bn" ? "ঋণাত্মক পরিমাণ অনুমোদিত নয়" : "Negative amounts are not allowed");
    setSaving(true);
    try {
      // Use the operator-supplied receipt number if given, else auto-generate.
      let receiptNo: string;
      const manualNo = form.receipt_no.trim();
      if (manualNo) {
        const { data: dup } = await supabase.from("payments").select("id").eq("receipt_no", manualNo).is("deleted_at", null).limit(1);
        if (dup && dup.length) { setSaving(false); return toast.error(lang === "bn" ? "এই রসিদ নম্বর আগে থেকেই আছে" : "Receipt number already exists"); }
        receiptNo = manualNo;
      } else {
        receiptNo = await nextUnifiedReceiptNo(officeId, "COMBO", form.farmer_id);
      }
      const rows: { kind: string; label_bn: string; label_en: string; amount: number }[] = [];
      let verifyToken: string | null = null;

      // 1) Savings deposit
      if (Number(form.savings) > 0) {
        const { error } = await supabase.from("savings_transactions").insert({
          farmer_id: form.farmer_id, type: "deposit" as any, amount: Number(form.savings),
          note: form.note || "Combined payment", status: "approved" as any, created_by: user?.id,
          receipt_no: receiptNo,
        } as any);
        if (error) throw error;
        const { data: sp } = await supabase.from("payments").insert({
          farmer_id: form.farmer_id, kind: "savings", amount: Number(form.savings),
          collected_by: user?.id, receipt_no: receiptNo, status: "approved",
        } as any).select("verify_token").single();
        if (sp?.verify_token && !verifyToken) verifyToken = sp.verify_token;
        rows.push({ kind: "savings", label_bn: "সঞ্চয়", label_en: "Savings", amount: Number(form.savings) });
      }

      // 2) Share collection (recorded in savings_transactions as share_collection)
      if (Number(form.share) > 0) {
        const { error } = await supabase.from("savings_transactions").insert({
          farmer_id: form.farmer_id, type: "share_collection" as any, amount: Number(form.share),
          note: form.note || "Combined payment", status: "approved" as any, created_by: user?.id,
          receipt_no: receiptNo,
        } as any);
        if (error) throw error;
        rows.push({ kind: "share", label_bn: "শেয়ার", label_en: "Share", amount: Number(form.share) });
      }

      // 3) Loan repayment (principal + optional interest) via payments + payment_allocations
      if (loanAmt > 0 && form.loan_id) {
        const principal = Number(form.loan_principal || 0);
        const interest = Number(form.loan_interest || 0);
        const { data: pay, error: payErr } = await supabase.from("payments").insert({
          farmer_id: form.farmer_id, kind: "loan", amount: loanAmt,
          reference_id: form.loan_id, collected_by: user?.id, receipt_no: receiptNo, status: "approved",
        } as any).select("id,verify_token").single();
        if (payErr) throw payErr;
        if (pay?.verify_token && !verifyToken) verifyToken = pay.verify_token;
        await supabase.from("payment_allocations").insert({
          payment_id: pay!.id, kind: "loan", reference_id: form.loan_id, amount: loanAmt,
        } as any);
        await supabase.from("loan_payments").insert({
          loan_id: form.loan_id, amount: loanAmt, principal_amount: principal, interest_amount: interest,
          paid_on: new Date().toISOString().slice(0, 10), collected_by: user?.id,
          receipt_no: receiptNo,
        } as any);
        rows.push({ kind: "loan", label_bn: "ঋণ আসল", label_en: "Loan Principal", amount: principal });
        if (interest > 0) rows.push({ kind: "loan_interest", label_bn: "ঋণ লাভ", label_en: "Loan Interest", amount: interest });
      }

      const farmerName = farmer?.name_bn || farmer?.name_en || "";
      const verifyUrl = verifyToken ? `${window.location.origin}/r/${verifyToken}` : `${window.location.origin}/r/${receiptNo}`;
      setLastReceipt({ no: receiptNo, rows, total, farmerName, verifyUrl });

      guard.clear();
      // Refresh related caches so Savings/Loans/Payments/Statement views update immediately
      qc.invalidateQueries({ queryKey: ["api", "payments"] });
      qc.invalidateQueries({ queryKey: ["api", "savings"] });
      qc.invalidateQueries({ queryKey: ["api", "loans"] });
      qc.invalidateQueries({ queryKey: ["farmer-statement"] });
      qc.invalidateQueries({ queryKey: ["farmer-dues", form.farmer_id] });
      qc.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && q.queryKey.some((k) => typeof k === "string" && /savings|loan|payment|statement|due/i.test(k)) });
      toast.success(`${lang === "bn" ? "সংরক্ষিত" : "Saved"} — ${receiptNo}`);
      // Reset form, but keep farmer for fast next-entry
      setForm({ ...EMPTY, farmer_id: form.farmer_id });
      // Auto-download receipt PDF if user has enabled it
      if (autoDownload) {
        setTimeout(() => { printReceipt().catch(() => {}); }, 50);
      }
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function printReceipt() {
    if (!lastReceipt) return;
    // Loan & savings receipts print on A5 landscape per requirement
    const doc = new jsPDF({ unit: "mm", format: "a5", orientation: "l" });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 12;
    doc.setFont("helvetica", "bold"); doc.setFontSize(13);
    doc.text(brand.company_name || "Combined Receipt", pageW / 2, margin + 5, { align: "center" });
    doc.setFontSize(11); doc.text("COMBINED PAYMENT RECEIPT", pageW / 2, margin + 12, { align: "center" });
    doc.setDrawColor(31, 78, 121); doc.setLineWidth(0.6);
    doc.line(margin, margin + 15, pageW - margin, margin + 15);
    // QR code (top-right) for receipt verification
    if (lastReceipt.verifyUrl) {
      try {
        const qrUrl = await QRCode.toDataURL(lastReceipt.verifyUrl, { margin: 0, width: 160 });
        doc.addImage(qrUrl, "PNG", pageW - margin - 18, margin - 2, 18, 18);
        doc.setFontSize(6); doc.setTextColor(110);
        doc.text(lang === "bn" ? "যাচাইয়ের জন্য স্ক্যান" : "Scan to verify", pageW - margin - 9, margin + 18, { align: "center" });
        doc.setTextColor(0);
      } catch { /* ignore */ }
    }
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    let y = margin + 22;
    doc.text(`Receipt No: ${lastReceipt.no}`, margin, y);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, pageW - margin, y, { align: "right" }); y += 6;
    doc.text(`Farmer: ${lastReceipt.farmerName}`, margin, y);
    if (farmer?.member_no) doc.text(`Farmer ID: ${farmer.member_no}`, pageW - margin, y, { align: "right" });
    y += 8;
    // Table
    doc.setDrawColor(150); doc.rect(margin, y, pageW - 2 * margin, 8 + lastReceipt.rows.length * 7 + 8);
    doc.setFont("helvetica", "bold");
    doc.text("Type", margin + 3, y + 5);
    doc.text("Amount (BDT)", pageW - margin - 3, y + 5, { align: "right" });
    doc.line(margin, y + 7, pageW - margin, y + 7);
    doc.setFont("helvetica", "normal");
    let ry = y + 13;
    for (const r of lastReceipt.rows) {
      doc.text(r.label_en, margin + 3, ry);
      doc.text(r.amount.toFixed(2), pageW - margin - 3, ry, { align: "right" });
      ry += 7;
    }
    doc.line(margin, ry - 4, pageW - margin, ry - 4);
    doc.setFont("helvetica", "bold");
    doc.text("Total", margin + 3, ry + 2);
    doc.text(lastReceipt.total.toFixed(2), pageW - margin - 3, ry + 2, { align: "right" });
    // Signature
    const sigY = ry + 24;
    doc.setDrawColor(120); doc.line(pageW - margin - 50, sigY, pageW - margin, sigY);
    doc.setFontSize(8); doc.setTextColor(110);
    doc.text("Authorised signature", pageW - margin - 25, sigY + 4, { align: "center" });
    doc.save(`combined-${lastReceipt.no}.pdf`);
  }


  return (
    <>
      <PageHeader
        title={lang === "bn" ? "সম্মিলিত পেমেন্ট" : "Combined Payment"}
        description={lang === "bn" ? "সঞ্চয় + শেয়ার + ঋণ একসাথে গ্রহণ" : "Collect Savings + Share + Loan together"}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4 space-y-3">
          <div>
            <Label>{lang === "bn" ? "কৃষক" : "Farmer"} *</Label>
            <FarmerSearchSelect
              value={form.farmer_id}
              onChange={(id) => setForm({ ...form, farmer_id: id ?? "", loan_id: "", loan_principal: 0, loan_interest: 0 })}
            />
          </div>
          {form.farmer_id && dues && (
            <div className="rounded-md bg-muted/40 p-2 text-xs space-y-0.5 border">
              <div className="font-semibold uppercase text-[10px] text-muted-foreground">
                {lang === "bn" ? "বকেয়া সারাংশ" : "Outstanding summary"}
              </div>
              <div className="flex justify-between"><span>{lang === "bn" ? "সঞ্চয় ব্যালেন্স" : "Savings balance"}</span><span className="font-mono">{money(dues.savings_balance)}</span></div>
              <div className="flex justify-between"><span>{lang === "bn" ? "শেয়ার ব্যালেন্স" : "Share balance"}</span><span className="font-mono">{money(dues.share_balance)}</span></div>
              <div className="flex justify-between"><span>{lang === "bn" ? "ঋণ বাকি" : "Loan due"}</span><span className="font-mono">{money(dues.loan_due)}</span></div>
              <div className="flex justify-between"><span>{lang === "bn" ? "সেচ বাকি" : "Irrigation due"}</span><span className="font-mono">{money(dues.irrigation_due)}</span></div>
              <div className="flex justify-between border-t pt-0.5 font-semibold"><span>{lang === "bn" ? "নিট বকেয়া" : "Net due"}</span><span className="font-mono">{money(dues.net_due)}</span></div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{lang === "bn" ? "সঞ্চয় (৳)" : "Savings (৳)"}</Label>
              <Input type="number" min={0} step="0.01" value={form.savings}
                     onChange={(e) => setForm({ ...form, savings: Number(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>{lang === "bn" ? "শেয়ার (৳)" : "Share (৳)"}</Label>
              <Input type="number" min={0} step="0.01" value={form.share}
                     onChange={(e) => setForm({ ...form, share: Number(e.target.value) || 0 })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{lang === "bn" ? "ঋণ" : "Loan"}</Label>
              <Select value={form.loan_id || "none"}
                      onValueChange={(v) => setForm({ ...form, loan_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder={lang === "bn" ? "নির্বাচন করুন" : "Select loan"} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{lang === "bn" ? "— কোনো ঋণ নয় —" : "— None —"}</SelectItem>
                  {loans.map(l => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.issued_on} · {lang === "bn" ? "বাকি" : "Remaining"} {money(l.remaining)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{lang === "bn" ? "ঋণ আসল (৳) *" : "Loan Principal (৳) *"}</Label>
              <Input type="number" min={0} step="0.01" disabled={!form.loan_id} value={form.loan_principal}
                     aria-invalid={loanExceeds || undefined}
                     onChange={(e) => setForm({ ...form, loan_principal: Number(e.target.value) || 0 })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{lang === "bn" ? "ঋণ লাভ (৳) — অপশনাল" : "Loan Interest (৳) — optional"}</Label>
              <Input type="number" min={0} step="0.01" disabled={!form.loan_id} value={form.loan_interest}
                     onChange={(e) => setForm({ ...form, loan_interest: Number(e.target.value) || 0 })} />
              {selectedLoan && suggestedInterest > 0 && (
                <button type="button" className="text-xs mt-1 text-primary underline"
                        onClick={() => setForm({ ...form, loan_interest: suggestedInterest })}>
                  {lang === "bn" ? `সাজেস্ট লাভ: ${money(suggestedInterest)} — প্রয়োগ` : `Suggested interest: ${money(suggestedInterest)} — apply`}
                </button>
              )}
              {/* Profit is optional; partial profit must NOT be shown as a due (client requirement).
                  Only an informational note is shown, never a "due" balance. */}
              {selectedLoan && profitDue > 0 && Number(form.loan_interest || 0) === 0 && (
                <div className="text-xs mt-1 text-muted-foreground">
                  {lang === "bn" ? `লাভ অপশনাল — চাইলে যোগ করুন` : `Interest is optional`}
                </div>
              )}
            </div>
            <div>
              {selectedLoan && (
                <div className={`text-xs mt-6 ${loanExceeds ? "text-destructive" : "text-muted-foreground"}`}>
                  {lang === "bn" ? "বাকি" : "Remaining"}: {money(selectedLoan.remaining)}
                  {loanExceeds && (lang === "bn" ? " — বাকির চেয়ে বেশি" : " — exceeds remaining")}
                  {!farmer?.is_voter && <div className="text-destructive">{lang === "bn" ? "এই কৃষক সঞ্চয় সদস্য নন" : "Not a savings member"}</div>}
                </div>
              )}
            </div>
          </div>
          <div>
            <Label>{lang === "bn" ? "রসিদ নম্বর" : "Receipt #"} <span className="text-xs text-muted-foreground">{lang === "bn" ? "(খালি রাখলে অটো)" : "(auto if blank)"}</span></Label>
            <Input value={form.receipt_no} onChange={(e) => setForm({ ...form, receipt_no: e.target.value })}
                   placeholder={lang === "bn" ? "যেমন: 4500" : "e.g. 4500"} />
          </div>
          <div>
            <Label>{lang === "bn" ? "মন্তব্য" : "Note"}</Label>
            <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
          <div className="flex items-center justify-between border-t pt-3">
            <div className="text-sm">
              {lang === "bn" ? "সর্বমোট" : "Total"}: <span className="font-semibold">{money(total)}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={reset} disabled={saving}>{lang === "bn" ? "রিসেট" : "Reset"}</Button>
              <Button onClick={submit} disabled={saving || total <= 0 || !form.farmer_id || loanExceeds}>
                <Save className="h-4 w-4 mr-1" />{saving ? "…" : (lang === "bn" ? "সংরক্ষণ" : "Save")}
              </Button>
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoDownload}
              onChange={(e) => {
                setAutoDownload(e.target.checked);
                try { localStorage.setItem("combined:autoDl", e.target.checked ? "1" : "0"); } catch {}
              }}
            />
            <span>{lang === "bn" ? "সংরক্ষণের পর রসিদ স্বয়ংক্রিয় ডাউনলোড" : "Auto-download receipt after save"}</span>
          </label>

        </Card>

        <Card className="p-4 space-y-3">
          <div className="text-sm font-semibold">{lang === "bn" ? "শেষ রসিদ" : "Last Receipt"}</div>
          {!lastReceipt ? (
            <div className="text-sm text-muted-foreground">
              {lang === "bn" ? "সংরক্ষণের পর এখানে রসিদ দেখা যাবে।" : "Receipt will appear here after saving."}
            </div>
          ) : (
            <>
              <div className="text-xs text-muted-foreground">{lastReceipt.no}</div>
              <div className="text-sm">{lastReceipt.farmerName}</div>
              <table className="w-full text-sm">
                <tbody>
                  {lastReceipt.rows.map((r, i) => (
                    <tr key={i} className="border-b">
                      <td className="py-1">{lang === "bn" ? r.label_bn : r.label_en}</td>
                      <td className="py-1 text-right">{money(r.amount)}</td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td className="py-1">{lang === "bn" ? "সর্বমোট" : "Total"}</td>
                    <td className="py-1 text-right">{money(lastReceipt.total)}</td>
                  </tr>
                </tbody>
              </table>
              <Button onClick={printReceipt} className="w-full">
                <Printer className="h-4 w-4 mr-1" />{lang === "bn" ? "রসিদ প্রিন্ট" : "Print Receipt"}
              </Button>
            </>
          )}
        </Card>
      </div>
    </>
  );
}
