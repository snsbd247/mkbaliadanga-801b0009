import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, FileDown, Printer, RotateCcw } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { previewBnReceiptPdf, downloadBnReceiptPdf, type BnReceiptData } from "@/lib/bnReceipts";
import {
  getReceiptLayoutSettings,
  setReceiptLayoutSettings,
  resetReceiptLayoutSettings,
  type PaperSize,
  type PaperOrientation,
} from "@/lib/receiptLayoutSettings";
import { scheduleReceiptLayoutPersist } from "@/lib/receiptLayoutSync";

type SampleKind = "irrigation" | "savings" | "loan";

function sampleReceipt(kind: SampleKind): BnReceiptData {
  const farmer = {
    name: "মোঃ মাসুদ রানা",
    member_no: "1920",
    father_or_husband: "মোঃ তোহিদুল ইসলাম",
    village: "ঘোনটোলা",
    mobile: "01715699767",
    mouza: "রন্দ",
    land_size: 33,
    dag_no: "1, 25, 26, 28",
    field_type_bn: "উচু জমি",
  };
  if (kind === "savings") {
    return {
      kind: "savings",
      receipt_no: "SAV-0001",
      date: "2026-06-20",
      farmer,
      description: "মাসিক সঞ্চয় জমা",
      collected_amount: 500,
      savings_balance_after: 12500,
      collector_signature_url: null,
    } as BnReceiptData;
  }
  if (kind === "loan") {
    return {
      kind: "loan",
      receipt_no: "LOAN-0001",
      date: "2026-06-20",
      farmer,
      description: "ঋণ কিস্তি পরিশোধ",
      outstanding: 8000,
      collected_amount: 2000,
      collector_signature_url: null,
    } as BnReceiptData;
  }
  return {
    kind: "irrigation",
    receipt_no: "R-SAMPLE",
    date: "2026-06-20",
    farmer,
    rate: 3939.39,
    current_season_charge: 1300,
    current_penalty: 130,
    total_outstanding: 1300,
    due_penalty: 130,
    collected_amount: 2860,
    collector_signature_url: null,
    village_union: "বালিয়াডাঙ্গা",
  } as BnReceiptData;
}

export default function ReceiptPrintPreview() {
  const { tx } = useLang();
  const [kind, setKind] = useState<SampleKind>("irrigation");
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState(() => getReceiptLayoutSettings());
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const data = useMemo(() => sampleReceipt(kind), [kind]);

  useEffect(() => {
    document.title = `${tx("Receipt print preview", "রসিদ প্রিন্ট প্রিভিউ")} — MK Baliadanga`;
  }, [tx]);

  // Re-render the PDF preview whenever the sample type or any setting changes.
  useEffect(() => {
    let active = true;
    setLoading(true);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      previewBnReceiptPdf(data)
        .then((u) => { if (active) setUrl(u); })
        .finally(() => { if (active) setLoading(false); });
    }, 180);
    return () => { active = false; };
  }, [data, settings]);

  const save = (next: Parameters<typeof setReceiptLayoutSettings>[0]) => {
    const merged = setReceiptLayoutSettings(next);
    scheduleReceiptLayoutPersist();
    setSettings(merged);
  };

  const onReset = () => {
    const s = resetReceiptLayoutSettings();
    scheduleReceiptLayoutPersist();
    setSettings(s);
  };

  return (
    <>
      <PageHeader
        title={tx("Receipt print preview", "রসিদ প্রিন্ট প্রিভিউ")}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onReset}>
              <RotateCcw className="h-4 w-4 mr-1" />{tx("Reset", "রিসেট")}
            </Button>
            <Button variant="outline" size="sm" disabled={!url} onClick={() => {
              const frame = document.querySelector<HTMLIFrameElement>('iframe[title="print-preview"]');
              frame?.contentWindow?.focus();
              frame?.contentWindow?.print();
            }}>
              <Printer className="h-4 w-4 mr-1" />{tx("Print", "প্রিন্ট")}
            </Button>
            <Button size="sm" onClick={() => downloadBnReceiptPdf(data)}>
              <FileDown className="h-4 w-4 mr-1" />{tx("Download PDF", "PDF ডাউনলোড")}
            </Button>
          </div>
        }
      />
      <div className="grid gap-4 p-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader><CardTitle>{tx("Live preview", "লাইভ প্রিভিউ")}</CardTitle></CardHeader>
          <CardContent>
            <div className="mx-auto w-full max-w-md overflow-hidden rounded-md border bg-muted" style={{ aspectRatio: "210 / 297" }}>
              {loading || !url
                ? <div className="flex h-full items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" />{tx("Rendering…", "তৈরি হচ্ছে…")}</div>
                : <iframe title="print-preview" src={url} className="h-full w-full" />}
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader><CardTitle>{tx("Adjust layout", "লেআউট ঠিক করুন")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>{tx("Receipt type", "রসিদের ধরন")}</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as SampleKind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="irrigation">{tx("Irrigation", "সেচ")}</SelectItem>
                  <SelectItem value="savings">{tx("Savings", "সঞ্চয়")}</SelectItem>
                  <SelectItem value="loan">{tx("Loan", "ঋণ")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>{tx("Paper", "কাগজ")}</Label>
                <Select value={settings.defaultPaperSize} onValueChange={(v) => save({ defaultPaperSize: v as PaperSize })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a5">A5</SelectItem>
                    <SelectItem value="a4">A4</SelectItem>
                    <SelectItem value="letter">Letter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{tx("Orientation", "orientation")}</Label>
                <Select value={settings.defaultOrientation} onValueChange={(v) => save({ defaultOrientation: v as PaperOrientation })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="p">{tx("Portrait", "পোর্ট্রেট")}</SelectItem>
                    <SelectItem value="l">{tx("Landscape", "ল্যান্ডস্কেপ")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{tx("Font scale", "ফন্ট স্কেল")}: {settings.fontScale.toFixed(2)}×</Label>
              <Slider
                min={0.8} max={1.4} step={0.05}
                value={[settings.fontScale]}
                onValueChange={([v]) => save({ fontScale: v })}
              />
            </div>

            <div className="space-y-2">
              <Label>{tx("Side margin (mm)", "সাইড মার্জিন (mm)")}: {settings.sideMarginMm}</Label>
              <Slider
                min={0} max={15} step={1}
                value={[settings.sideMarginMm]}
                onValueChange={([v]) => save({ sideMarginMm: v })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>{tx("Fit to page", "ফিট-টু-পেজ")}</Label>
              <Switch checked={settings.fitToPage} onCheckedChange={(c) => save({ fitToPage: c })} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>{tx("Page pad", "পেজ প্যাড")}</Label>
                <Input type="number" min={8} max={72} value={settings.irrigationPagePaddingPx}
                  onChange={(e) => save({ irrigationPagePaddingPx: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label>{tx("Bottom pad", "নিচের প্যাড")}</Label>
                <Input type="number" min={6} max={96} value={settings.irrigationBottomPaddingPx}
                  onChange={(e) => save({ irrigationBottomPaddingPx: Number(e.target.value) })} />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {tx(
                "Settings apply to every receipt type and are saved to your profile.",
                "সেটিংস সব ধরনের রসিদে প্রযোজ্য হবে এবং আপনার প্রোফাইলে সংরক্ষিত থাকবে।",
              )}
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
