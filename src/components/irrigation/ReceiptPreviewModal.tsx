/**
 * ধাপ ৫ — Receipt preview + printable PDF modal.
 *
 * Shows the receipt breakdown (receipt number, lines, totals, paid-to-date,
 * balance due) for a selected payment and lets the user download a printable
 * PDF carrying the correct receipt number.
 */
import { useMemo } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import {
  buildReceiptModel,
  type PaidHistoryRow,
  type ReceiptLine,
} from "@/lib/irrigationReceiptHistory";

interface ReceiptPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: PaidHistoryRow | null;
  payable: number;
  lines?: ReceiptLine[];
  farmerName?: string;
}

const money = (v: number) => v.toLocaleString("bn-BD", { maximumFractionDigits: 2 });

export function ReceiptPreviewModal({
  open,
  onOpenChange,
  row,
  payable,
  lines,
  farmerName,
}: ReceiptPreviewModalProps) {
  const model = useMemo(
    () => (row ? buildReceiptModel(row, payable, lines) : null),
    [row, payable, lines],
  );

  function downloadPdf() {
    if (!model) return;
    const doc = new jsPDF({ unit: "pt", format: "a5" });
    doc.setFontSize(14);
    doc.text("সেচ রসিদ / Irrigation Receipt", 40, 40);
    doc.setFontSize(10);
    doc.text(`রসিদ নং / Receipt No: ${model.receipt_no}`, 40, 62);
    if (farmerName) doc.text(`কৃষক / Farmer: ${farmerName}`, 40, 78);
    doc.text(`তারিখ / Date: ${String(model.paid_at).slice(0, 10)}`, 40, 94);

    autoTable(doc, {
      startY: 110,
      head: [["বিবরণ / Description", "পরিমাণ / Amount"]],
      body: model.lines.map((l) => [l.label, money(l.amount)]),
      foot: [
        ["মোট / Total", money(model.total)],
        ["পরিশোধিত / Paid to date", money(model.paid_to_date)],
        ["বকেয়া / Balance due", money(model.balance_due)],
      ],
    });
    doc.save(`receipt-${model.receipt_no}.pdf`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>রসিদ প্রিভিউ / Receipt Preview</DialogTitle>
        </DialogHeader>
        {model ? (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">রসিদ নং / Receipt No</span>
              <span className="font-medium">{model.receipt_no}</span>
            </div>
            {farmerName && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">কৃষক / Farmer</span>
                <span>{farmerName}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">তারিখ / Date</span>
              <span>{String(model.paid_at).slice(0, 10)}</span>
            </div>
            <div className="border-t pt-2 space-y-1">
              {model.lines.map((l, i) => (
                <div key={i} className="flex justify-between">
                  <span>{l.label}</span>
                  <span>{money(l.amount)}</span>
                </div>
              ))}
            </div>
            <div className="border-t pt-2 space-y-1">
              <div className="flex justify-between font-medium">
                <span>মোট / Total</span>
                <span>{money(model.total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">পরিশোধিত / Paid to date</span>
                <span>{money(model.paid_to_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">বকেয়া / Balance due</span>
                <span>{money(model.balance_due)}</span>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">কোনো পেমেন্ট নির্বাচন করা হয়নি।</p>
        )}
        <DialogFooter>
          <Button onClick={downloadPdf} disabled={!model}>
            <Download className="mr-2 h-4 w-4" />
            PDF ডাউনলোড
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
