import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Upload, Loader2, AlertTriangle, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { decodeSpreadsheetBuffer } from "@/lib/csvDecode";
import {
  LegacyIrrigationApi, LegacyIrrigationRow, LegacyIrrigationRecord, LegacyBatch,
} from "@/lib/api/legacyIrrigation";
import { ApiError } from "@/lib/api/client";

const MONTHS: Record<string, string> = {
  JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
  JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
};

/** "03-JUL-2025" | Date | Excel serial → "YYYY-MM-DD" | null */
function parseDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    return null;
  }
  const s = String(v).trim().toUpperCase();
  const m = s.match(/^(\d{1,2})[-/\s]([A-Z]{3})[-/\s](\d{4})$/);
  if (m && MONTHS[m[2]]) return `${m[3]}-${MONTHS[m[2]]}-${m[1].padStart(2, "0")}`;
  const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  return null;
}

const num = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const x = typeof v === "number" ? v : parseFloat(String(v).replace(/,/g, ""));
  return Number.isFinite(x) ? x : null;
};
const str = (v: unknown): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
};

/** Extract the farmer code inside the trailing parentheses of the name. */
function extractCode(name: unknown): string | null {
  const s = String(name ?? "");
  const m = s.match(/\((\d+)\)\s*$/);
  return m ? m[1] : null;
}

function mapRow(r: Record<string, unknown>): LegacyIrrigationRow {
  const g = (k: string) => r[k];
  return {
    legacy_farmer_code: extractCode(g("FARMER_NAME")),
    farmer_name: str(g("FARMER_NAME")),
    father_name: str(g("FATHER_NM")),
    village: str(g("VILLAGE")),
    mobile_no: str(g("MOBILE_NO")),
    mouza_name: str(g("MOUZA_NAME")),
    season_year: str(g("SESSON_YEAR")),
    land_shatak: num(g("LAND")),
    dag_no: str(g("DAG_NO")),
    rate: num(g("RATE")),
    owner_id_name: str(g("OWNER_ID_NM")),
    due_amount: num(g("DUE_AMOUNT")),
    paid_amount: num(g("PAID_AMOUNT")),
    owner_type_name: str(g("OWNER_TP_NAME")),
    owner_father_name: str(g("OWNER_FATHER_NM")),
    owner_village: str(g("OWNER_VILLAGE")),
    owner_mobile_no: str(g("OWNER_MOBILE_NO")),
    owner_fid: str(g("OWNER_FID")),
    receipt_no: str(g("RECEIPT_NO")),
    collection_date: parseDate(g("COLLECTION_DATE")),
  };
}

const REQUIRED_HEADERS = ["FARMER_NAME", "SESSON_YEAR", "RECEIPT_NO", "PAID_AMOUNT"];

