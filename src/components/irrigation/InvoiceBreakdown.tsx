import { buildInvoiceBreakdown, type BreakdownInvoice } from "@/lib/invoiceBreakdown";
import { money } from "@/lib/format";
import { useLang } from "@/i18n/LanguageProvider";
import { cn } from "@/lib/utils";

/**
 * Reusable due/payable breakdown table shown on the invoice screen and receipts.
 * Renders each component of the payable (irrigation, delay, other, discount) and
 * the excluded/informational lines (maintenance, canal, previous due) so users
 * can see exactly how the total & due are composed.
 */
export function InvoiceBreakdown({
  invoice,
  className,
  compact,
}: {
  invoice: BreakdownInvoice;
  className?: string;
  compact?: boolean;
}) {
  const { lang } = useLang();
  const bn = lang === "bn";
  const b = buildInvoiceBreakdown(invoice);
  const L = (en: string, bnv: string) => (bn ? bnv : en);

  return (
    <div className={cn("rounded-md border text-sm", className)}>
      <div className="px-3 py-2 border-b bg-muted/40 font-medium">
        {L("Due breakdown", "বকেয়ার বিবরণ")}
      </div>
      <div className="divide-y">
        {b.lines.map((line) => (
          <div
            key={line.key}
            className={cn(
              "flex items-center justify-between px-3 py-1.5",
              line.excluded && "text-muted-foreground",
            )}
          >
            <span className={cn(compact && "text-xs")}>
              {bn ? line.label_bn : line.label_en}
              {line.sign === -1 && <span className="ml-1 text-emerald-600">(−)</span>}
            </span>
            <span className={cn("font-mono tabular-nums", compact && "text-xs")}>
              {line.sign === -1 ? "− " : ""}
              {money(line.amount)}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between px-3 py-2 border-t bg-muted/30 font-semibold">
        <span>{L("Total payable", "মোট পরিশোধযোগ্য")}</span>
        <span className="font-mono tabular-nums">{money(b.payable)}</span>
      </div>
      {b.paid > 0 && (
        <div className="flex items-center justify-between px-3 py-1.5 border-t text-emerald-700">
          <span>{L("Paid", "পরিশোধিত")}</span>
          <span className="font-mono tabular-nums">− {money(b.paid)}</span>
        </div>
      )}
      <div className="flex items-center justify-between px-3 py-2 border-t bg-destructive/5 font-semibold text-destructive">
        <span>{L("Due", "বকেয়া")}</span>
        <span className="font-mono tabular-nums">{money(b.due)}</span>
      </div>
      {b.excludedTotal > 0 && (
        <div className="px-3 py-1.5 border-t text-xs text-muted-foreground">
          {L(
            "Maintenance/canal are internal splits and are not added to the payable.",
            "রক্ষণাবেক্ষণ/ক্যানেল অভ্যন্তরীণ ভাগ — মূল টাকার সাথে যোগ হয় না।",
          )}
        </div>
      )}
    </div>
  );
}

export default InvoiceBreakdown;
