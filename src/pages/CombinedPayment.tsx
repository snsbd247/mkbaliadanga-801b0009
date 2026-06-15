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
import { evaluateMemberEligibility } from "@/lib/memberEligibility";
import { toBnDigits, bnAmountInWords } from "@/lib/bnNumber";
import { ensureBanglaFont } from "@/lib/pdfFonts";
import { nextMonthlyReceiptNo, nextUnifiedReceiptNo } from "@/lib/monthlyReceiptNo";

import { useUnsavedFormGuard } from "@/hooks/useUnsavedFormGuard";
import { useQueryClient } from "@tanstack/react-query";
import { getFarmerDues, type FarmerDuesBreakdown } from "@/lib/farmerDues";
import { logAudit } from "@/lib/audit";
import { suggestedInterest as calcSuggestedInterest, loanPrincipalExceeds } from "@/lib/loanPaymentRules";
import { COLLECTION_RECEIPT_PAPER } from "@/lib/receiptPaper";

type LoanRow = {
  id: string; principal: number; total_payable: number; issued_on: string; remaining: number;
  interest_rate: number; duration_months: number; last_payment_on: string | null;
};

const EMPTY = { farmer_id: "", savings: 0, share: 0, loan_id: "", loan_principal: 0, loan_interest: 0, note: "", receipt_no: "", field_receipt_no: "" };

