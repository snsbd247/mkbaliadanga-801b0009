import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";
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
import { getReceiptLayoutSettings, setReceiptLayoutSettings, resetReceiptLayoutSettings } from "@/lib/receiptLayoutSettings";
import { buildReceiptCopyHtmlForTest } from "@/lib/bnReceipts";
import BanglaFontSelector from "@/components/settings/BanglaFontSelector";
import { downloadIrrigationInvoicePdf } from "@/lib/irrigationInvoicePdf";
import { exportInvoicesXLSX } from "@/lib/irrigationExports";
import { LanguageToggle } from "@/components/LanguageToggle";

export default function Settings() {
  const { t, lang } = useLang();
  const { isSuper, rolesLoaded } = useAuth();
  const brand = useBranding();
  const [form, setForm] = useState<any>(brand);
  const [logo, setLogo] = useState<File | null>(null);
  const [signature, setSignature] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { document.title = `${t("settings")} — ${t("appName")}`; }, [t]);
  useEffect(() => { setForm(brand); }, [brand]);

  if (!rolesLoaded) return <div className="p-6 text-muted-foreground">{t("loading")}</div>;
  if (!isSuper) return <Navigate to="/" replace />;

  async function save() {
    setBusy(true);
    let logo_url = form.logo_url;
    if (logo) {
      const ext = logo.name.split(".").pop();
      const path = `logo-${Date.now()}.${ext}`;
      const up = await db.storage.from("branding").upload(path, logo, { upsert: true });
      if (up.error) { setBusy(false); return toast.error(up.error.message); }
      logo_url = db.storage.from("branding").getPublicUrl(path).data.publicUrl;
    }
    let editor_signature_url = form.editor_signature_url;
    if (signature) {
      const ext = signature.name.split(".").pop();
      const path = `editor-signature-${Date.now()}.${ext}`;
      const up = await db.storage.from("branding").upload(path, signature, { upsert: true });
      if (up.error) { setBusy(false); return toast.error(up.error.message); }
      editor_signature_url = db.storage.from("branding").getPublicUrl(path).data.publicUrl;
    }
    const payload = {
      company_name: form.company_name,
      company_name_bn: form.company_name_bn,
      logo_url,
      editor_signature_url,
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
    };
    const { data: updated, error } = await db
      .from("company_settings")
      .update(payload as any)
      .eq("id", 1)
      .select();
    if (error) { setBusy(false); return toast.error(error.message); }
    // If no row with id=1 existed (e.g. after data migration), create it so the
    // settings actually persist instead of silently updating zero rows.
    if (!updated || (Array.isArray(updated) && updated.length === 0)) {
      const { error: insErr } = await db
        .from("company_settings")
        .insert({ id: 1, ...payload } as any);
      if (insErr) { setBusy(false); return toast.error(insErr.message); }
    }
    setBusy(false);
    toast.success(t("saved"));
    setForm((prev: any) => ({ ...prev, ...payload }));
    notifyBrandingChange();
    setLogo(null);
    setSignature(null);
  }


  return (
    <>
      <PageHeader title={t("settings")} description={t("branding")} />
      <Card className="max-w-2xl p-6 mb-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="text-base">{lang === "bn" ? "ভাষা" : "Language"}</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              {lang === "bn"
                ? "ইন্টারফেসের ভাষা নির্বাচন করুন। নির্বাচন আপনার জন্য সংরক্ষিত থাকবে।"
                : "Choose the interface language. Your choice is saved for you."}
            </p>
          </div>
          <LanguageToggle />
        </div>
      </Card>
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
              {(logo || form.logo_url) && (
                <img
                  src={logo ? URL.createObjectURL(logo) : form.logo_url}
                  className="mt-2 h-14 w-14 rounded border bg-white object-contain p-1"
                  alt="logo"
                />
              )}
            </div>
            <div>
              <Label>{lang === "bn" ? "সম্পাদকের স্বাক্ষর" : "Editor signature"}</Label>
              <Input type="file" accept="image/*" onChange={e => setSignature(e.target.files?.[0] ?? null)} />
              {(signature || form.editor_signature_url) && (
                <img
                  src={signature ? URL.createObjectURL(signature) : form.editor_signature_url}
                  className="mt-2 h-12 rounded border bg-white object-contain px-2"
                  alt="signature"
                />
              )}
              <p className="mt-1 text-xs text-muted-foreground">{lang === "bn" ? "আপলোড করলে রশিদে আদায়কারীর স্বাক্ষরের জায়গায় অটো বসবে।" : "Auto-placed on receipts where the collector signs."}</p>

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
              <h3 className="font-semibold mb-2">{t("set_pdfFooter" as any)}</h3>
              <div className="grid gap-3">
                <div>
                  <Label>{t("set_returnInstruction" as any)}</Label>
                  <textarea
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-20"
                    value={form.pdf_footer_text ?? ""}
                    onChange={e => setForm({ ...form, pdf_footer_text: e.target.value })}
                    placeholder={t("set_returnInstructionPh" as any)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">{t("set_returnInstructionHint" as any)}</p>
                </div>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!form.pdf_footer_show_address}
                      onChange={e => setForm({ ...form, pdf_footer_show_address: e.target.checked })} />
                    {t("set_showAddressInFooter" as any)}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!form.pdf_footer_show_contact}
                      onChange={e => setForm({ ...form, pdf_footer_show_contact: e.target.checked })} />
                    {t("set_showContactInFooter" as any)}
                  </label>
                </div>
              </div>
            </div>
          </div>
          <Button onClick={save} disabled={busy}>{busy ? "…" : t("save")}</Button>
        </div>
      </Card>
      <RoundingCard />
      <BanglaFontSelector />
      <ReceiptLayoutCard />
      <Card className="max-w-2xl p-6 mt-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold">{t("set_rlsDiagnostics" as any)}</div>
            <div className="text-sm text-muted-foreground">{t("rlsDiagnosticsDesc")}</div>
          </div>
          <a href="/diagnostics" className="text-sm font-medium text-primary hover:underline">{t("open")} →</a>
        </div>
      </Card>
    </>
  );
}

