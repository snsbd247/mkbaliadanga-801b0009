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
import { nextMonthlyReceiptNo } from "@/lib/monthlyReceiptNo";
import { getDefaultPaperSize } from "@/lib/receiptLayoutSettings";
import { useUnsavedFormGuard } from "@/hooks/useUnsavedFormGuard";
import { useQueryClient } from "@tanstack/react-query";
import { FormErrorSummary, type FieldError } from "@/components/forms/FormErrorSummary";
import { useFormUx } from "@/hooks/useFormUx";

type LoanRow = { id: string; principal: number; total_payable: number; issued_on: string; remaining: number };
type IrrigationRow = { id: string; invoice_no: string; due_date: string; due_amount: number; paid_amount: number; irrigation_amount: number; delay_fee: number; maintenance_amount: number; canal_amount: number; other_charge: number; office_id: string | null };

const EMPTY = { farmer_id: "", savings: 0, share: 0, loan_id: "", loan_amt: 0, irrigation: 0, method: "cash", note: "" };

export default function CombinedPayment() {
  const { user, officeId } = useAuth();
  const { t, lang } = useLang();
  const brand = useBranding();
  const qc = useQueryClient();
  const [form, setForm] = useState({ ...EMPTY });
  const [farmer, setFarmer] = useState<any>(null);
  const [loans, setLoans] = useState<LoanRow[]>([]);
  const [irrigationInvoices, setIrrigationInvoices] = useState<IrrigationRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<FieldError[]>([]);
  const { registerField, focusField, focusFirstError, preventEnterSubmit } = useFormUx();
  const [lastReceipt, setLastReceipt] = useState<{ no: string; rows: any[]; total: number; farmerName: string; verifyUrl?: string | null } | null>(null);
  const isDirty = JSON.stringify(form) !== JSON.stringify(EMPTY);
  const guard = useUnsavedFormGuard("combined-payment-draft", form, isDirty);
  const selectedLoan = useMemo(() => loans.find(l => l.id === form.loan_id), [loans, form.loan_id]);
  const loanExceeds = !!selectedLoan && Number(form.loan_amt || 0) > selectedLoan.remaining;

  useEffect(() => {
    document.title = `${lang === "bn" ? "সম্মিলিত পেমেন্ট" : "Combined Payment"} — ${t("appName")}`;
    const restored = guard.restore();
    if (restored) setForm(restored as typeof EMPTY);
  }, []);

  useEffect(() => {
    if (!form.farmer_id) { setFarmer(null); setLoans([]); setIrrigationInvoices([]); return; }
    (async () => {
      const [f, lq, iq] = await Promise.all([
        supabase.from("farmers").select("id,name_en,name_bn,farmer_code,member_no,mobile,village").eq("id", form.farmer_id).maybeSingle(),
        supabase.from("loans").select("id,principal,total_payable,issued_on,loan_payments(amount)").eq("farmer_id", form.farmer_id).eq("status", "approved"),
        supabase.from("irrigation_invoices").select("id,invoice_no,due_date,due_amount,paid_amount,irrigation_amount,delay_fee,maintenance_amount,canal_amount,other_charge,office_id").eq("farmer_id", form.farmer_id).is("deleted_at", null).neq("invoice_status", "cancelled").gt("due_amount", 0).order("due_date", { ascending: true }),
      ]);
      setFarmer(f.data ?? null);
      const rows: LoanRow[] = (lq.data ?? []).map((l: any) => {
        const paid = (l.loan_payments ?? []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
        return {
          id: l.id, principal: Number(l.principal || 0),
          total_payable: Number(l.total_payable || l.principal || 0),
          issued_on: l.issued_on,
          remaining: Math.max(0, Number(l.total_payable || l.principal || 0) - paid),
        };
      }).filter(r => r.remaining > 0);
      setLoans(rows);
      setIrrigationInvoices(((iq.data ?? []) as any[]).map((i) => ({
        id: i.id, invoice_no: i.invoice_no, due_date: i.due_date,
        due_amount: Number(i.due_amount || 0), paid_amount: Number(i.paid_amount || 0),
        irrigation_amount: Number(i.irrigation_amount || 0), delay_fee: Number(i.delay_fee || 0),
        maintenance_amount: Number(i.maintenance_amount || 0), canal_amount: Number(i.canal_amount || 0),
        other_charge: Number(i.other_charge || 0), office_id: i.office_id ?? null,
      })));
    })();
  }, [form.farmer_id]);

  const total = useMemo(
    () => Number(form.savings || 0) + Number(form.share || 0) + Number(form.loan_amt || 0) + Number(form.irrigation || 0),
    [form.savings, form.share, form.loan_amt, form.irrigation],
  );
  const irrigationDue = useMemo(() => irrigationInvoices.reduce((s, i) => s + i.due_amount, 0), [irrigationInvoices]);

  function reset() { setForm({ ...EMPTY }); setLastReceipt(null); setFormErrors([]); guard.clear(); }

  function validate(): FieldError[] {
    const errs: FieldError[] = [];
    if (!form.farmer_id) errs.push({ field: "farmer", label: lang === "bn" ? "কৃষক" : "Farmer", message: lang === "bn" ? "নির্বাচন করুন" : "Select a farmer" });
    if (total <= 0) errs.push({ field: "amounts", label: lang === "bn" ? "পরিমাণ" : "Amount", message: lang === "bn" ? "অন্তত একটি amount দিন" : "Enter at least one amount" });
    if (Number(form.savings) < 0 || Number(form.share) < 0 || Number(form.loan_amt) < 0 || Number(form.irrigation) < 0) errs.push({ field: "amounts", label: lang === "bn" ? "পরিমাণ" : "Amount", message: lang === "bn" ? "ঋণাত্মক পরিমাণ অনুমোদিত নয়" : "Negative amounts are not allowed" });
    if (Number(form.loan_amt) > 0 && !form.loan_id) errs.push({ field: "loan", label: lang === "bn" ? "ঋণ" : "Loan", message: lang === "bn" ? "ঋণ নির্বাচন করুন" : "Select a loan" });
    if (loanExceeds) errs.push({ field: "loan_amt", label: lang === "bn" ? "ঋণ পরিশোধ" : "Loan repayment", message: lang === "bn" ? "ঋণের বাকির চেয়ে বেশি দেওয়া যাবে না" : "Cannot exceed remaining balance" });
    if (Number(form.irrigation) > irrigationDue) errs.push({ field: "irrigation", label: lang === "bn" ? "সেচ" : "Irrigation", message: lang === "bn" ? "সেচ বকেয়ার চেয়ে বেশি দেওয়া যাবে না" : "Cannot exceed irrigation due" });
    return errs;
  }

  async function submit() {
    const errs = validate();
    setFormErrors(errs);
    if (errs.length) { focusFirstError(errs.map(e => e.field)); return; }
    setSaving(true);
    try {
      const receiptNo = await nextMonthlyReceiptNo("COMBO", officeId, form.farmer_id);
      const rows: { kind: string; label_bn: string; label_en: string; amount: number }[] = [];
      let verifyUrl: string | null = null;

      // 1) Savings deposit
      if (Number(form.savings) > 0) {
        const { error } = await supabase.from("savings_transactions").insert({
          farmer_id: form.farmer_id, type: "deposit" as any, amount: Number(form.savings),
          note: form.note || "Combined payment", status: "approved" as any, created_by: user?.id,
          receipt_no: receiptNo,
        } as any);
        if (error) throw error;
        const { data: payRow, error: payErr } = await supabase.from("payments").insert({
          farmer_id: form.farmer_id, kind: "savings", amount: Number(form.savings),
          method: form.method, note: form.note || "Combined payment", collected_by: user?.id, receipt_no: receiptNo, status: "approved", office_id: officeId,
        } as any).select("id,verify_token").single();
        if (payErr) throw payErr;
        if (!verifyUrl && payRow?.verify_token) verifyUrl = `${window.location.origin}/r/${payRow.verify_token}`;
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
        const { data: sharePay, error: sharePayErr } = await supabase.from("payments").insert({
          farmer_id: form.farmer_id, kind: "savings", amount: Number(form.share),
          method: form.method, note: form.note || "Share collection", collected_by: user?.id, receipt_no: receiptNo, status: "approved", office_id: officeId,
        } as any).select("id,verify_token").single();
        if (sharePayErr) throw sharePayErr;
        if (!verifyUrl && sharePay?.verify_token) verifyUrl = `${window.location.origin}/r/${sharePay.verify_token}`;
        rows.push({ kind: "share", label_bn: "শেয়ার", label_en: "Share", amount: Number(form.share) });
      }

      // 3) Loan repayment (via payments + payment_allocations)
      if (Number(form.loan_amt) > 0 && form.loan_id) {
        const { data: pay, error: payErr } = await supabase.from("payments").insert({
          farmer_id: form.farmer_id, kind: "loan", amount: Number(form.loan_amt),
          reference_id: form.loan_id, method: form.method, note: form.note || "Combined payment", collected_by: user?.id, receipt_no: receiptNo, status: "approved", office_id: officeId,
        } as any).select("id,verify_token").single();
        if (payErr) throw payErr;
        if (!verifyUrl && pay?.verify_token) verifyUrl = `${window.location.origin}/r/${pay.verify_token}`;
        await supabase.from("payment_allocations").insert({
          payment_id: pay!.id, kind: "loan", reference_id: form.loan_id, amount: Number(form.loan_amt),
        } as any);
        await supabase.from("loan_payments").insert({
          loan_id: form.loan_id, amount: Number(form.loan_amt),
          paid_on: new Date().toISOString().slice(0, 10), collected_by: user?.id,
        } as any);
        rows.push({ kind: "loan", label_bn: "ঋণ পরিশোধ", label_en: "Loan Repayment", amount: Number(form.loan_amt) });
      }

      if (Number(form.irrigation) > 0) {
        let remaining = Number(form.irrigation);
        const selected = irrigationInvoices.filter(i => i.due_amount > 0);
        const { data: pay, error: payErr } = await supabase.from("payments").insert({
          farmer_id: form.farmer_id, kind: "irrigation", amount: Number(form.irrigation),
          reference_id: selected[0]?.id ?? null, method: form.method, note: form.note || "Combined payment", collected_by: user?.id, receipt_no: receiptNo, status: "approved", office_id: officeId,
        } as any).select("id,verify_token").single();
        if (payErr) throw payErr;
        if (!verifyUrl && pay?.verify_token) verifyUrl = `${window.location.origin}/r/${pay.verify_token}`;

        for (const inv of selected) {
          if (remaining <= 0) break;
          const take = Math.min(remaining, inv.due_amount);
          const headTotal = inv.irrigation_amount + inv.delay_fee + inv.maintenance_amount + inv.canal_amount + inv.other_charge;
          const scale = headTotal > 0 ? Math.min(1, take / headTotal) : 0;
          const delay = +(inv.delay_fee * scale).toFixed(2);
          const maintenance = +(inv.maintenance_amount * scale).toFixed(2);
          const canal = +(inv.canal_amount * scale).toFixed(2);
          const base = +(take - delay - maintenance - canal).toFixed(2);
          await supabase.from("irrigation_invoices").update({ paid_amount: inv.paid_amount + take } as any).eq("id", inv.id);
          await supabase.from("payment_allocations").insert({ payment_id: pay!.id, kind: "irrigation", reference_id: inv.id, amount: take } as any);
          await supabase.from("irrigation_invoice_payments").insert({
            invoice_id: inv.id, payment_id: pay!.id, office_id: inv.office_id, collected_amount: take,
            irrigation_collected: Math.max(0, base), delay_fee_collected: delay, maintenance_collected: maintenance, canal_collected: canal,
            current_invoice_collected: take, previous_due_collected: 0, created_by: user?.id,
          } as any);
          remaining = +(remaining - take).toFixed(2);
        }
        rows.push({ kind: "irrigation", label_bn: "সেচ", label_en: "Irrigation", amount: Number(form.irrigation) });
      }

      const farmerName = farmer?.name_bn || farmer?.name_en || "";
      setLastReceipt({ no: receiptNo, rows, total, farmerName, verifyUrl });
      guard.clear();
      setFormErrors([]);
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
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function printReceipt() {
    if (!lastReceipt) return;
    const paper = getDefaultPaperSize();
    const doc = new jsPDF({ unit: "mm", format: paper });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 12;
    doc.setFont("helvetica", "bold"); doc.setFontSize(13);
    doc.text(brand.company_name || "Combined Receipt", pageW / 2, margin + 5, { align: "center" });
    doc.setFontSize(11); doc.text("COMBINED PAYMENT RECEIPT", pageW / 2, margin + 12, { align: "center" });
    doc.setDrawColor(31, 78, 121); doc.setLineWidth(0.6);
    doc.line(margin, margin + 15, pageW - margin, margin + 15);
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
              onChange={(id) => setForm({ ...form, farmer_id: id ?? "", loan_id: "", loan_amt: 0 })}
            />
          </div>
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
              <Label>{lang === "bn" ? "ঋণ পরিশোধ (৳)" : "Loan Repayment (৳)"}</Label>
              <Input type="number" min={0} step="0.01" disabled={!form.loan_id} value={form.loan_amt}
                     aria-invalid={loanExceeds || undefined}
                     onChange={(e) => setForm({ ...form, loan_amt: Number(e.target.value) || 0 })} />
              {selectedLoan && (
                <div className={`text-xs mt-1 ${loanExceeds ? "text-destructive" : "text-muted-foreground"}`}>
                  {lang === "bn" ? "বাকি" : "Remaining"}: {money(selectedLoan.remaining)}
                  {loanExceeds && (lang === "bn" ? " — বাকির চেয়ে বেশি" : " — exceeds remaining")}
                </div>
              )}
            </div>
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
