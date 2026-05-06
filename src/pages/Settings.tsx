import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useLang } from "@/i18n/LanguageProvider";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { Navigate } from "react-router-dom";
import { notifyBrandingChange, useBranding } from "@/lib/branding";

export default function Settings() {
  const { t } = useLang();
  const { isSuper, rolesLoaded } = useAuth();
  const brand = useBranding();
  const [form, setForm] = useState<any>(brand);
  const [logo, setLogo] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { document.title = `${t("settings")} — ${t("appName")}`; }, [t]);
  useEffect(() => { setForm(brand); }, [brand.company_name]);

  if (!rolesLoaded) return <div className="p-6 text-muted-foreground">{t("loading")}</div>;
  if (!isSuper) return <Navigate to="/" replace />;

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
      company_name: form.company_name,
      company_name_bn: form.company_name_bn,
      logo_url,
      email: form.email,
      mobile: form.mobile,
      address: form.address,
      default_loan_interest: Number(form.default_loan_interest ?? 0),
      penalty_type: form.penalty_type ?? "flat",
      penalty_value: Number(form.penalty_value ?? 0),
      penalty_grace_days: Number(form.penalty_grace_days ?? 30),
      pdf_footer_text: form.pdf_footer_text ?? "",
      pdf_footer_show_address: !!form.pdf_footer_show_address,
      pdf_footer_show_contact: !!form.pdf_footer_show_contact,
      updated_at: new Date().toISOString(),
    } as any).eq("id", 1);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(t("saved"));
    notifyBrandingChange();
    setLogo(null);
  }

  return (
    <>
      <PageHeader title={t("settings")} description={t("branding")} />
      <Card className="max-w-2xl p-6">
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>{t("companyName")} (EN)</Label>
              <Input value={form.company_name ?? ""} onChange={e => setForm({ ...form, company_name: e.target.value })} />
            </div>
            <div>
              <Label>{t("companyName")} (BN)</Label>
              <Input value={form.company_name_bn ?? ""} onChange={e => setForm({ ...form, company_name_bn: e.target.value })} />
            </div>
            <div>
              <Label>{t("email")}</Label>
              <Input type="email" value={form.email ?? ""} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>{t("mobile")}</Label>
              <Input value={form.mobile ?? ""} onChange={e => setForm({ ...form, mobile: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>{t("address")}</Label>
              <Input value={form.address ?? ""} onChange={e => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <Label>{t("defaultLoanInterest")}</Label>
              <Input type="number" step="0.01" value={form.default_loan_interest ?? 0} onChange={e => setForm({ ...form, default_loan_interest: e.target.value })} />
            </div>
            <div>
              <Label>{t("logo")}</Label>
              <Input type="file" accept="image/*" onChange={e => setLogo(e.target.files?.[0] ?? null)} />
              {form.logo_url && !logo && <img src={form.logo_url} className="mt-2 h-14 w-14 rounded object-cover" alt="logo" />}
            </div>
            <div className="sm:col-span-2 border-t pt-4 mt-2">
              <h3 className="font-semibold mb-2">{t("irrigationPenalty")}</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label>{t("penaltyType")}</Label>
                  <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={form.penalty_type ?? "flat"} onChange={e => setForm({ ...form, penalty_type: e.target.value })}>
                    <option value="none">{t("set_penaltyNone" as any)}</option>
                    <option value="flat">{t("set_penaltyFlat" as any)}</option>
                    <option value="percent">{t("set_penaltyPercent" as any)}</option>
                  </select>
                </div>
                <div>
                  <Label>{t("penaltyValue")}</Label>
                  <Input type="number" step="0.01" value={form.penalty_value ?? 0} onChange={e => setForm({ ...form, penalty_value: e.target.value })} />
                </div>
                <div>
                  <Label>{t("graceDays")}</Label>
                  <Input type="number" value={form.penalty_grace_days ?? 30} onChange={e => setForm({ ...form, penalty_grace_days: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="sm:col-span-2 border-t pt-4 mt-2">
              <h3 className="font-semibold mb-2">PDF Footer</h3>
              <div className="grid gap-3">
                <div>
                  <Label>Return Instruction / Footer Text</Label>
                  <textarea
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-20"
                    value={form.pdf_footer_text ?? ""}
                    onChange={e => setForm({ ...form, pdf_footer_text: e.target.value })}
                    placeholder="e.g. If found, please return to the issuing office."
                  />
                  <p className="text-xs text-muted-foreground mt-1">Shown in the footer of every generated PDF report.</p>
                </div>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!form.pdf_footer_show_address}
                      onChange={e => setForm({ ...form, pdf_footer_show_address: e.target.checked })} />
                    Show office address in footer
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!form.pdf_footer_show_contact}
                      onChange={e => setForm({ ...form, pdf_footer_show_contact: e.target.checked })} />
                    Show mobile / email in footer
                  </label>
                </div>
              </div>
            </div>
          </div>
          <Button onClick={save} disabled={busy}>{busy ? "…" : t("save")}</Button>
        </div>
      </Card>
      <Card className="max-w-2xl p-6 mt-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold">RLS Diagnostics</div>
            <div className="text-sm text-muted-foreground">{t("rlsDiagnosticsDesc")}</div>
          </div>
          <a href="/diagnostics" className="text-sm font-medium text-primary hover:underline">{t("open")} →</a>
        </div>
      </Card>
    </>
  );
}
