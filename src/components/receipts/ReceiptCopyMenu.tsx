import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Printer } from "lucide-react";
import { PrintButton } from "@/components/ui/action-icon-button";
import type { ReceiptCopy } from "@/lib/bnReceipts";

interface Props {
  onSelect: (copy: ReceiptCopy) => void;
  size?: "sm" | "icon";
  label?: string;
  title?: string;
}

export function ReceiptCopyMenu({ onSelect, size = "icon", label, title }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {size === "icon" ? (
          <PrintButton title={title ?? "Print receipt"} />
        ) : (
          <Button size="sm" variant="outline">
            <Printer className="h-4 w-4 mr-1" />{label ?? "Print"}
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onSelect("both")}>Both copies</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSelect("farmer")}>Farmer copy</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSelect("office")}>Office copy</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