export default function LegacyIrrigationImport() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<LegacyIrrigationRow[]>([]);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // search tab
  const [code, setCode] = useState("");
  const [records, setRecords] = useState<LegacyIrrigationRecord[]>([]);
  const [searching, setSearching] = useState(false);
  const [batches, setBatches] = useState<LegacyBatch[]>([]);

  function onFile(file: File) {
    setHeaderError(null);
    setParsed([]);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const isText = /\.(csv|txt|tsv)$/i.test(file.name);
        const wb = isText
          ? XLSX.read(decodeSpreadsheetBuffer(reader.result as ArrayBuffer), { type: "string", raw: true })
          : XLSX.read(reader.result as ArrayBuffer, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
        if (!json.length) { setHeaderError("ফাইলে কোনো সারি নেই।"); return; }
        const headers = Object.keys(json[0]).map((h) => h.trim().toUpperCase());
        const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
        if (missing.length) {
          setHeaderError(`প্রয়োজনীয় কলাম নেই: ${missing.join(", ")}`);
          return;
        }
        // normalize keys to uppercase-trimmed
        const rows = json.map((r) => {
          const out: Record<string, unknown> = {};
          for (const k of Object.keys(r)) out[k.trim().toUpperCase()] = r[k];
          return mapRow(out);
        });
        setParsed(rows);
        toast.success(`${rows.length} সারি পড়া হয়েছে`);
      } catch (e) {
        setHeaderError(e instanceof Error ? e.message : "ফাইল পড়া যায়নি।");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function save() {
    if (!parsed.length) return;
    setSaving(true);
    try {
      const res = await LegacyIrrigationApi.import(parsed);
      toast.success(`${res.inserted} সারি ইমপোর্ট হয়েছে`, {
        description: `ব্যাচ: ${res.batch_id.slice(0, 8)}…`,
      });
      setParsed([]);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "ইমপোর্ট ব্যর্থ হয়েছে";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function doSearch() {
    if (!code.trim()) return;
    setSearching(true);
    try {
      const rows = await LegacyIrrigationApi.list({ farmer_code: code.trim() });
      setRecords(rows);
      if (!rows.length) toast.info("এই কোডে কোনো রেকর্ড পাওয়া যায়নি");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "সার্চ ব্যর্থ হয়েছে");
    } finally {
      setSearching(false);
    }
  }

  async function loadBatches() {
    try { setBatches(await LegacyIrrigationApi.batches()); } catch { /* ignore */ }
  }

  async function removeBatch(id: string) {
    if (!confirm("এই পুরো ব্যাচ মুছে ফেলবেন?")) return;
    try {
      const res = await LegacyIrrigationApi.deleteBatch(id);
      toast.success(`${res.deleted} সারি মোছা হয়েছে`);
      loadBatches();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "মোছা যায়নি");
    }
  }

  const preview = parsed.slice(0, 20);
  const invalidCount = parsed.filter((r) => !r.legacy_farmer_code).length;

  return (
    <div className="space-y-6">
      <PageHeader title="পুরনো সেচ ডাটা ইমপোর্ট" description="আগের সফটওয়্যারের সেচ কালেকশন হিস্ট্রি (আলাদা টেবিল)" />

      <Tabs defaultValue="import" onValueChange={(v) => v === "batches" && loadBatches()}>
        <TabsList>
          <TabsTrigger value="import">ইমপোর্ট</TabsTrigger>
          <TabsTrigger value="search">কৃষক খুঁজুন</TabsTrigger>
          <TabsTrigger value="batches">ব্যাচ ব্যবস্থাপনা</TabsTrigger>
        </TabsList>

        {/* ── Import tab ── */}
        <TabsContent value="import" className="space-y-4">
          <Card className="p-4 space-y-4">
            <div>
              <Label>Excel/CSV ফাইল নির্বাচন করুন</Label>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv,.txt"
                className="mt-2 block text-sm"
                onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              />
              <p className="text-xs text-muted-foreground mt-1">
                প্রয়োজনীয় কলাম: FARMER_NAME, SESSON_YEAR, RECEIPT_NO, PAID_AMOUNT
              </p>
            </div>

            {headerError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>ফাইল সমস্যা</AlertTitle>
                <AlertDescription>{headerError}</AlertDescription>
              </Alert>
            )}

            {parsed.length > 0 && (
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="secondary">মোট সারি: {parsed.length}</Badge>
                {invalidCount > 0 && (
                  <Badge variant="destructive">কোড ছাড়া সারি: {invalidCount}</Badge>
                )}
                <Button onClick={save} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                  ইমপোর্ট করুন
                </Button>
              </div>
            )}
          </Card>

          {preview.length > 0 && (
            <Card className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>কোড</TableHead>
                    <TableHead>নাম</TableHead>
                    <TableHead>সিজন</TableHead>
                    <TableHead>মৌজা</TableHead>
                    <TableHead>দাগ</TableHead>
                    <TableHead>জমি</TableHead>
                    <TableHead>রশিদ</TableHead>
                    <TableHead>পরিশোধ</TableHead>
                    <TableHead>তারিখ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{r.legacy_farmer_code ?? "—"}</TableCell>
                      <TableCell>{r.farmer_name ?? "—"}</TableCell>
                      <TableCell>{r.season_year ?? "—"}</TableCell>
                      <TableCell>{r.mouza_name ?? "—"}</TableCell>
                      <TableCell>{r.dag_no ?? "—"}</TableCell>
                      <TableCell>{r.land_shatak ?? "—"}</TableCell>
                      <TableCell>{r.receipt_no ?? "—"}</TableCell>
                      <TableCell>{r.paid_amount ?? "—"}</TableCell>
                      <TableCell>{r.collection_date ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {parsed.length > preview.length && (
                <p className="text-xs text-muted-foreground p-3">
                  প্রথম {preview.length}টি সারি দেখানো হয়েছে (মোট {parsed.length})।
                </p>
              )}
            </Card>
          )}
        </TabsContent>

        {/* ── Search tab ── */}
        <TabsContent value="search" className="space-y-4">
          <Card className="p-4">
            <div className="flex items-end gap-2">
              <div className="flex-1 max-w-xs">
                <Label>ফার্মার কোড</Label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && doSearch()}
                  placeholder="যেমন 2473"
                  className="mt-2"
                />
              </div>
              <Button onClick={doSearch} disabled={searching}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                খুঁজুন
              </Button>
            </div>
          </Card>

          {records.length > 0 && (
            <Card className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>সিজন</TableHead>
                    <TableHead>মৌজা</TableHead>
                    <TableHead>দাগ</TableHead>
                    <TableHead>জমি</TableHead>
                    <TableHead>রেট</TableHead>
                    <TableHead>মালিক/বর্গা</TableHead>
                    <TableHead>রশিদ</TableHead>
                    <TableHead>পরিশোধ</TableHead>
                    <TableHead>তারিখ</TableHead>
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
                      <TableCell>{r.collection_date ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* ── Batches tab ── */}
        <TabsContent value="batches" className="space-y-4">
          <Card className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ব্যাচ আইডি</TableHead>
                  <TableHead>সারি সংখ্যা</TableHead>
                  <TableHead>তারিখ</TableHead>
                  <TableHead className="text-right">অ্যাকশন</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((b) => (
                  <TableRow key={b.import_batch_id}>
                    <TableCell className="font-mono text-xs">{b.import_batch_id.slice(0, 8)}…</TableCell>
                    <TableCell>{b.count}</TableCell>
                    <TableCell>{b.created_at?.slice(0, 19).replace("T", " ")}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => removeBatch(b.import_batch_id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {batches.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">কোনো ব্যাচ নেই</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
