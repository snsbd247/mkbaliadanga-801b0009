import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { invoiceStatusBadge } from "@/lib/dues";
import { useLang } from "@/i18n/LanguageProvider";

/**
 * Accessible status badge for an irrigation invoice.
 *
 * When the invoice_status is NULL/empty we render a "Pending / অনির্ধারিত"
 * badge with an aria-label and a tooltip explaining the invoice is still
 * counted — so users can tell no invoice is silently dropped from lists.
 *
 * By default only unset statuses are shown (to avoid clutter). Pass
 * `showAll` to render a badge for every status.
 */
export function InvoiceStatusBadge({
  status,
  showAll = false,
  className = "",
}: {
  status: string | null | undefined;
  showAll?: boolean;
  className?: string;
}) {
  const { lang } = useLang();
  const isUnset = !status;
  if (!isUnset && !showAll) return null;

  const b = invoiceStatusBadge(status);
  const label = lang === "bn" ? b.label_bn : b.label_en;
  const tip = isUnset
    ? lang === "bn"
      ? "এই ইনভয়েসের স্ট্যাটাস নির্ধারিত হয়নি, তবে বকেয়া হিসাবে গণনা করা হচ্ছে — কোনো ইনভয়েস বাদ পড়ছে না।"
      : "This invoice has no status set but is still counted as due — no invoice is dropped."
    : label;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant={b.variant}
          aria-label={tip}
          className={`text-[9px] px-1 py-0 ${isUnset ? "border-amber-400 text-amber-600" : ""} ${className}`}
        >
          {label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  );
}