function RoundingCard() {
  const { tx } = useLang();
  const [mode, setMode] = useState<string>(() => {
    try { return localStorage.getItem("taka_rounding_mode_v1") ?? "half_up"; } catch { return "half_up"; }
  });
  const opts: Array<{ v: string; label: string; desc: string }> = [
    { v: "half_up", label: tx("≥ .50 → 1 Taka (default)", "≥ .50 → ১ টাকা (default)"), desc: tx("Round up if ≥ .50, else down to 0", "≥ .50 হলে উপরে, নিচে হলে ০") },
    { v: "half_even", label: tx("Banker's (half-even)", "Banker's (half-even)"), desc: tx("If .5, round to nearest even number", ".5 হলে নিকটতম জোড় সংখ্যায়") },
    { v: "floor", label: tx("Floor (always down)", "Floor (নিচের দিকে)"), desc: tx("Always round down", "সর্বদা নিচের দিকে") },
    { v: "ceil", label: tx("Ceil (always up)", "Ceil (উপরের দিকে)"), desc: tx("Always round up", "সর্বদা উপরের দিকে") },
  ];
  return (
    <Card className="max-w-2xl p-6 mt-4">
      <div className="font-semibold mb-1">{tx("Taka Rounding Rule", "টাকা রাউন্ডিং নিয়ম")}</div>
      <div className="text-sm text-muted-foreground mb-3">
        {tx("This rule controls how amounts are rounded to whole taka in invoices, receipts, payment slips, and reports.", "ইনভয়েস, রশিদ, পেমেন্ট রিসিপ্ট ও রিপোর্ট সব জায়গায় এই নিয়মে এমাউন্ট পুরো টাকায় দেখাবে।")}
      </div>
      <div className="grid gap-2">
        {opts.map((o) => (
          <label key={o.v} className="flex items-start gap-2 text-sm cursor-pointer">
            <input type="radio" name="rounding-mode" className="mt-1" checked={mode === o.v}
              onChange={() => {
                setMode(o.v);
                try { localStorage.setItem("taka_rounding_mode_v1", o.v); } catch { /* ignore */ }
                toast.success(tx("Rounding rule updated. Will apply to new reports/receipts.", "রাউন্ডিং নিয়ম আপডেট হয়েছে। নতুন রিপোর্ট/রশিদে কার্যকর হবে।"));
              }} />
            <span>
              <span className="font-medium">{o.label}</span>
              <span className="block text-xs text-muted-foreground">{o.desc}</span>
            </span>
          </label>
        ))}
      </div>
    </Card>
  );
}

