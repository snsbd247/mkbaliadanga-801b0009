import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Printer, Eye } from "lucide-react";
import { PrintButton } from "@/components/ui/action-icon-button";
import type { ReceiptCopy } from "@/lib/bnReceipts";
import { useLang } from "@/i18n/LanguageProvider";

interface Props {
  onSelect: (copy: ReceiptCopy) => void;
  onPreview?: () => void;
  size?: "sm" | "icon";
  label?: string;
  title?: string;
  /** সেচ রশিদ: একটিমাত্র কপি — both/farmer/office মেনু না দেখিয়ে সরাসরি প্রিন্ট। */
  singleCopy?: boolean;
}

export function ReceiptCopyMenu({ onSelect, onPreview, size = "icon", label, title, singleCopy }: Props) {
  const { tx } = useLang();

  // সিঙ্গেল কপি মোড: কোনো ড্রপডাউন নয় — সরাসরি প্রিন্ট, প্রিভিউ থাকলে আলাদা মেনু।
  if (singleCopy && !onPreview) {
    return size === "icon" ? (
      <PrintButton title={title ?? tx("Print receipt", "রসিদ প্রিন্ট")} onClick={() => onSelect("farmer")} />
    ) : (
      <Button size="sm" variant="outline" onClick={() => onSelect("farmer")}>
        <Printer className="h-4 w-4 mr-1" />{label ?? tx("Print", "প্রিন্ট")}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {size === "icon" ? (
          <PrintButton title={title ?? tx("Print receipt", "রসিদ প্রিন্ট")} />
        ) : (
          <Button size="sm" variant="outline">
            <Printer className="h-4 w-4 mr-1" />{label ?? tx("Print", "প্রিন্ট")}
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onPreview && (
          <>
            <DropdownMenuItem onClick={onPreview}><Eye className="h-4 w-4 mr-2" />{tx("Preview", "প্রিভিউ")}</DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {singleCopy ? (
          <DropdownMenuItem onClick={() => onSelect("farmer")}><Printer className="h-4 w-4 mr-2" />{tx("Print", "প্রিন্ট")}</DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuItem onClick={() => onSelect("both")}>{tx("Both copies", "উভয় কপি")}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSelect("farmer")}>{tx("Farmer copy", "কৃষক কপি")}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSelect("office")}>{tx("Office copy", "অফিস কপি")}</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
