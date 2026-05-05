import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Save, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageProvider";
import { notifyBrandingChange, useBranding } from "@/lib/branding";
import { formatLoanReceiptNo } from "@/lib/loanReceiptFormat";
import { money } from "@/lib/format";

const KNOWN_TOKENS = ["{YYYY}", "{MM}", "{DD}", "{YYYYMMDD}", "{TAIL}"];

function validateTemplate(tpl: string): { warnings: string[]; unknown: string[] } {
  const warnings: string[] = [];
  const unknown: string[] = [];
  if (!tpl || !tpl.trim()) warnings.push("Template is empty — default will be used.");
  const tokens = tpl.match(/\{[^}]+\}/g) ?? [];
  for (const tk of tokens) if (!KNOWN_TOKENS.includes(tk)) unknown.push(tk);
  if (!tpl.includes("{TAIL}")) warnings.push("Missing {TAIL} — receipt numbers may collide.");
  if (!/[{YYYY}{MM}{DD}{YYYYMMDD}]/.test(tpl)) {
    if (!tpl.includes("{YYYYMMDD}") && !tpl.includes("{YYYY}")) warnings.push("Consider including a date token like {YYYYMMDD}.");
  }
  return { warnings, unknown };
}

export default function LoanReceiptSettings() {
  const { t, lang } = useLang();
  const { isAdmin, rolesLoaded } = useAuth();
  const brand = useBranding();
  const [form, setForm] = useState<any>({});
  const [logo, setLogo] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { document.title = `${t("loanReceiptSettings")} — ${t("appName")}`; }, [t]);
  useEffect(() => { setForm(brand); }, [brand.company_name]);

  if (!rolesLoaded) return <div className="p-6 text-muted-foreground">{t("loading")}</div>;
  if (!isAdmin) {
    return (
      <>
        <PageHeader title={t("loanReceiptSettings")} />
        <Alert variant="destructive"><AlertDescription>Restricted to admin / super admin.</AlertDescription></Alert>
      </>
    );
  }

  const tpl = form.loan_receipt_no_format ?? "LOAN-{YYYYMMDD}-{TAIL}";
  const { warnings, unknown } = useMemo(() => validateTemplate(tpl), [tpl]);
  const previewNo = formatLoanReceiptNo(tpl, "abcdef123456", new Date());

  async function save() {
    if (unknown.length) {
      const ok = window.confirm(`Unknown tokens detected: ${unknown.join(", ")}\n\nThey will be left as-is in receipt numbers. Save anyway?`);
      if (!ok) return;
    }
    setBusy(true);
    let logo_url = form.logo_url;
    if (logo) {
      const ext = logo.name.split(".").pop();
      const path = `logo-${Date.now()}.${ext}`;
      const up = await supabase.storage.from("branding").upload(path, logo, { upsert: true });
      if (up.error) { setBusy(false); return toast.error(up.error.message); }
      logo_url = supabase.storage.from("branding").getPublicUrl(path).data.publicUrl;
    }
    const { error } = await supabase.from("company_settings").update({
      logo_url,
      loan_receipt_header_en: form.loan_receipt_header_en ?? "",
      loan_receipt_header_bn: form.loan_receipt_header_bn ?? "",
      loan_receipt_footer_en: form.loan_receipt_footer_en ?? "",
      loan_receipt_footer_bn: form.loan_receipt_footer_bn ?? "",
      loan_receipt_no_format: tpl,
      updated_at: new Date().toISOString(),
    } as any).eq("id", 1);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(t("saved"));
    notifyBrandingChange();
    setLogo(null);
  }

  const headerText = lang === "bn" ? (form.loan_receipt_header_bn || form.loan_receipt_header_en) : (form.loan_receipt_header_en || form.loan_receipt_header_bn);
  const footerText = lang === "bn" ? (form.loan_receipt_footer_bn || form.loan_receipt_footer_en) : (form.loan_receipt_footer_en || form.loan_receipt_footer_bn);
  const companyName = lang === "bn" ? (form.company_name_bn || form.company_name) : (form.company_name || form.company_name_bn);

  return (
    <>
      <PageHeader title={t("loanReceiptSettings")} description={t("loanReceiptSettingsDesc")} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-6 space-y-4">
          <div>
            <Label>{t("logo")}</Label>
            <Input type="file" accept="image/*" onChange={e => setLogo(e.target.files?.[0] ?? null)} />
            {form.logo_url && !logo && <img src={form.logo_url} className="mt-2 h-14 w-14 rounded object-cover" alt="logo" />}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>{t("receiptHeaderEn")}</Label>
              <Textarea rows={2} value={form.loan_receipt_header_en ?? ""} onChange={e => setForm({ ...form, loan_receipt_header_en: e.target.value })} />
            </div>
            <div>
              <Label>{t("receiptHeaderBn")}</Label>
              <Textarea rows={2} value={form.loan_receipt_header_bn ?? ""} onChange={e => setForm({ ...form, loan_receipt_header_bn: e.target.value })} />
            </div>
            <div>
              <Label>{t("receiptFooterEn")}</Label>
              <Textarea rows={2} value={form.loan_receipt_footer_en ?? ""} onChange={e => setForm({ ...form, loan_receipt_footer_en: e.target.value })} />
            </div>
            <div>
              <Label>{t("receiptFooterBn")}</Label>
              <Textarea rows={2} value={form.loan_receipt_footer_bn ?? ""} onChange={e => setForm({ ...form, loan_receipt_footer_bn: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>{t("receiptNoFormat")}</Label>
              <Input value={tpl} onChange={e => setForm({ ...form, loan_receipt_no_format: e.target.value })} className="font-mono" />
              <p className="text-xs text-muted-foreground mt-1">{t("receiptNoFormatHint")} — Tokens: {KNOWN_TOKENS.join(" ")}</p>
              <p className="text-xs mt-1">Preview: <span className="font-mono font-semibold">{previewNo}</span></p>
              {(warnings.length > 0 || unknown.length > 0) && (
                <Alert className="mt-2 border-amber-500/50 bg-amber-500/5">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-xs">
                    {unknown.length > 0 && <div><strong>Unknown tokens:</strong> {unknown.join(", ")}</div>}
                    {warnings.map((w, i) => <div key={i}>{w}</div>)}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
          <Button onClick={save} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}{t("save")}
          </Button>
        </Card>

        {/* Live preview */}
        <Card className="p-6 space-y-3 bg-white text-black">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Preview</div>
          <div className="border rounded-md p-5 space-y-3" style={{ fontFamily: "serif" }}>
            <div className="flex items-center gap-3 border-b pb-3">
              {(logo ? URL.createObjectURL(logo) : form.logo_url) && (
                <img src={logo ? URL.createObjectURL(logo) : form.logo_url} className="h-12 w-12 rounded object-cover" alt="logo" />
              )}
              <div className="flex-1">
                <div className="text-lg font-bold">{companyName}</div>
                {headerText && <div className="text-xs whitespace-pre-wrap text-gray-700">{headerText}</div>}
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <div><strong>Receipt #:</strong> <span className="font-mono">{previewNo}</span></div>
              <div><strong>Date:</strong> {new Date().toLocaleDateString()}</div>
            </div>
            <table className="w-full text-sm border-t border-b">
              <tbody>
                <tr><td className="py-1">{t("farmerName")}</td><td className="py-1 text-right">— Sample Farmer —</td></tr>
                <tr><td className="py-1">Loan ID</td><td className="py-1 text-right font-mono">SAMPLE-001</td></tr>
                <tr><td className="py-1">{t("amount")}</td><td className="py-1 text-right">{money(5000)}</td></tr>
              </tbody>
            </table>
            {footerText && <div className="text-xs whitespace-pre-wrap text-gray-600 pt-2">{footerText}</div>}
          </div>
        </Card>
      </div>
    </>
  );
}
