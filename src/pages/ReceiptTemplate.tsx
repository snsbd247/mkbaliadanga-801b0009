// i18n-ignore-file — admin-only page (English UI)
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Save, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  DEFAULT_TEMPLATE,
  previewPaymentReceiptPdf,
  type ReceiptTemplate,
  type PaymentReceiptData,
} from "@/lib/paymentReceiptPdf";
import { useBranding } from "@/lib/branding";
import { notifyReceiptTemplateChange } from "@/lib/receiptTemplate";

const SAMPLE: PaymentReceiptData = {
  receipt_no: "ABCD1234",
  payment_id: "00000000-0000-0000-0000-000000000000",
  paid_at: new Date().toISOString(),
  farmer_name: "Md. Rahim Uddin",
  farmer_code: "2026-00000123",
  member_no: "M-00045",
  mobile_masked: "01•••••3456",
  village: "Baliadanga",
  token_masked: "mkc_a1•••f3c7",
  token_status: "active",
  kind: "loan",
  amount: 4500,
  method: "cash",
  note: "Sample payment for receipt preview",
  collected_by_name: "Office Staff",
  office_name: "Baliadanga Branch",
  idempotency_key: "preview-sample-key-1234567890abcdef",
  company_name: "Smart Irrigation Cooperative",
  company_name_bn: "স্মার্ট সেচ ও সমবায়",
};

export default function ReceiptTemplatePage() {
  const { isSuper } = useAuth();
  const brand = useBranding();
  const [tpl, setTpl] = useState<ReceiptTemplate>(DEFAULT_TEMPLATE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = "Receipt Template";
    (async () => {
      const { data } = await supabase.from("receipt_settings").select("*").eq("id", 1).maybeSingle();
      if (data) setTpl({ ...DEFAULT_TEMPLATE, ...(data as any) });
      setLoading(false);
    })();
  }, []);

  const sample = useMemo<PaymentReceiptData>(
    () => ({
      ...SAMPLE,
      company_name: brand.company_name ?? SAMPLE.company_name,
      company_name_bn: brand.company_name_bn ?? SAMPLE.company_name_bn,
      office_name: brand.address ? brand.address.split(",")[0] : SAMPLE.office_name,
    }),
    [brand],
  );

  const previewUrl = useMemo(
    () => previewPaymentReceiptPdf(sample, { ...tpl, logo_url: brand.logo_url ?? null }),
    [sample, tpl, brand.logo_url],
  );

  async function save() {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("receipt_settings")
        .update({
          language: tpl.language,
          paper_size: tpl.paper_size,
          accent_color: tpl.accent_color,
          show_logo: tpl.show_logo,
          show_signature_line: tpl.show_signature_line,
          show_office: tpl.show_office,
          show_token_block: tpl.show_token_block,
          header_alignment: tpl.header_alignment,
          footer_note: tpl.footer_note,
          footer_note_bn: tpl.footer_note_bn,
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);
      if (error) { toast.error(error.message); return; }
      notifyReceiptTemplateChange();
      toast.success("Receipt template saved");
    } finally { setSaving(false); }
  }

  function reset() {
    setTpl(DEFAULT_TEMPLATE);
  }

  if (!isSuper) {
    return (
      <>
        <PageHeader title="Receipt Template" />
        <Alert variant="destructive"><AlertDescription>This page is restricted to super administrators.</AlertDescription></Alert>
      </>
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <>
      <PageHeader
        title="Receipt Template"
        description="Customize the scan-payment PDF receipt and preview before saving."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={reset}><RotateCcw className="h-4 w-4" />Reset</Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4 space-y-4">
          <h3 className="font-semibold">Layout</h3>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Language</Label>
              <Select value={tpl.language} onValueChange={(v) => setTpl({ ...tpl, language: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="bn">Bangla</SelectItem>
                  <SelectItem value="both">Both (EN + BN)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Bangla labels render with the limited PDF font; for full glyphs, also keep English.</p>
            </div>
            <div>
              <Label>Paper size</Label>
              <Select value={tpl.paper_size} onValueChange={(v) => setTpl({ ...tpl, paper_size: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="a4">A4</SelectItem>
                  <SelectItem value="a5">A5 (default)</SelectItem>
                  <SelectItem value="a6">A6 (compact)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Header alignment</Label>
              <Select value={tpl.header_alignment} onValueChange={(v) => setTpl({ ...tpl, header_alignment: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Accent color</Label>
              <div className="flex gap-2 items-center">
                <Input type="color" value={tpl.accent_color} onChange={(e) => setTpl({ ...tpl, accent_color: e.target.value })} className="h-10 w-16 p-1" />
                <Input value={tpl.accent_color} onChange={(e) => setTpl({ ...tpl, accent_color: e.target.value })} className="font-mono" />
              </div>
            </div>
          </div>

          <div className="grid gap-2 pt-2 border-t">
            <h4 className="text-sm font-semibold">Sections</h4>
            <ToggleRow label="Show logo (uses Company logo from Settings)" value={tpl.show_logo} onChange={(v) => setTpl({ ...tpl, show_logo: v })} />
            <ToggleRow label="Show office line" value={tpl.show_office} onChange={(v) => setTpl({ ...tpl, show_office: v })} />
            <ToggleRow label="Show QR token block" value={tpl.show_token_block} onChange={(v) => setTpl({ ...tpl, show_token_block: v })} />
            <ToggleRow label="Show signature line" value={tpl.show_signature_line} onChange={(v) => setTpl({ ...tpl, show_signature_line: v })} />
          </div>

          <div className="pt-2 border-t space-y-2">
            <h4 className="text-sm font-semibold">Footer note</h4>
            <div>
              <Label className="text-xs">English</Label>
              <Textarea rows={2} value={tpl.footer_note} onChange={(e) => setTpl({ ...tpl, footer_note: e.target.value })} maxLength={300} />
            </div>
            <div>
              <Label className="text-xs">Bangla</Label>
              <Textarea rows={2} value={tpl.footer_note_bn} onChange={(e) => setTpl({ ...tpl, footer_note_bn: e.target.value })} maxLength={300} />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Live preview</h3>
            <span className="text-xs text-muted-foreground">Sample data — updates instantly</span>
          </div>
          <iframe
            key={previewUrl.length}
            src={previewUrl}
            title="Receipt preview"
            className="w-full h-[70vh] border rounded-md bg-white"
          />
        </Card>
      </div>
    </>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span>{label}</span>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}
