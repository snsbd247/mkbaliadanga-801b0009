import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Search, Download } from "lucide-react";
import { toast } from "sonner";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { LegacyIrrigationApi, LegacyIrrigationRecord } from "@/lib/api/legacyIrrigation";
import { ApiError } from "@/lib/api/client";
import { downloadLegacyReceipts } from "@/lib/legacyReceiptPdf";
import { useLang } from "@/i18n/LanguageProvider";

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
  const [records, setRecords] = useState<LegacyIrrigationRecord[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);

  async function doSearch() {
    if (!code.trim()) return;
    setSearching(true);
    setSelected(new Set());
    try {
      const rows = await LegacyIrrigationApi.list({ farmer_code: code.trim() });
      setRecords(rows);
      if (!rows.length) toast.info(tx("No records found for this code", "এই কোডে কোনো রেকর্ড পাওয়া যায়নি"));
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

  async function download(rows: LegacyIrrigationRecord[]) {
    if (!rows.length) return;
    setDownloading(true);
    try {
      await downloadLegacyReceipts(rows);
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
        description={tx("Look up a farmer's old irrigation collection history by farmer code", "ফার্মার কোড দিয়ে কৃষকের পুরনো সেচ কালেকশন হিস্ট্রি দেখুন")}
      />

      <Card className="p-4">
        <div className="flex items-end gap-2">
          <div className="flex-1 max-w-xs">
            <Label>{tx("Farmer Code", "ফার্মার কোড")}</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doSearch()}
              placeholder={tx("e.g. 2473", "যেমন 2473")}
              className="mt-2"
            />
          </div>
          <Button onClick={doSearch} disabled={searching}>
            {searching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
            {tx("Search", "খুঁজুন")}
          </Button>
        </div>
      </Card>

      {records.length > 0 && (
        <Card className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tx("Season", "সিজন")}</TableHead>
                <TableHead>{tx("Mouza", "মৌজা")}</TableHead>
                <TableHead>{tx("Dag", "দাগ")}</TableHead>
                <TableHead>{tx("Land", "জমি")}</TableHead>
                <TableHead>{tx("Rate", "রেট")}</TableHead>
                <TableHead>{tx("Owner/Sharecropper", "মালিক/বর্গা")}</TableHead>
                <TableHead>{tx("Receipt", "রশিদ")}</TableHead>
                <TableHead>{tx("Paid", "পরিশোধ")}</TableHead>
                <TableHead>{tx("Date", "তারিখ")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.season_year ?? "—"}</TableCell>
                  <TableCell>{r.mouza_name ?? "—"}</TableCell>
                  <TableCell>{r.dag_no ?? "—"}</TableCell>
                  <TableCell>{r.land_shatak ?? "—"}</TableCell>
                  <TableCell>{r.rate ?? "—"}</TableCell>
                  <TableCell>{r.owner_type_name ?? "—"}</TableCell>
                  <TableCell>{r.receipt_no ?? "—"}</TableCell>
                  <TableCell>{r.paid_amount ?? "—"}</TableCell>
                  <TableCell>{fmtDisplayDate(r.collection_date)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="font-semibold bg-muted/50">
                <TableCell colSpan={3} className="text-right">{tx("Total", "মোট")}</TableCell>
                <TableCell>{records.reduce((s, r) => s + (r.land_shatak ?? 0), 0)}</TableCell>
                <TableCell colSpan={3} className="text-right">{tx("Total Paid", "মোট পরিশোধ")}</TableCell>
                <TableCell>{records.reduce((s, r) => s + (r.paid_amount ?? 0), 0)}</TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
