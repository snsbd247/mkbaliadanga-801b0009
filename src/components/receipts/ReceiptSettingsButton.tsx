import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings2, RotateCcw } from "lucide-react";
import { setReceiptOptions, useReceiptOptions, resetReceiptOptionsToDemo } from "@/lib/receiptOptions";
import { getReceiptLayoutSettings, setReceiptLayoutSettings, type PaperSize } from "@/lib/receiptLayoutSettings";
import { useLang } from "@/i18n/LanguageProvider";

export function ReceiptSettingsButton() {
  const opts = useReceiptOptions();
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [pdfPaper, setPdfPaper] = useState<PaperSize>(() => getReceiptLayoutSettings().defaultPaperSize);
  const [wmEnabled, setWmEnabled] = useState<boolean>(() => getReceiptLayoutSettings().watermarkEnabled);
  const [wmText, setWmText] = useState<string>(() => getReceiptLayoutSettings().watermarkText);
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
              const next = (v === "a4" ? "a4" : "a5") as PaperSize;
              setPdfPaper(next);
              setReceiptLayoutSettings({ defaultPaperSize: next });
            }}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="a5">A5 (compact)</SelectItem>
              <SelectItem value="a4">A4 (full page)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            সব receipt PDF এই paper size-এ generate হবে।
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
                setReceiptLayoutSettings({ watermarkEnabled: e.target.checked });
              }}
            />
            <span className="font-semibold">Watermark (receipt background)</span>
          </label>
          <Input
            placeholder="e.g. MK BALIADANGA — empty = use company name"
            value={wmText}
            onChange={(e) => {
              setWmText(e.target.value);
              setReceiptLayoutSettings({ watermarkText: e.target.value });
            }}
            disabled={!wmEnabled}
          />
          <p className="text-[11px] text-muted-foreground">
            Watermark on/off — on করলে receipt-এর পিছনে diagonal text বসবে।
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
