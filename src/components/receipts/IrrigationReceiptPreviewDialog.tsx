import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileDown, FileSpreadsheet, Loader2 } from "lucide-react";
import { downloadBnReceiptPdf, previewBnReceiptPdf, type BnReceiptData, type ReceiptCopy } from "@/lib/bnReceipts";
import { irrigationReceiptToExcelRow } from "@/lib/bnReceipts";
import { exportExcel } from "@/lib/exports";
import { useLang } from "@/i18n/LanguageProvider";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  data: BnReceiptData | null;
  copy?: ReceiptCopy;
}

/**
 * Print-ready preview for the সেচ (irrigation) receipt. Renders the exact PDF
 * (QR code, মৌজা, watermark) in an iframe so the user can verify it before
 * downloading PDF or Excel — both produced from the same receipt data.
 */
export function IrrigationReceiptPreviewDialog({ open, onOpenChange, data, copy = "both" }: Props) {
  const { tx } = useLang();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    if (open && data) {
      setLoading(true);
      previewBnReceiptPdf(data, copy)
        .then((u) => { if (active) setUrl(u); })
        .finally(() => { if (active) setLoading(false); });
    } else {
      setUrl(null);
    }
    return () => { active = false; };
  }, [open, data, copy]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>{tx("Irrigation receipt preview", "সেচ রসিদ প্রিভিউ")}</DialogTitle></DialogHeader>
        <div className="h-[60vh] w-full overflow-hidden rounded-md border bg-muted">
          {loading || !url
            ? <div className="flex h-full items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" />{tx("Rendering…", "তৈরি হচ্ছে…")}</div>
            : <iframe title="receipt-preview" src={url} className="h-full w-full" />}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => data && downloadBnReceiptPdf(data, copy)} disabled={!data}>
            <FileDown className="h-4 w-4 mr-1" />PDF
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
