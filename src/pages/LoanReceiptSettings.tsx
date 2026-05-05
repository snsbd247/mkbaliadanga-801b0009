import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageProvider";
import { notifyBrandingChange, useBranding } from "@/lib/branding";
import { formatLoanReceiptNo } from "@/lib/loanReceiptFormat";

export default function LoanReceiptSettings() {
  const { t } = useLang();
  const { isSuper, rolesLoaded } = useAuth();
  const brand = useBranding();
  const [form, setForm] = useState<any>({});
  const [logo, setLogo] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { document.title = `${t("loanReceiptSettings")} — ${t("appName")}`; }, [t]);
  useEffect(() => { setForm(brand); }, [brand.company_name]);

  if (!rolesLoaded) return <div className="p-6 text-muted-foreground">{t("loading")}</div>;
  if (!isSuper) {
    return (
      <>
        <PageHeader title={t("loanReceiptSettings")} />
        <Alert variant="destructive"><AlertDescription>Restricted to super administrators.</AlertDescription></Alert>
      </>
    );
  }

  async function save() {
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
      loan_receipt_no_format: form.loan_receipt_no_format ?? "LOAN-{YYYYMMDD}-{TAIL}",
      updated_at: new Date().toISOString(),
    } as any).eq("id", 1);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(t("saved"));
    notifyBrandingChange();
    setLogo(null);
  }

  const previewNo = formatLoanReceiptNo(form.loan_receipt_no_format, "abcdef123456", new Date());

  return (
    <>
      <PageHeader title={t("loanReceiptSettings")} description={t("loanReceiptSettingsDesc")} />
      <Card className="max-w-3xl p-6 space-y-4">
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
            <Input value={form.loan_receipt_no_format ?? "LOAN-{YYYYMMDD}-{TAIL}"} onChange={e => setForm({ ...form, loan_receipt_no_format: e.target.value })} className="font-mono" />
            <p className="text-xs text-muted-foreground mt-1">{t("receiptNoFormatHint")}</p>
            <p className="text-xs mt-1">Preview: <span className="font-mono">{previewNo}</span></p>
          </div>
        </div>
        <Button onClick={save} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{t("save")}
        </Button>
      </Card>
    </>
  );
}
