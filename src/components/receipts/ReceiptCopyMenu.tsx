import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Printer } from "lucide-react";
import { PrintButton } from "@/components/ui/action-icon-button";
import type { ReceiptCopy } from "@/lib/bnReceipts";
import { useLang } from "@/i18n/LanguageProvider";

interface Props {
  onSelect: (copy: ReceiptCopy) => void;
  size?: "sm" | "icon";
  label?: string;
  title?: string;
}

export function ReceiptCopyMenu({ onSelect, size = "icon", label, title }: Props) {
  const { tx } = useLang();
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
        <DropdownMenuItem onClick={() => onSelect("both")}>{tx("Both copies", "উভয় কপি")}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSelect("farmer")}>{tx("Farmer copy", "কৃষক কপি")}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSelect("office")}>{tx("Office copy", "অফিস কপি")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
