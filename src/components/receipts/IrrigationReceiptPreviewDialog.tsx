import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileDown, FileSpreadsheet, Loader2, Printer } from "lucide-react";
import { downloadBnReceiptPdf, previewBnReceiptPdf, irrigationReceiptToExcelRow, type BnReceiptData, type ReceiptCopy } from "@/lib/bnReceipts";
import { exportExcel } from "@/lib/exports";
import { useLang } from "@/i18n/LanguageProvider";
import { isReceiptDataDebugEnabled } from "@/lib/irrigationReceiptData";
import { Badge } from "@/components/ui/badge";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  data: BnReceiptData | null;
  copy?: ReceiptCopy;
  /** Print/paper settings so preview + download match the Payments page exactly. */
  options?: Parameters<typeof previewBnReceiptPdf>[2];
}

/**
 * Print-ready preview for the সেচ (irrigation) receipt. Renders the exact PDF
 * (QR code, মৌজা, watermark) in an iframe so the user can verify it before
 * downloading PDF or Excel — both produced from the same receipt data.
 *
 * Shared across PaidLandHistory, IrrigationPaymentPanel, ScanPayment, Payments,
 * Receipts and FarmerDetail so every entry point shows an identical layout.
 */
export function IrrigationReceiptPreviewDialog({ open, onOpenChange, data, copy = "both", options }: Props) {
  const { tx } = useLang();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    if (open && data) {
      setLoading(true);
      previewBnReceiptPdf(data, copy, options)
        .then((u) => { if (active) setUrl(u); })
        .finally(() => { if (active) setLoading(false); });
    } else {
      setUrl(null);
    }
    return () => { active = false; };
  }, [open, data, copy, options]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>{tx("Irrigation receipt preview (A4, 2 copies)", "সেচ রসিদ প্রিভিউ (A4, ২ কপি)")}</DialogTitle></DialogHeader>
        {isReceiptDataDebugEnabled() && data && (
          <Badge variant="outline" className="w-fit">
            {tx("Patwari source", "পাটুয়ারী সোর্স")}:{" "}
            {data.patwari_source === "land"
              ? tx("land", "জমি")
              : data.patwari_source === "mouza"
                ? tx("mouza", "মৌজা")
                : tx("none", "নেই")}
          </Badge>
        )}
        <div className="mx-auto w-full max-w-md overflow-hidden rounded-md border bg-muted" style={{ aspectRatio: "210 / 297" }}>
          {loading || !url
            ? <div className="flex h-full items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" />{tx("Rendering…", "তৈরি হচ্ছে…")}</div>
            : <iframe title="receipt-preview" src={url} className="h-full w-full" />}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => data && downloadBnReceiptPdf(data, copy, options)} disabled={!data}>
            <FileDown className="h-4 w-4 mr-1" />{tx("Download PDF", "PDF ডাউনলোড")}
          </Button>
          <Button variant="outline" disabled={!url} onClick={() => {
            const frame = document.querySelector<HTMLIFrameElement>('iframe[title="receipt-preview"]');
            frame?.contentWindow?.focus();
            frame?.contentWindow?.print();
          }}>
            <Printer className="h-4 w-4 mr-1" />{tx("Print", "প্রিন্ট")}
          </Button>
          <Button variant="outline" disabled={!data} onClick={() => {
            if (!data) return;
            exportExcel(`irrigation-receipt-${data.receipt_no}`, "Receipt", [irrigationReceiptToExcelRow(data)]);
          }}>
            <FileSpreadsheet className="h-4 w-4 mr-1" />Excel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