function ReceiptLayoutCard() {
  const [s, setS] = useState(() => getReceiptLayoutSettings());
  const [lang, setLang] = useState<"bn" | "en">("bn");
  const update = (patch: any) => {
    const next = setReceiptLayoutSettings(patch);
    setS(next);
  };
  const seps: Array<{ v: "comma" | "newline" | "semicolon"; label: string }> = [
    { v: "comma", label: "কমা ( , )" },
    { v: "newline", label: "নতুন লাইন" },
    { v: "semicolon", label: "সেমিকোলন ( ; )" },
  ];

  // Build live preview HTML — re-renders whenever `s` or `lang` changes.
  const previewHtml = buildReceiptCopyHtmlForTest(
    {
      kind: "irrigation",
      receipt_no: "PREVIEW-001",
      date: new Date().toISOString(),
      farmer: {
        name: lang === "bn" ? "করিম মিয়া" : "Karim Mia",
        member_no: "M-101",
        village: lang === "bn" ? "বালিয়াডাঙ্গা" : "Baliadanga",
        mobile: "017XXXXXXXX",
        mouza: lang === "bn" ? "বালিয়াডাঙ্গা" : "Baliadanga",
        land_size: 33,
        dag_no: "123, 124/A, 125-B",
      },
      collected_amount: 500,
      collector_signature_url: null,
      total_outstanding: 0,
    },
    "farmer",
    lang,
  );

  async function downloadSamplePdf() {
    try {
      await downloadIrrigationInvoicePdf({
        invoice_no: "PREVIEW-001",
        generated_at: new Date().toISOString(),
        irrigation_amount: 400, maintenance_amount: 50, canal_amount: 25, delay_fee: 25,
        payable_amount: 500, paid_amount: 0, due_amount: 500,
        invoice_status: "generated",
        farmer: { name: "Karim Mia", farmer_code: "00101", mobile: "017", village: "Baliadanga" },
        land: { mouza: "Baliadanga", dag_no: "123, 124/A, 125-B", land_size: 33 },
        season: { name: "Boro", year: 2026 },
      } as any, "farmer");
      toast.success("নমুনা PDF ডাউনলোড হয়েছে");
    } catch (e: any) { toast.error(e?.message ?? "PDF generate failed"); }
  }

  async function downloadSampleExcel() {
    try {
      exportInvoicesXLSX([{
        invoice_no: "PREVIEW-001",
        farmers: { name_bn: "Karim Mia", farmer_code: "00101", mobile: "017" },
        lands: { mouza: "Baliadanga", dag_no: "123, 124/A, 125-B", land_size: 33 },
        seasons: { name: "Boro", year: 2026 },
        invoice_status: "generated",
        payable_amount: 500, paid_amount: 0, due_amount: 500,
      }], "preview-irrigation-sample.xlsx");
      toast.success("নমুনা Excel ডাউনলোড হয়েছে");
    } catch (e: any) { toast.error(e?.message ?? "Excel export failed"); }
  }

  return (
    <Card className="max-w-2xl p-6 mt-4">
      <div className="font-semibold mb-1">সেচ রিসিপ্ট লে-আউট</div>
      <div className="text-sm text-muted-foreground mb-3">
        মাল্টিপল দাগ নম্বর কীভাবে দেখাবে, রো-এর লেবেল ও স্পেসিং কাস্টমাইজ করুন। লাইভ প্রিভিউ পাশে দেখুন। অন্য মডিউলে প্রভাব পড়বে না।
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div>
          <div className="mb-4">
            <div className="text-sm font-medium mb-2">দাগ নম্বর সেপারেটর</div>
            <div className="grid gap-2">
              {seps.map((o) => (
                <label key={o.v} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="dag-sep" checked={s.dagSeparator === o.v}
                    onChange={() => update({ dagSeparator: o.v })} />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-3 mb-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase">সেচ লেবেল</div>
            <label className="text-sm">
              <div className="font-medium mb-1">মৌজা/জমির পরিমান (BN)</div>
              <input className="w-full border rounded px-2 py-1 bg-background" value={s.mouzaLabelBn}
                placeholder="মৌজা / জমির পরিমান:" onChange={(e) => update({ mouzaLabelBn: e.target.value })} />
            </label>
            <label className="text-sm">
              <div className="font-medium mb-1">Mouza/Land (EN)</div>
              <input className="w-full border rounded px-2 py-1 bg-background" value={s.mouzaLabelEn}
                placeholder="Mouza / Land size:" onChange={(e) => update({ mouzaLabelEn: e.target.value })} />
            </label>
            <label className="text-sm">
              <div className="font-medium mb-1">দাগ নং (BN)</div>
              <input className="w-full border rounded px-2 py-1 bg-background" value={s.dagLabelBn}
                placeholder="দাগ নং:" onChange={(e) => update({ dagLabelBn: e.target.value })} />
            </label>
            <label className="text-sm">
              <div className="font-medium mb-1">Dag no (EN)</div>
              <input className="w-full border rounded px-2 py-1 bg-background" value={s.dagLabelEn}
                placeholder="Dag no:" onChange={(e) => update({ dagLabelEn: e.target.value })} />
            </label>
          </div>

          <div className="grid gap-3 mb-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase">সঞ্চয় লেবেল</div>
            <label className="text-sm">
              <div className="font-medium mb-1">বিবরণ (BN) / Description (EN)</div>
              <div className="grid grid-cols-2 gap-2">
                <input className="border rounded px-2 py-1 bg-background" value={s.savingsDescLabelBn}
                  placeholder="বিবরণ:" onChange={(e) => update({ savingsDescLabelBn: e.target.value })} />
                <input className="border rounded px-2 py-1 bg-background" value={s.savingsDescLabelEn}
                  placeholder="Description:" onChange={(e) => update({ savingsDescLabelEn: e.target.value })} />
              </div>
            </label>
            <label className="text-sm">
              <div className="font-medium mb-1">বর্তমান স্থিতি / Balance</div>
              <div className="grid grid-cols-2 gap-2">
                <input className="border rounded px-2 py-1 bg-background" value={s.savingsBalanceLabelBn}
                  placeholder="বর্তমান স্থিতি:" onChange={(e) => update({ savingsBalanceLabelBn: e.target.value })} />
                <input className="border rounded px-2 py-1 bg-background" value={s.savingsBalanceLabelEn}
                  placeholder="Current balance:" onChange={(e) => update({ savingsBalanceLabelEn: e.target.value })} />
              </div>
            </label>
          </div>

          <div className="grid gap-3 mb-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase">ঋণ লেবেল</div>
            <label className="text-sm">
              <div className="font-medium mb-1">ঋণের বিবরণ / Loan description</div>
              <div className="grid grid-cols-2 gap-2">
                <input className="border rounded px-2 py-1 bg-background" value={s.loanDescLabelBn}
                  placeholder="ঋণের বিবরণ:" onChange={(e) => update({ loanDescLabelBn: e.target.value })} />
                <input className="border rounded px-2 py-1 bg-background" value={s.loanDescLabelEn}
                  placeholder="Loan description:" onChange={(e) => update({ loanDescLabelEn: e.target.value })} />
              </div>
            </label>
            <label className="text-sm">
              <div className="font-medium mb-1">অবশিষ্ট ঋণ / Loan outstanding</div>
              <div className="grid grid-cols-2 gap-2">
                <input className="border rounded px-2 py-1 bg-background" value={s.loanOutstandingLabelBn}
                  placeholder="অবশিষ্ট ঋণ:" onChange={(e) => update({ loanOutstandingLabelBn: e.target.value })} />
                <input className="border rounded px-2 py-1 bg-background" value={s.loanOutstandingLabelEn}
                  placeholder="Loan outstanding:" onChange={(e) => update({ loanOutstandingLabelEn: e.target.value })} />
              </div>
            </label>
          </div>

          <label className="text-sm block mb-2">
            <div className="font-medium mb-1">সেচ রিসিপ্ট রো স্পেসিং (px): {s.rowSpacingPx}</div>
            <input type="range" min={2} max={12} value={s.rowSpacingPx}
              onChange={(e) => update({ rowSpacingPx: Number(e.target.value) })}
              className="w-full" />
          </label>
          <label className="text-sm block mb-2">
            <div className="font-medium mb-1">সঞ্চয় রিসিপ্ট রো স্পেসিং (px): {s.savingsRowSpacingPx}</div>
            <input type="range" min={2} max={12} value={s.savingsRowSpacingPx}
              onChange={(e) => update({ savingsRowSpacingPx: Number(e.target.value) })}
              className="w-full" />
          </label>
          <label className="text-sm block mb-4">
            <div className="font-medium mb-1">ঋণ রিসিপ্ট রো স্পেসিং (px): {s.loanRowSpacingPx}</div>
            <input type="range" min={2} max={12} value={s.loanRowSpacingPx}
              onChange={(e) => update({ loanRowSpacingPx: Number(e.target.value) })}
              className="w-full" />
          </label>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => {
              const next = resetReceiptLayoutSettings();
              setS(next);
              toast.success("রিসিপ্ট লে-আউট ডিফল্টে রিসেট হয়েছে");
            }}>ডিফল্টে রিসেট</Button>
            <Button variant="outline" size="sm" onClick={downloadSamplePdf}>নমুনা PDF</Button>
            <Button variant="outline" size="sm" onClick={downloadSampleExcel}>নমুনা Excel</Button>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium">লাইভ প্রিভিউ (HTML রিসিপ্ট)</div>
            <div className="flex gap-1">
              <button className={`text-xs px-2 py-1 rounded border ${lang === "bn" ? "bg-primary text-primary-foreground" : "bg-background"}`}
                onClick={() => setLang("bn")}>BN</button>
              <button className={`text-xs px-2 py-1 rounded border ${lang === "en" ? "bg-primary text-primary-foreground" : "bg-background"}`}
                onClick={() => setLang("en")}>EN</button>
            </div>
          </div>
          <div className="border rounded bg-card overflow-auto max-h-[640px] text-foreground"
            style={{ transform: "scale(0.78)", transformOrigin: "top left", width: "128%" }}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: previewHtml }} />
          <div className="text-xs text-muted-foreground mt-2">
            পরিবর্তন করার সাথে সাথে এখানে ইনস্ট্যান্টলি দেখাবে। PDF/Excel-এও ঠিক একই লেবেল ও সেপারেটর ব্যবহার হবে।
          </div>
        </div>
      </div>
    </Card>
  );
}
