import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Save, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { MembershipCard, type CardData } from "@/components/card/MembershipCard";
import { TEMPLATE_LIST, type TemplateId } from "@/components/card/templates";
import { DEFAULT_CARD_SETTINGS, notifyCardSettingsChange, type CardSettings } from "@/lib/cardSettings";
import { useBranding } from "@/lib/branding";

const SAMPLE: CardData = {
  company_name: "Smart Irrigation Cooperative",
  company_name_bn: "স্মার্ট সেচ ও সমবায়",
  farmer: {
    name: "Md. Rahim Uddin",
    name_en: "Md. Rahim Uddin",
    account_number: "2401510064476",
    voter_number: "6656984",
    photo_url: null,
    village: "Baliadanga",
    mobile: "01•••••3456",
  },
  token: "demo",
  qr_value: `${typeof window !== "undefined" ? window.location.origin : ""}/scan?acc=2401510064476`,
  issued_at: new Date().toISOString(),
};

import { useLang } from "@/i18n/LanguageProvider";

export default function CardDesigner() {
  const { isSuper } = useAuth();
  const { t } = useLang();
  const brand = useBranding();
  const [s, setS] = useState<CardSettings>(DEFAULT_CARD_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = t("cd_title" as any);
    (async () => {
      const { data } = await supabase.from("card_settings").select("*").eq("id", 1).maybeSingle();
      if (data) setS({ ...DEFAULT_CARD_SETTINGS, ...(data as any) });
      setLoading(false);
    })();
  }, [t]);

  async function save() {
    setSaving(true);
    try {
      const { error } = await supabase.from("card_settings").update({
        template_id: s.template_id,
        accent_color: s.accent_color,
        header_text: s.header_text,
        header_text_bn: s.header_text_bn,
        show_photo: s.show_photo,
        show_account_number: s.show_account_number,
        show_voter_number: s.show_voter_number,
        show_issue_date: s.show_issue_date,
        show_qr: s.show_qr,
        photo_size_mm: s.photo_size_mm,
        font_scale: s.font_scale,
        header_height_mm: s.header_height_mm,
        logo_size_mm: s.logo_size_mm,
        custom_text: s.custom_text,
        custom_text_bn: s.custom_text_bn,
        updated_at: new Date().toISOString(),
      }).eq("id", 1);
      if (error) { toast.error(error.message); return; }
      notifyCardSettingsChange();
      toast.success(t("cd_saved" as any));
    } finally { setSaving(false); }
  }

  if (!isSuper) {
    return (
      <>
        <PageHeader title={t("cd_title" as any)} />
        <Alert variant="destructive"><AlertDescription>{t("cd_restricted" as any)}</AlertDescription></Alert>
      </>
    );
  }
  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const previewData: CardData = {
    ...SAMPLE,
    company_name: s.header_text || brand.company_name || SAMPLE.company_name,
    company_name_bn: s.header_text_bn || brand.company_name_bn || SAMPLE.company_name_bn,
    logo_url: brand.logo_url,
  };

  return (
    <>
      <PageHeader title={t("cd_title" as any)} description={t("cd_desc" as any)}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setS(DEFAULT_CARD_SETTINGS)}><RotateCcw className="h-4 w-4" />{t("cd_reset" as any)}</Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{t("cd_save" as any)}
            </Button>
          </div>
        } />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4 space-y-4">
          <h3 className="font-semibold">{t("cd_layout" as any)}</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>{t("cd_template" as any)}</Label>
              <Select value={s.template_id} onValueChange={(v) => setS({ ...s, template_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TEMPLATE_LIST.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("cd_accentColor" as any)}</Label>
              <div className="flex gap-2 items-center">
                <Input type="color" value={s.accent_color} onChange={(e) => setS({ ...s, accent_color: e.target.value })} className="h-10 w-16 p-1" />
                <Input value={s.accent_color} onChange={(e) => setS({ ...s, accent_color: e.target.value })} className="font-mono" />
              </div>
            </div>
            <div>
              <Label>{t("cd_photoSize" as any)}</Label>
              <Input type="number" min={10} max={40} step={1} value={s.photo_size_mm}
                onChange={(e) => setS({ ...s, photo_size_mm: Number(e.target.value) || 18 })} />
            </div>
            <div>
              <Label>{t("cd_fontScale" as any)}</Label>
              <Input type="number" min={0.7} max={1.6} step={0.05} value={s.font_scale}
                onChange={(e) => setS({ ...s, font_scale: Number(e.target.value) || 1 })} />
            </div>
            <div>
              <Label>{t("cd_headerHeight" as any)}</Label>
              <Input type="number" min={5} max={20} step={0.5} value={s.header_height_mm}
                onChange={(e) => setS({ ...s, header_height_mm: Number(e.target.value) || 8 })} />
            </div>
            <div>
              <Label>{t("cd_logoSize" as any)}</Label>
              <Input type="number" min={3} max={20} step={0.5} value={s.logo_size_mm}
                onChange={(e) => setS({ ...s, logo_size_mm: Number(e.target.value) || 6 })} />
            </div>
            <div className="md:col-span-2">
              <Label>{t("cd_headerEn" as any)}</Label>
              <Input value={s.header_text} maxLength={120} onChange={(e) => setS({ ...s, header_text: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label>{t("cd_headerBn" as any)}</Label>
              <Input value={s.header_text_bn} maxLength={120} onChange={(e) => setS({ ...s, header_text_bn: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label>{t("cd_customEn" as any)}</Label>
              <Input value={s.custom_text} maxLength={120} placeholder={t("cd_customPlaceholder" as any)}
                onChange={(e) => setS({ ...s, custom_text: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label>{t("cd_customBn" as any)}</Label>
              <Input value={s.custom_text_bn} maxLength={120}
                onChange={(e) => setS({ ...s, custom_text_bn: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-2 pt-2 border-t">
            <h4 className="text-sm font-semibold">{t("cd_visibleFields" as any)}</h4>
            <Row label={t("cd_photo" as any)} v={s.show_photo} on={(v) => setS({ ...s, show_photo: v })} />
            <Row label={t("cd_accountNumber" as any)} v={s.show_account_number} on={(v) => setS({ ...s, show_account_number: v })} />
            <Row label={t("cd_voterNumber" as any)} v={s.show_voter_number} on={(v) => setS({ ...s, show_voter_number: v })} />
            <Row label={t("cd_issueDate" as any)} v={s.show_issue_date} on={(v) => setS({ ...s, show_issue_date: v })} />
            <Row label={t("cd_qr" as any)} v={s.show_qr} on={(v) => setS({ ...s, show_qr: v })} />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">{t("cd_livePreview" as any)}</h3>
            <span className="text-xs text-muted-foreground">{t("cd_sampleData" as any)}</span>
          </div>
          <div className="overflow-auto">
            <MembershipCard data={previewData} templateId={s.template_id as TemplateId} display={s} />
          </div>
        </Card>
      </div>
    </>
  );
}

function Row({ label, v, on }: { label: string; v: boolean; on: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span>{label}</span>
      <Switch checked={v} onCheckedChange={on} />
    </div>
  );
}