export default function CombinedPayment() {
  const { user, officeId } = useAuth();
  const { t, lang } = useLang();
  const brand = useBranding();
  const qc = useQueryClient();
  const [form, setForm] = useState({ ...EMPTY });
  useEffect(() => {
    const fid = new URLSearchParams(window.location.search).get("farmer");
    if (fid) setForm((p) => (p.farmer_id ? p : { ...p, farmer_id: fid }));
  }, []);
  const [farmer, setFarmer] = useState<any>(null);
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<{ no: string; rows: any[]; total: number; farmerName: string; verifyUrl?: string | null; date?: string; member_no?: string | null; father_name?: string | null; village?: string | null; mobile?: string | null; field_receipt_no?: string | null; amounts?: { savings: number; share: number; loan_principal: number; loan_interest: number; misc: number } } | null>(null);
  const [dues, setDues] = useState<FarmerDuesBreakdown | null>(null);
  const [autoDownload, setAutoDownload] = useState<boolean>(() => {
    try { return localStorage.getItem("combined:autoDl") === "1"; } catch { return false; }
  });
  const isDirty = JSON.stringify(form) !== JSON.stringify(EMPTY);
  const guard = useUnsavedFormGuard("combined-payment-draft", form, isDirty);
  const selectedLoan = useMemo(() => loans.find(l => l.id === form.loan_id), [loans, form.loan_id]);
  const loanAmt = Number(form.loan_principal || 0) + Number(form.loan_interest || 0);
  // Only the principal is capped by the remaining balance; interest is optional.
  const loanExceeds = loanPrincipalExceeds(selectedLoan, Number(form.loan_principal || 0));
  // Suggested accrued interest = remaining principal × (rate%/duration) × months elapsed since last payment/issue
  const suggestedInterest = useMemo(() => calcSuggestedInterest(selectedLoan), [selectedLoan]);
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
        supabase.from("farmers").select("id,name_en,name_bn,farmer_code,member_no,mobile,village,is_voter,savings_inactive,status,father_name").eq("id", form.farmer_id).maybeSingle(),
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

  const farmerInactive = (farmer as any)?.status === "inactive" || !!(farmer as any)?.savings_inactive;
  const memberCheck = farmer ? evaluateMemberEligibility(farmer as any, (en, bn) => (lang === "bn" ? bn : en)) : null;
  const memberIneligible = !!farmer && !!memberCheck && !memberCheck.ok;

  function reset() { setForm({ ...EMPTY }); setLastReceipt(null); guard.clear(); }

  async function submit() {
    if (!form.farmer_id) return toast.error(lang === "bn" ? "কৃষক নির্বাচন করুন" : "Select a farmer");
    if (total <= 0) return toast.error(lang === "bn" ? "অন্তত একটি amount দিন" : "Enter at least one amount");
    if (farmerInactive) return toast.error(lang === "bn" ? `${farmer?.name_en ?? "এই সদস্য"} ইনঅ্যাক্টিভ — নতুন লেনদেন করা যাবে না।` : "Member is inactive — new transactions are not allowed.");
    const elig = evaluateMemberEligibility(farmer as any, (en, bn) => (lang === "bn" ? bn : en));
    if (!elig.ok) return toast.error(elig.reason);
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
        // Voided/cancelled receipt numbers are released and may be reused.
        const { data: dup } = await supabase.from("payments").select("id").eq("receipt_no", manualNo).is("deleted_at", null).neq("status", "voided" as any).limit(1);
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

      // Audit log — record who submitted savings/share/loan repayments and when.
      if (Number(form.savings) > 0 || Number(form.share) > 0) {
        logAudit({
          office_id: officeId, module: "savings_repayment", action_type: "create",
          reference_id: form.farmer_id,
          new_data: { receipt_no: receiptNo, savings: Number(form.savings || 0), share: Number(form.share || 0) },
        });
      }
      if (loanAmt > 0 && form.loan_id) {
        logAudit({
          office_id: officeId, module: "loan_repayment", action_type: "create",
          reference_id: form.loan_id,
          new_data: {
            receipt_no: receiptNo, farmer_id: form.farmer_id,
            principal: Number(form.loan_principal || 0), interest: Number(form.loan_interest || 0),
          },
        });
      }

      const farmerName = farmer?.name_bn || farmer?.name_en || "";
      const verifyUrl = verifyToken ? `${window.location.origin}/r/${verifyToken}` : `${window.location.origin}/r/${receiptNo}`;
      setLastReceipt({
        no: receiptNo, rows, total, farmerName, verifyUrl,
        date: new Date().toISOString(),
        member_no: farmer?.member_no ?? farmer?.farmer_code ?? null,
        father_name: (farmer as any)?.father_name ?? null,
        village: farmer?.village ?? null,
        mobile: farmer?.mobile ?? null,
        field_receipt_no: form.field_receipt_no?.trim() || null,
        amounts: {
          savings: Number(form.savings || 0),
          share: Number(form.share || 0),
          loan_principal: Number(form.loan_principal || 0),
          loan_interest: Number(form.loan_interest || 0),
          misc: 0,
        },
      });

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
    // A5 landscape — matches client's "শেয়ার,সঞ্চয়,ঋণ ও বিবিধ আদায় রশিদ" sample.
    const doc = new jsPDF({ unit: COLLECTION_RECEIPT_PAPER.unit, format: COLLECTION_RECEIPT_PAPER.format, orientation: COLLECTION_RECEIPT_PAPER.orientation });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 14;
    const bnFont = await ensureBanglaFont(doc);
    const setF = () => { if (bnFont) doc.setFont(bnFont, "normal"); else doc.setFont("helvetica", "normal"); };
    const taka = (n: number) => `${toBnDigits(Number(n || 0).toLocaleString("en-US"))}৳`;

    // Header
    setF(); doc.setFontSize(15);
    doc.text(brand.company_name || "মহাম্মদখানি সেচ প্রকল্প", pageW / 2, margin + 2, { align: "center" });
    doc.setFontSize(10);
    doc.text("শেয়ার, সঞ্চয়, ঋণ ও বিবিধ আদায় রশিদ", pageW / 2, margin + 9, { align: "center" });
    doc.setFontSize(9);
    doc.setDrawColor(60); doc.setLineWidth(0.3);
    doc.roundedRect(pageW / 2 - 14, margin + 12, 28, 6, 1, 1);
    doc.text("সদস্য কপি", pageW / 2, margin + 16, { align: "center" });

    // QR (top-right)
    if (lastReceipt.verifyUrl) {
      try {
        const qrUrl = await QRCode.toDataURL(lastReceipt.verifyUrl, { margin: 0, width: 160 });
        doc.addImage(qrUrl, "PNG", pageW - margin - 16, margin - 2, 16, 16);
      } catch { /* ignore */ }
    }

    // Receipt no + date row
    let y = margin + 24;
    setF(); doc.setFontSize(9);
    doc.text(`রশিদ নং: ${toBnDigits(lastReceipt.no)}`, margin, y);
    const dStr = new Date(lastReceipt.date || Date.now()).toLocaleDateString("en-GB").replace(/\//g, "/");
    doc.text(`সংগৃহীত তারিখ: ${toBnDigits(dStr)} ইং`, pageW - margin, y, { align: "right" });
    y += 6;
    doc.setFontSize(8);
    doc.text("আদায়ের তথ্য: শেয়ার / সঞ্চয় / ঋণ / হওলাত গ্রহন / অনুদান / ভাংড়ী বিক্রি / বিবিধ", margin, y);
    y += 4;

    // Body box with label : value rows
    const a = lastReceipt.amounts ?? { savings: 0, share: 0, loan_principal: 0, loan_interest: 0, misc: 0 };
    const memberNameNo = `${lastReceipt.farmerName}${lastReceipt.member_no ? "- " + toBnDigits(lastReceipt.member_no) : ""}`;
    const amtRows: [string, string][] = [
      ["সংগৃহীত সঞ্চয়ের পরিমাণ", a.savings],
      ["সংগৃহীত শেয়ারের পরিমাণ", a.share],
      ["সংগৃহীত ঋণ আদয়", a.loan_principal],
      ["ঋণের লভ্যাংশ আদায়", a.loan_interest],
      ["বিবিধ আদায", a.misc],
    ].filter(([, v]) => Number(v) > 0).map(([l, v]) => [l as string, taka(Number(v))]);
    const lines: [string, string][] = [
      ["সদস্যের নাম / সদস্য নং", memberNameNo],
      ["পিতা / স্বামীর নাম", lastReceipt.father_name || "—"],
      ["গ্রাম", lastReceipt.village || "—"],
      ["মোবাইল নং", lastReceipt.mobile ? toBnDigits(lastReceipt.mobile) : "—"],
      ...amtRows,
      ["মোট আদয়ের পরিমাণ", taka(lastReceipt.total)],
      ["কথায়", `${bnAmountInWords(lastReceipt.total)} টাকা মাত্র।`],
      ["মাঠে আদায় রশিদ নং", lastReceipt.field_receipt_no ? toBnDigits(lastReceipt.field_receipt_no) : "—"],
      ["বিবরন", ""],
    ];
    const totalLabel = "মোট আদয়ের পরিমাণ";
    const rowH = 6.0;
    const boxTop = y;
    const boxH = lines.length * rowH + 4;
    doc.setDrawColor(40); doc.setLineWidth(0.4);
    doc.rect(margin, boxTop, pageW - 2 * margin, boxH);
    const labelX = margin + 3;
    const colonX = margin + 62;
    const valueX = margin + 66;
    let ry = boxTop + 6;
    setF(); doc.setFontSize(9);
    for (const [label, val] of lines) {
      const bold = label === totalLabel;
      doc.setFontSize(bold ? 10 : 9);
      doc.text(label, labelX, ry);
      doc.text(":", colonX, ry);
      doc.text(val, valueX, ry);
      doc.setFontSize(9);
      ry += rowH;
    }
    setF();

    // Signatures
    const sigY = Math.min(boxTop + boxH + 10, doc.internal.pageSize.getHeight() - 6);
    setF(); doc.setFontSize(9);
    doc.text("সদস্যের স্বাক্ষর / টিপসহি", margin, sigY);
    doc.text("আদয়কারীর স্বাক্ষর", pageW - margin, sigY, { align: "right" });

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
              blockInactive
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
            <Label>{lang === "bn" ? "মাঠে আদায় রশিদ নং (ফিল্ড রশিদ)" : "Field collection receipt #"} <span className="text-xs text-muted-foreground">{lang === "bn" ? "(ঐচ্ছিক)" : "(optional)"}</span></Label>
            <Input value={form.field_receipt_no} onChange={(e) => setForm({ ...form, field_receipt_no: e.target.value })}
                   placeholder={lang === "bn" ? "মাঠের হাতে-লেখা রশিদ নং" : "Handwritten field receipt #"} />
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
              <Button onClick={submit} disabled={saving || total <= 0 || !form.farmer_id || loanExceeds || farmerInactive}>
                <Save className="h-4 w-4 mr-1" />{saving ? "…" : (lang === "bn" ? "সংরক্ষণ" : "Save")}
              </Button>
              {farmerInactive && (
                <p className="text-xs text-destructive mt-1 w-full">
                  {lang === "bn" ? "ইনঅ্যাক্টিভ সদস্য — লেনদেন বন্ধ।" : "Inactive member — payments are disabled."}
                </p>
              )}
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
