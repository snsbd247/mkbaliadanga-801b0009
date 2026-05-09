import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileDown, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { exportCSV, exportExcel, exportTablePDF } from "@/lib/exports";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageProvider";

export type ExportColumn<T = any> = {
  /** unique key, also used as Excel/CSV header when label not given */
  key: string;
  /** human label shown in dialog & used as PDF/CSV header */
  label: string;
  /** how to read the value from a row */
  accessor: (row: T) => any;
  /** default checked */
  defaultSelected?: boolean;
};

export type ExportFormat = "csv" | "xlsx" | "pdf";

type Props<T> = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Display name used for filename + PDF title */
  reportName: string;
  columns: ExportColumn<T>[];
  rows: T[];
  range?: { from?: string | null; to?: string | null };
  /** allowed formats — defaults to all three */
  formats?: ExportFormat[];
};

const FORMAT_LABEL: Record<ExportFormat, string> = {
  csv: "CSV (.csv)",
  xlsx: "Excel (.xlsx)",
  pdf: "PDF (.pdf)",
};

const FORMAT_ICON: Record<ExportFormat, JSX.Element> = {
  csv: <FileDown className="h-4 w-4" />,
  xlsx: <FileSpreadsheet className="h-4 w-4" />,
  pdf: <FileText className="h-4 w-4" />,
};

export function ExportDialog<T = any>({
  open,
  onOpenChange,
  reportName,
  columns,
  rows,
  range,
  formats = ["csv", "xlsx", "pdf"],
}: Props<T>) {
  const { t } = useLang();
  const initial = useMemo(
    () =>
      Object.fromEntries(
        columns.map((c) => [c.key, c.defaultSelected !== false])
      ) as Record<string, boolean>,
    [columns]
  );
  const [selected, setSelected] = useState<Record<string, boolean>>(initial);
  const [format, setFormat] = useState<ExportFormat>(formats[0]);
  const [busy, setBusy] = useState(false);

  const toggleAll = (val: boolean) =>
    setSelected(Object.fromEntries(columns.map((c) => [c.key, val])));

  const handleExport = async () => {
    const cols = columns.filter((c) => selected[c.key]);
    if (cols.length === 0) {
      toast.error(t("exp_pickAtLeastOne" as any));
      return;
    }
    setBusy(true);
    try {
      const head = cols.map((c) => c.label);
      const body = rows.map((r) => cols.map((c) => c.accessor(r)));
      if (format === "csv") {
        exportCSV(reportName, head, body, range);
      } else if (format === "xlsx") {
        const objs = rows.map((r) =>
          Object.fromEntries(cols.map((c) => [c.label, c.accessor(r)]))
        );
        exportExcel(reportName, reportName.slice(0, 28) || "Report", objs, range);
      } else {
        await exportTablePDF(reportName, head, body, range);
      }
      toast.success(t("exp_done" as any));
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? t("exp_failed" as any));
    } finally {
      setBusy(false);
    }
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>এক্সপোর্ট অপশন</DialogTitle>
          <DialogDescription>
            কলাম ও ফরম্যাট নির্বাচন করুন · {rows.length} টি সারি
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium">কলাম ({selectedCount}/{columns.length})</Label>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => toggleAll(true)}>
                  সব
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => toggleAll(false)}>
                  কোনটি না
                </Button>
              </div>
            </div>
            <ScrollArea className="h-48 rounded-md border p-2">
              <div className="grid grid-cols-2 gap-2">
                {columns.map((c) => (
                  <label
                    key={c.key}
                    className="flex items-center gap-2 text-sm cursor-pointer rounded p-1 hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={!!selected[c.key]}
                      onCheckedChange={(v) =>
                        setSelected((prev) => ({ ...prev, [c.key]: !!v }))
                      }
                    />
                    <span className="truncate">{c.label}</span>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div>
            <Label className="text-sm font-medium mb-2 block">ফরম্যাট</Label>
            <RadioGroup
              value={format}
              onValueChange={(v) => setFormat(v as ExportFormat)}
              className="grid grid-cols-3 gap-2"
            >
              {formats.map((f) => (
                <label
                  key={f}
                  className={`flex items-center gap-2 border rounded-md p-2 cursor-pointer text-sm ${
                    format === f ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <RadioGroupItem value={f} />
                  {FORMAT_ICON[f]}
                  <span>{FORMAT_LABEL[f]}</span>
                </label>
              ))}
            </RadioGroup>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            বাতিল
          </Button>
          <Button onClick={handleExport} disabled={busy || selectedCount === 0}>
            {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileDown className="h-4 w-4 mr-1" />}
            এক্সপোর্ট
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
