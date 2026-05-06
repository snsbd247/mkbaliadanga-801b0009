import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings2 } from "lucide-react";
import { setReceiptOptions, useReceiptOptions } from "@/lib/receiptOptions";

export function ReceiptSettingsButton() {
  const opts = useReceiptOptions();
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm"><Settings2 className="h-4 w-4 mr-1" />Receipt settings</Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="end">
        <div className="font-semibold text-sm">Receipt layout</div>
        <div className="space-y-1">
          <Label className="text-xs">Language</Label>
          <Select value={opts.lang} onValueChange={(v) => setReceiptOptions({ lang: v as any })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="bn">বাংলা (Bangla)</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">Receipt number format stays the same in both languages.</p>
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
            <Label className="text-xs">Orientation</Label>
            <Select value={opts.orientation} onValueChange={(v) => setReceiptOptions({ orientation: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="p">Portrait</SelectItem>
                <SelectItem value="l">Landscape</SelectItem>
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
      </PopoverContent>
    </Popover>
  );
}
