import { useState, useLayoutEffect, useRef } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Search, Download, Eye } from "lucide-react";
import { toast } from "sonner";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { LegacyIrrigationApi, LegacyIrrigationRecord } from "@/lib/api/legacyIrrigation";
import { ApiError } from "@/lib/api/client";
import { downloadLegacyReceipts, buildLegacyReceiptPreview } from "@/lib/legacyReceiptPdf";
import {
  PAPER_PRESETS, DEFAULT_PAPER_ID, PAGE_MARGIN_MM,
  getPaperPreset, computeReceiptFit,
} from "@/lib/legacyReceiptLayout";
import { useLang } from "@/i18n/LanguageProvider";
import { validateFarmerCode, FARMER_CODE_MESSAGES } from "@/lib/legacyFarmerCode";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtDisplayDate(v: unknown): string {
  if (v == null || v === "") return "—";
  const s = String(v).trim();
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const m = Number(iso[2]);
    if (m >= 1 && m <= 12) return `${iso[3].padStart(2, "0")}-${MONTH_NAMES[m - 1]}-${iso[1]}`;
  }
  return s;
}


export default function LegacyIrrigationSearch() {
  const { tx } = useLang();
  const [code, setCode] = useState("");
  
  const [inputError, setInputError] = useState<string | null>(null);
  const [records, setRecords] = useState<LegacyIrrigationRecord[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [preview, setPreview] = useState<{ rows: LegacyIrrigationRecord[]; html: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [paperId, setPaperId] = useState<string>(DEFAULT_PAPER_ID);
  const [showGuides, setShowGuides] = useState(false);

  async function doSearch() {
    const q = code.trim();
    // ── Input validation: farmer code only (numeric, min 3, max 15) ──
    const err = validateFarmerCode(q);
    if (err) {
      const m = FARMER_CODE_MESSAGES[err];
      setInputError(tx(m.en, m.bn));
      return;
    }
    setInputError(null);
    setSearching(true);
    setSelected(new Set());
    try {
      // Search by farmer code only (original behaviour).
      const rows = await LegacyIrrigationApi.list({ farmer_code: q });
      setRecords(rows);
      
      if (!rows.length) toast.info(tx("No records found", "কোনো রেকর্ড পাওয়া যায়নি"));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : tx("Search failed", "সার্চ ব্যর্থ হয়েছে"));
    } finally {
      setSearching(false);
    }
  }


  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const allSelected = records.length > 0 && selected.size === records.length;
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(records.map((r) => r.id)));

  async function openPreview(rows: LegacyIrrigationRecord[]) {
    if (!rows.length) return;
    setPreviewLoading(true);
    try {
      const html = await buildLegacyReceiptPreview(rows);
      setPreview({ rows, html });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tx("Preview failed", "প্রিভিউ ব্যর্থ হয়েছে"));
    } finally {
      setPreviewLoading(false);
    }
  }

  async function confirmDownload() {
    if (!preview) return;
    const rows = preview.rows;
    const mode = rows.length === 1 ? "single" : "bulk";
    setPreview(null);
    setDownloading(true);
    setProgress({ done: 0, total: rows.length });
    try {
      await downloadLegacyReceipts(rows, (done, total) => setProgress({ done, total }), paperId);
      toast.success(tx(`${rows.length} receipt(s) downloaded`, `${rows.length} টি রশিদ ডাউনলোড হয়েছে`));
      // Best-effort audit log — non-fatal on failure.
      LegacyIrrigationApi.logDownload({
        receipt_nos: rows.map((r) => r.receipt_no ?? null),
        count: rows.length,
        mode,
      }).catch(() => {/* ignore */});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tx("Download failed", "ডাউনলোড ব্যর্থ হয়েছে"));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={tx("Old Data (Legacy Irrigation)", "পুরনো ডাটা (সেচ)")}
        description={tx("Look up a farmer's old irrigation history by farmer code", "ফার্মার কোড দিয়ে কৃষকের পুরনো সেচ হিস্ট্রি দেখুন")}
      />

      <Card className="p-4">
        <div className="flex items-end gap-2">
          <div className="flex-1 max-w-xs">
            <Label>{tx("Farmer Code", "ফার্মার কোড")}</Label>
            <Input
              value={code}
              onChange={(e) => { setCode(e.target.value); if (inputError) setInputError(null); }}
              onKeyDown={(e) => e.key === "Enter" && doSearch()}
              placeholder={tx("Farmer code (e.g. 2473)", "ফার্মার কোড (যেমন 2473)")}
              className="mt-2"
              aria-invalid={!!inputError}
              inputMode="numeric"
              autoComplete="off"
              name="legacy-farmer-code"
            />
            {inputError ? (
              <p className="mt-1 text-xs text-destructive">{inputError}</p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                {tx(
                  "Search by farmer code only (digits only, min 3).",
                  "শুধু ফার্মার কোড দিয়ে খুঁজুন (শুধু সংখ্যা, কমপক্ষে ৩)।",
                )}
              </p>
            )}
          </div>
          <Button onClick={doSearch} disabled={searching}>
            {searching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
            {tx("Search", "খুঁজুন")}
          </Button>
        </div>
      </Card>


      {records.length > 0 && (
        <Card className="p-0 overflow-x-auto">
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-b">
            <span className="text-sm text-muted-foreground">
              {selected.size > 0
                ? tx(`${selected.size} selected`, `${selected.size} টি নির্বাচিত`)
                : tx("Select rows to download receipts", "রশিদ ডাউনলোড করতে সারি নির্বাচন করুন")}
            </span>
            <div className="flex items-center gap-3">
              {downloading && progress.total > 0 && (
                <div className="flex items-center gap-2 min-w-40">
                  <Progress value={(progress.done / progress.total) * 100} className="w-28" />
                  <span className="text-xs text-muted-foreground">{progress.done}/{progress.total}</span>
                </div>
              )}
              <Button
                size="sm"
                disabled={selected.size === 0 || downloading || previewLoading}
                onClick={() => openPreview(records.filter((r) => selected.has(r.id)))}
              >
                {previewLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                {tx("Preview & Download Selected", "নির্বাচিত রশিদ প্রিভিউ ও ডাউনলোড")}
              </Button>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="select all" />
                </TableHead>
                
                <TableHead>{tx("Season", "সিজন")}</TableHead>
                <TableHead>{tx("Mouza", "মৌজা")}</TableHead>
                <TableHead>{tx("Dag", "দাগ")}</TableHead>
                <TableHead>{tx("Land", "জমি")}</TableHead>
                <TableHead>{tx("Rate", "রেট")}</TableHead>
                <TableHead>{tx("Owner/Sharecropper", "মালিক/বর্গা")}</TableHead>
                <TableHead>{tx("Receipt", "রশিদ")}</TableHead>
                <TableHead>{tx("Paid", "পরিশোধ")}</TableHead>
                <TableHead>{tx("Date", "তারিখ")}</TableHead>
                <TableHead className="text-right">{tx("Receipt", "রশিদ")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} aria-label="select row" />
                  </TableCell>
                  <TableCell>{r.season_year ?? "—"}</TableCell>
                  <TableCell>{r.mouza_name ?? "—"}</TableCell>
                  <TableCell>{r.dag_no ?? "—"}</TableCell>
                  <TableCell>{r.land_shatak ?? "—"}</TableCell>
                  <TableCell>{r.rate ?? "—"}</TableCell>
                  <TableCell>{r.owner_type_name ?? "—"}</TableCell>
                  <TableCell>{r.receipt_no ?? "—"}</TableCell>
                  <TableCell>{r.paid_amount ?? "—"}</TableCell>
                  <TableCell>{fmtDisplayDate(r.collection_date)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" disabled={downloading || previewLoading} onClick={() => openPreview([r])}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="font-semibold bg-muted/50">
                <TableCell colSpan={4} className="text-right">{tx("Total", "মোট")}</TableCell>
                <TableCell>{records.reduce((s, r) => s + (r.land_shatak ?? 0), 0)}</TableCell>
                <TableCell colSpan={3} className="text-right">{tx("Total Paid", "মোট পরিশোধ")}</TableCell>
                <TableCell>{records.reduce((s, r) => s + (r.paid_amount ?? 0), 0)}</TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {tx("Verify Receipt", "রশিদ যাচাই")}
              {preview && preview.rows.length > 1 ? ` (${preview.rows.length})` : ""}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Label className="whitespace-nowrap">{tx("Paper", "কাগজ")}</Label>
              <select
                className="h-9 rounded-md border bg-background px-2"
                value={paperId}
                onChange={(e) => setPaperId(e.target.value)}
              >
                {Object.values(PAPER_PRESETS).map((p) => (
                  <option key={p.id} value={p.id}>{tx(p.labelEn, p.labelBn)}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={showGuides} onCheckedChange={(v) => setShowGuides(!!v)} />
              {tx("Safe-area guides", "সেফ-এরিয়া গাইড")}
            </label>
          </div>

          <ScaledReceiptPreview html={preview?.html ?? ""} paperId={paperId} showGuides={showGuides} />


          <DialogFooter>
            <Button variant="outline" onClick={() => setPreview(null)}>{tx("Cancel", "বাতিল")}</Button>
            <Button onClick={confirmDownload} disabled={downloading}>
              {downloading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
              {tx("Download", "ডাউনলোড")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Renders the fixed-width (720px) receipt HTML inside a scaled representation
 *  of the selected paper page, using the EXACT same fit rule as the PDF export
 *  so the preview never drifts from the printed output. Optionally overlays
 *  safe-area guides (printable margin + center lines). */
function ScaledReceiptPreview({
  html, paperId, showGuides,
}: { html: string; paperId: string; showGuides: boolean }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [pageWidthPx, setPageWidthPx] = useState(0);
  const [receiptHeightPx, setReceiptHeightPx] = useState(0);

  const paper = getPaperPreset(paperId);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const measure = measureRef.current;
    if (!outer || !measure) return;
    const update = () => {
      setPageWidthPx(outer.clientWidth);
      setReceiptHeightPx(measure.offsetHeight);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(outer);
    return () => ro.disconnect();
  }, [html, paperId]);

  // px-per-mm derived from the page width so the whole page fits the dialog.
  const pxPerMm = pageWidthPx / paper.widthMm;
  const pageHeightPx = paper.heightMm * pxPerMm;
  const marginPx = PAGE_MARGIN_MM * pxPerMm;

  // Fit uses the natural receipt canvas ratio (720 × measured height).
  const fit = computeReceiptFit(paper, 1040, receiptHeightPx || 700, PAGE_MARGIN_MM);
  const receiptScale = pxPerMm > 0 ? (fit.imgW * pxPerMm) / 1040 : 1;

  return (
    <>
      {/* Hidden natural-size render, used only to measure the receipt height. */}
      <div
        ref={measureRef}
        aria-hidden
        style={{ position: "fixed", left: -10000, top: 0, width: 1040 }}
        dangerouslySetInnerHTML={{ __html: html }}
      />

      <div ref={outerRef} className="rounded-md bg-muted/30 p-3 overflow-hidden">
        <div
          className="relative mx-auto bg-white shadow-sm"
          style={{ width: pageWidthPx || "100%", height: pageHeightPx || undefined }}
        >
          {/* The receipt, placed exactly where the PDF will place it. */}
          <div
            style={{
              position: "absolute",
              left: fit.x * pxPerMm,
              top: fit.y * pxPerMm,
              width: 1040,
              transform: `scale(${receiptScale})`,
              transformOrigin: "top left",
            }}
            dangerouslySetInnerHTML={{ __html: html }}
          />

          {showGuides && (
            <div className="pointer-events-none absolute inset-0">
              {/* Printable safe area */}
              <div
                className="absolute border-2 border-dashed border-primary/70"
                style={{ left: marginPx, top: marginPx, right: marginPx, bottom: marginPx }}
              />
              {/* Center guides */}
              <div className="absolute top-0 bottom-0 border-l border-destructive/50" style={{ left: "50%" }} />
              <div className="absolute left-0 right-0 border-t border-destructive/50" style={{ top: "50%" }} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}


