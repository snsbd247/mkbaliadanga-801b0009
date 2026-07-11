import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings2, RotateCcw } from "lucide-react";
import { setReceiptOptions, useReceiptOptions, resetReceiptOptionsToDemo } from "@/lib/receiptOptions";
import { getReceiptLayoutSettings, setReceiptLayoutSettings, resetReceiptLayoutSettings, applyReceiptPreset, detectActiveReceiptPreset, RECEIPT_PAPER_PRESETS, type PaperSize, type PaperOrientation } from "@/lib/receiptLayoutSettings";
import { scheduleReceiptLayoutPersist } from "@/lib/receiptLayoutSync";
import { useLang } from "@/i18n/LanguageProvider";

export function ReceiptSettingsButton() {
  const opts = useReceiptOptions();
  const { t, lang } = useLang();
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<string>(() => detectActiveReceiptPreset());
  const [pdfPaper, setPdfPaper] = useState<PaperSize>(() => getReceiptLayoutSettings().defaultPaperSize);
  const [pdfOrientation, setPdfOrientation] = useState<PaperOrientation>(() => getReceiptLayoutSettings().defaultOrientation);
  const [wmEnabled, setWmEnabled] = useState<boolean>(() => getReceiptLayoutSettings().watermarkEnabled);
  const [wmText, setWmText] = useState<string>(() => getReceiptLayoutSettings().watermarkText);
  const [pagePad, setPagePad] = useState<number>(() => getReceiptLayoutSettings().irrigationPagePaddingPx);
  const [bottomPad, setBottomPad] = useState<number>(() => getReceiptLayoutSettings().irrigationBottomPaddingPx);
  const [holdingPad, setHoldingPad] = useState<number>(() => getReceiptLayoutSettings().holdingBottomPaddingPx);
  const [fitToPage, setFitToPage] = useState<boolean>(() => getReceiptLayoutSettings().fitToPage);
  const [fontScale, setFontScale] = useState<number>(() => getReceiptLayoutSettings().fontScale);
  const [sideMargin, setSideMargin] = useState<number>(() => getReceiptLayoutSettings().sideMarginMm);
  // Persist to profile + keep local edits in sync whenever layout changes.
  const saveLayout = (next: Parameters<typeof setReceiptLayoutSettings>[0]) => {
    setReceiptLayoutSettings(next);
    scheduleReceiptLayoutPersist();
    setPreset(detectActiveReceiptPreset());
  };
  const syncLocalFrom = (s: ReturnType<typeof getReceiptLayoutSettings>) => {
    setPdfPaper(s.defaultPaperSize);
    setPdfOrientation(s.defaultOrientation);
    setWmEnabled(s.watermarkEnabled);
    setWmText(s.watermarkText);
    setPagePad(s.irrigationPagePaddingPx);
    setBottomPad(s.irrigationBottomPaddingPx);
    setHoldingPad(s.holdingBottomPaddingPx);
    setFitToPage(s.fitToPage);
  };
  const onSelectPreset = (id: string) => {
    const s = applyReceiptPreset(id);
    scheduleReceiptLayoutPersist();
    setPreset(id);
    syncLocalFrom(s);
  };
  const onResetDefaults = () => {
    const s = resetReceiptLayoutSettings();
    scheduleReceiptLayoutPersist();
    setPreset(detectActiveReceiptPreset(s));
    syncLocalFrom(s);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm"><Settings2 className="h-4 w-4 mr-1" />{t("p5b_receiptSettings")}</Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3" align="end">
        <div className="flex items-center justify-between">
          <div className="font-semibold text-sm">{t("p5b_receiptLayout")}</div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={resetReceiptOptionsToDemo}
            title="Reset margin / paper / orientation / language / company block to demo defaults"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />Demo defaults
          </Button>
        </div>
        <div className="space-y-1 rounded-md border bg-muted/40 p-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold">{lang === "bn" ? "প্রিন্টার প্রিসেট (এক ক্লিকে)" : "Printer preset (one click)"}</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px]"
              onClick={onResetDefaults}
              title={lang === "bn" ? "প্রিসেট ও প্যাডিং ডিফল্টে ফিরিয়ে আনুন" : "Reset presets & padding to defaults"}
            >
              <RotateCcw className="h-3 w-3 mr-1" />{lang === "bn" ? "রিসেট" : "Reset"}
            </Button>
          </div>
          <Select value={preset} onValueChange={onSelectPreset}>
            <SelectTrigger><SelectValue placeholder={lang === "bn" ? "প্রিসেট নির্বাচন" : "Choose a preset"} /></SelectTrigger>
            <SelectContent>
              {RECEIPT_PAPER_PRESETS.map((p) => (
                <SelectItem key={p.id} value={p.id}>{lang === "bn" ? p.labelBn : p.labelEn}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            {lang === "bn"
              ? "কাগজের সাইজ, orientation ও প্যাডিং একসাথে সেট হবে। সেটিং আপনার প্রোফাইলে সংরক্ষিত থাকে।"
              : "Sets paper size, orientation and padding together. Saved to your profile."}
          </p>
          <label className="flex items-center gap-2 text-xs cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={fitToPage}
              onChange={(e) => { setFitToPage(e.target.checked); saveLayout({ fitToPage: e.target.checked }); }}
            />
            <span className="font-semibold">{lang === "bn" ? "ফিট-টু-পেজ স্কেলিং" : "Fit-to-page scaling"}</span>
          </label>
          <p className="text-[11px] text-muted-foreground">
            {lang === "bn"
              ? "অন থাকলে রশিদ এক পৃষ্ঠায় ফিট করে স্কেল হয় — প্রিভিউ ও PDF সব প্রিন্টারে এক রকম থাকে।"
              : "When on, the receipt scales to fit one page so preview and PDF match across printer drivers."}
          </p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("p5b_receiptLanguage")}</Label>
          <Select value={opts.lang} onValueChange={(v) => setReceiptOptions({ lang: v as any })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="bn">বাংলা (Bangla)</SelectItem>{/* i18n-ignore */}
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">{t("p5b_receiptNumberSame")}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Paper</Label>
            <Select value={opts.paper} onValueChange={(v) => setReceiptOptions({ paper: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="a4">A4</SelectItem>
                <SelectItem value="letter">Letter</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{t("p5b_orientation")}</Label>
            <Select value={opts.orientation} onValueChange={(v) => setReceiptOptions({ orientation: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="p">{t("p5b_portrait")}</SelectItem>
                <SelectItem value="l">{t("p5b_landscape")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label className="text-xs">Page margin (mm): {opts.marginsMm}</Label>
          <Input
            type="number"
            min={0}
            max={30}
            value={opts.marginsMm}
            onChange={(e) => setReceiptOptions({ marginsMm: Math.max(0, Math.min(30, Number(e.target.value) || 0)) })}
          />
        </div>

        <div className="border-t pt-2 space-y-2">
          <div className="text-xs font-semibold">Company block (header)</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Layout</Label>
              <Select value={opts.orgLayout} onValueChange={(v) => setReceiptOptions({ orgLayout: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="two-line">Two lines (stacked)</SelectItem>
                  <SelectItem value="one-line">One line (compact)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{t("p5b_fontSize")}</Label>
              <Select value={opts.orgSize} onValueChange={(v) => setReceiptOptions({ orgSize: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sm">Small</SelectItem>
                  <SelectItem value="md">Medium</SelectItem>
                  <SelectItem value="lg">Large</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Same layout is used on both Farmer and Office copies for consistency.
          </p>
        </div>

        <div className="border-t pt-2 space-y-1">
          <Label className="text-xs">Receipt PDF paper (Payment / Loan / Irrigation / Combined)</Label>
          <Select
            value={pdfPaper}
            onValueChange={(v) => {
              const next = (["a4", "a5", "letter"].includes(v) ? v : "a5") as PaperSize;
              setPdfPaper(next);
              saveLayout({ defaultPaperSize: next });
            }}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="a5">A5 (compact)</SelectItem>
              <SelectItem value="a4">A4 (full page)</SelectItem>
              <SelectItem value="letter">Letter</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            সব receipt PDF এই paper size-এ generate হবে।
          </p>
        </div>

        <div className="border-t pt-2 space-y-2">
          <div>
            <Label className="text-xs">{lang === "bn" ? "ফন্ট স্কেল" : "Font scale"}: {fontScale.toFixed(2)}×</Label>
            <Input
              type="number" min={0.8} max={1.4} step={0.05}
              value={fontScale}
              onChange={(e) => { const n = Number(e.target.value); setFontScale(n); saveLayout({ fontScale: n }); }}
            />
          </div>
          <div>
            <Label className="text-xs">{lang === "bn" ? "সাইড মার্জিন (mm)" : "Side margin (mm)"}: {sideMargin}</Label>
            <Input
              type="number" min={0} max={15}
              value={sideMargin}
              onChange={(e) => { const n = Number(e.target.value); setSideMargin(n); saveLayout({ sideMarginMm: n }); }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {lang === "bn" ? "ফন্ট বড়/ছোট ও দুই পাশের গ্যাপ ঠিক করুন।" : "Adjust text size and left/right gaps."}
          </p>
        </div>

        <div className="border-t pt-2 space-y-1">
          <Label className="text-xs">Page orientation (Portrait / Landscape)</Label>
          <Select
            value={pdfOrientation}
            onValueChange={(v) => {
              const next = (v === "l" ? "l" : "p") as PaperOrientation;
              setPdfOrientation(next);
              saveLayout({ defaultOrientation: next });
            }}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="p">Portrait (লম্বালম্বি)</SelectItem>
              <SelectItem value="l">Landscape (আড়াআড়ি)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            A4/A5 সহ সব receipt PDF (অফিস আয় সহ) এই orientation-এ render হবে।
          </p>
        </div>

        <div className="border-t pt-2 space-y-1">
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={!!opts.showVerifyUrl}
              onChange={(e) => setReceiptOptions({ showVerifyUrl: e.target.checked })}
            />
            <span>Show verify link (with token) under QR</span>
          </label>
          <p className="text-[11px] text-muted-foreground">
            Useful when the QR cannot be scanned — recipients can type the URL.
          </p>
        </div>

        <div className="border-t pt-2 space-y-2">
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={wmEnabled}
              onChange={(e) => {
                setWmEnabled(e.target.checked);
                saveLayout({ watermarkEnabled: e.target.checked });
              }}
            />
            <span className="font-semibold">Watermark (receipt background)</span>
          </label>
          <Input
            placeholder="e.g. MK BALIADANGA — empty = use company name"
            value={wmText}
            onChange={(e) => {
              setWmText(e.target.value);
              saveLayout({ watermarkText: e.target.value });
            }}
            disabled={!wmEnabled}
          />
          <p className="text-[11px] text-muted-foreground">
            Watermark on/off — on করলে receipt-এর পিছনে diagonal text বসবে।
          </p>
        </div>

        <div className="border-t pt-2 space-y-2">
          <div className="font-semibold text-xs">সেচ রশিদ স্পেসিং (প্রিন্টার অ্যাডজাস্ট)</div>{/* i18n-ignore */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-[11px]">Page pad</Label>
              <Input
                type="number" min={24} max={72}
                value={pagePad}
                onChange={(e) => { const n = Number(e.target.value); setPagePad(n); saveLayout({ irrigationPagePaddingPx: n }); }}
              />
            </div>
            <div>
              <Label className="text-[11px]">Bottom pad</Label>
              <Input
                type="number" min={12} max={96}
                value={bottomPad}
                onChange={(e) => { const n = Number(e.target.value); setBottomPad(n); saveLayout({ irrigationBottomPaddingPx: n }); }}
              />
            </div>
            <div>
              <Label className="text-[11px]">Holding pad</Label>
              <Input
                type="number" min={0} max={48}
                value={holdingPad}
                onChange={(e) => { const n = Number(e.target.value); setHoldingPad(n); saveLayout({ holdingBottomPaddingPx: n }); }}
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            হোল্ডিং/পাটুয়ারী লাইন ও রশিদের নিচের গ্যাপ প্রিন্টার অনুযায়ী ঠিক করুন।{/* i18n-ignore */}
          </p>
        </div>
      </PopoverContent>

    </Popover>
  );
}
