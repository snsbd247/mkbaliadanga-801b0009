import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import { useAuth } from "@/auth/AuthProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Upload, Download, AlertTriangle, Loader2, Eye } from "lucide-react";
import { toast } from "sonner";
import { decodeSpreadsheetBuffer } from "@/lib/csvDecode";
import { normalizeFarmerCode } from "@/lib/farmerCode";
import { downloadCsvTemplate } from "@/lib/importTemplates";

/**
 * Invoice-based payment import.
 *
 * Each CSV row is a payment made by a farmer (account_number) against the
 * irrigation invoice(s) for a given land (dag_no) in the selected season.
 * The amount is allocated to the matched invoice(s) oldest-first; each row
 * inserts one `payments` record and one or more `irrigation_invoice_payments`
 * allocation rows, and updates each invoice's paid/due/status.
 */

type Cell = string | number | null;
type RowMap = Record<string, Cell>;

type Alloc = {
  invoiceId: string;
  invoiceNo: string;
  officeId: string | null;
  dueBefore: number;
  take: number;
  dueAfter: number;
};

type RowState = {
  idx: number;
  raw: RowMap;
  status: "pending" | "valid" | "invalid" | "saving" | "saved" | "error";
  errorMsg: string | null;
  farmerId?: string;
  amount: number;
  allocated: number;
  unallocated: number;
  allocs: Alloc[];
};

const COLUMNS = [
  "account_number", "dag_no", "amount", "method", "paid_on", "note",
] as const;

function normalizeKey(k: string) {
  return k.trim().toLowerCase().replace(/\s+/g, "_");
}
const num = (v: unknown): number => {
  const x = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(x) ? x : 0;
};
const round2 = (v: number) => Math.round(v * 100) / 100;

function readBookFromFile(file: File): Promise<XLSX.WorkBook> {
  const isText = /\.(csv|txt|tsv)$/i.test(file.name) || file.type === "text/csv" || file.type === "text/plain";
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      try {
        if (isText) {
          const text = decodeSpreadsheetBuffer(reader.result as ArrayBuffer);
          resolve(XLSX.read(text, { type: "string", raw: true }));
        } else {
          resolve(XLSX.read(reader.result as ArrayBuffer, { type: "array" }));
        }
      } catch (e) { reject(e); }
    };
    reader.readAsArrayBuffer(file);
  });
}

function parseSheet(wb: XLSX.WorkBook): RowMap[] {
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
  return json.map((r) => {
    const out: RowMap = {};
    for (const k of Object.keys(r)) {
      const v = r[k];
      out[normalizeKey(k)] = v === "" ? null : (typeof v === "string" ? v.trim() : v);
    }
    return out;
  });
}

export default function PaymentsImport() {
  const { officeId, user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<RowState[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [seasonId, setSeasonId] = useState<string>("");

  useEffect(() => {
    document.title = "পেমেন্ট ইমপোর্ট — Payment Import";
    db.from("seasons").select("id,name,year").then(({ data }) => setSeasons(data ?? []));
  }, []);

  async function handleFile(f: File | null) {
    if (!f) return;
    if (!seasonId) { toast.error("আগে সিজন নির্বাচন করুন"); return; }
    try {
      const wb = await readBookFromFile(f);
      const parsed = parseSheet(wb);
      if (parsed.length === 0) { toast.error("ফাইল খালি।"); return; }

      // Lookups: farmers, lands (dags), and invoices in the selected season.
      const [{ data: fm }, { data: ld }, { data: inv }] = await Promise.all([
        db.from("farmers").select("id,farmer_code,name"),
        db.from("lands").select("id,dag_no,dag_numbers"),
        db.from("irrigation_invoices")
          .select("id,invoice_no,farmer_id,land_id,office_id,payable_amount,paid_amount,due_amount,due_date")
          .eq("season_id", seasonId),
      ]);

      const farmerMap = new Map<string, string>();
      (fm ?? []).forEach((x: any) => { if (x.farmer_code) farmerMap.set(String(x.farmer_code).trim(), x.id); });

      // land_id -> set of dag strings
      const landDags = new Map<string, string[]>();
      (ld ?? []).forEach((l: any) => {
        const dags: string[] = [];
        if (l.dag_no) dags.push(String(l.dag_no).trim());
        if (Array.isArray(l.dag_numbers)) l.dag_numbers.forEach((d: any) => dags.push(String(d).trim()));
        landDags.set(l.id, dags.filter(Boolean));
      });

      // Working copy of invoice due amounts so multi-row allocation in the same
      // preview does not double-count against a single invoice.
      const invPool = (inv ?? []).map((i: any) => ({
        id: i.id,
        invoice_no: i.invoice_no,
        farmer_id: i.farmer_id,
        land_id: i.land_id,
        office_id: i.office_id,
        payable: num(i.payable_amount),
        paid: num(i.paid_amount),
        due: i.due_amount != null ? num(i.due_amount) : Math.max(0, num(i.payable_amount) - num(i.paid_amount)),
        due_date: i.due_date,
        remaining: i.due_amount != null ? num(i.due_amount) : Math.max(0, num(i.payable_amount) - num(i.paid_amount)),
      }));

      const initial: RowState[] = parsed.map((raw, idx) => {
        const errors: string[] = [];
        let farmerId: string | undefined;
        const payerRaw = String(raw.account_number ?? "").trim();
        if (!payerRaw) errors.push("account_number আবশ্যক");
        else {
          const r = normalizeFarmerCode(payerRaw);
          if (r.ok === false) errors.push(`সদস্য ID সঠিক নয়: ${payerRaw}`);
          else { raw.account_number = r.value; farmerId = farmerMap.get(r.value); if (!farmerId) errors.push(`সদস্য পাওয়া যায়নি (${r.value})`); }
        }
        const dag = String(raw.dag_no ?? "").trim();
        if (!dag) errors.push("dag_no আবশ্যক");
        const amount = round2(num(raw.amount));
        if (amount <= 0) errors.push("amount অবশ্যই ০ এর বেশি");

        const allocs: Alloc[] = [];
        let allocated = 0;
        if (farmerId && dag && amount > 0) {
          const matches = invPool
            .filter((i) => i.farmer_id === farmerId && (landDags.get(i.land_id) ?? []).includes(dag) && i.remaining > 0.009)
            .sort((a, b) => new Date(a.due_date || 0).getTime() - new Date(b.due_date || 0).getTime());
          if (matches.length === 0) errors.push(`মিলে যাওয়া ইনভয়েস নেই (সদস্য ${payerRaw}, দাগ ${dag}, এই সিজন)`);
          let remaining = amount;
          for (const m of matches) {
            if (remaining <= 0.009) break;
            const take = round2(Math.min(remaining, m.remaining));
            if (take <= 0) continue;
            allocs.push({
              invoiceId: m.id, invoiceNo: m.invoice_no, officeId: m.office_id,
              dueBefore: round2(m.remaining), take, dueAfter: round2(m.remaining - take),
            });
            m.remaining = round2(m.remaining - take); // consume for later rows
            remaining = round2(remaining - take);
            allocated = round2(allocated + take);
          }
        }
        const unallocated = round2(amount - allocated);

        return {
          idx, raw,
          status: errors.length ? "invalid" : "valid",
          errorMsg: errors.length ? errors.join("; ") : null,
          farmerId, amount, allocated, unallocated, allocs,
        };
      });
      setRows(initial);
      setSavedCount(0);
    } catch (e: any) {
      toast.error(e?.message ?? "ফাইল পড়া যায়নি");
    }
  }

  const validRows = useMemo(() => rows.filter((r) => r.status === "valid"), [rows]);
  const invalidRows = useMemo(() => rows.filter((r) => r.status === "invalid"), [rows]);
  const overpayRows = useMemo(() => validRows.filter((r) => r.unallocated > 0.009), [validRows]);
  const totalAlloc = useMemo(() => round2(validRows.reduce((s, r) => s + r.allocated, 0)), [validRows]);

  async function importValid() {
    if (!seasonId) { toast.error("আগে সিজন নির্বাচন করুন"); return; }
    if (validRows.length === 0) { toast.error("ইমপোর্ট করার মতো সঠিক সারি নেই।"); return; }
    setSaving(true);
    let insertedRows = 0, insertedAllocs = 0, failed = 0;
    const updated = [...rows];

    for (const r of validRows) {
      const i = updated.findIndex((x) => x.idx === r.idx);
      updated[i] = { ...updated[i], status: "saving", errorMsg: null };
      setRows([...updated]);
      try {
        if (!r.farmerId) throw new Error("সদস্য রেজলভ হয়নি");
        if (r.allocs.length === 0) throw new Error("বরাদ্দযোগ্য ইনভয়েস নেই");
        const rowOffice = r.allocs[0].officeId ?? officeId ?? null;
        const method = String(r.raw.method ?? "cash").trim().toLowerCase() || "cash";
        const paidOn = String(r.raw.paid_on ?? "").trim();

        // 1) payment record (total for the row)
        const { data: ins, error: payErr } = await db.from("payments").insert({
          farmer_id: r.farmerId,
          kind: "irrigation",
          amount: r.allocated,
          method,
          note: `ইমপোর্ট পেমেন্ট${r.raw.note ? " — " + String(r.raw.note) : ""}`,
          collected_by: user?.id ?? null,
          status: "approved",
          office_id: rowOffice,
          ...(paidOn ? { created_at: paidOn } : {}),
        }).select("id").single();
        if (payErr) throw new Error(payErr.message);
        const paymentId = ins!.id as string;

        // 2) allocate to each matched invoice
        for (const a of r.allocs) {
          const { error: aErr } = await db.from("irrigation_invoice_payments").insert({
            invoice_id: a.invoiceId,
            payment_id: paymentId,
            office_id: a.officeId,
            collected_amount: a.take,
            irrigation_collected: a.take,
            current_invoice_collected: a.take,
            previous_due_collected: 0,
            created_by: user?.id ?? null,
          });
          if (aErr) throw new Error(aErr.message);

          // update invoice paid/due/status
          const { data: cur } = await db.from("irrigation_invoices")
            .select("payable_amount,paid_amount").eq("id", a.invoiceId).single();
          const payable = num(cur?.payable_amount);
          const paidAmt = round2(num(cur?.paid_amount) + a.take);
          const dueAmt = Math.max(0, round2(payable - paidAmt));
          const { error: uErr } = await db.from("irrigation_invoices").update({
            paid_amount: paidAmt,
            due_amount: dueAmt,
            invoice_status: dueAmt <= 0.009 ? "paid" : "partial",
          }).eq("id", a.invoiceId);
          if (uErr) throw new Error(uErr.message);
          insertedAllocs++;
        }

        updated[i] = { ...updated[i], status: "saved", errorMsg: null };
        insertedRows++;
      } catch (e: any) {
        updated[i] = { ...updated[i], status: "error", errorMsg: e?.message ?? "ত্রুটি" };
        failed++;
      }
      setRows([...updated]);
    }

    setSavedCount(insertedRows);
    setSaving(false);

    try {
      await db.from("import_audit_logs").insert({
        office_id: officeId ?? null,
        module: "irrigation_payments",
        mode: "insert",
        rows_processed: validRows.length,
        rows_inserted: insertedRows,
        rows_updated: insertedAllocs,
        rows_failed: failed,
        summary: { season_id: seasonId, source: "PaymentsImport" },
      });
    } catch { /* best-effort */ }

    if (failed === 0) toast.success(`${insertedRows} টি পেমেন্ট ইমপোর্ট হয়েছে (${insertedAllocs} ইনভয়েসে বরাদ্দ)`);
    else toast.warning(`${insertedRows} টি সফল, ${failed} টি ব্যর্থ`);
  }

  return (
    <>
      <PageHeader title="পেমেন্ট ইমপোর্ট" description="ইনভয়েস-ভিত্তিক পেমেন্ট আপলোড করুন — সদস্য ও দাগ অনুযায়ী নির্দিষ্ট সিজনের ইনভয়েসে স্বয়ংক্রিয় বরাদ্দ হবে" />

      <Card className="p-4 space-y-4">
        <div className="max-w-xs">
          <Label className="mb-1 block">সিজন</Label>
          <Select value={seasonId} onValueChange={(v) => { setSeasonId(v); setRows([]); }}>
            <SelectTrigger><SelectValue placeholder="সিজন নির্বাচন করুন" /></SelectTrigger>
            <SelectContent>
              {seasons.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}{s.year ? ` (${s.year})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls,.txt,.tsv"
            className="hidden"
            onChange={(e) => { handleFile(e.target.files?.[0] ?? null); if (fileRef.current) fileRef.current.value = ""; }}
          />
          <Button onClick={() => fileRef.current?.click()} variant="default" disabled={!seasonId}>
            <Upload className="h-4 w-4 mr-2" /> ফাইল নির্বাচন করুন
          </Button>
          <Button onClick={() => downloadCsvTemplate("payments")} variant="outline">
            <Download className="h-4 w-4 mr-2" /> টেমপ্লেট (CSV)
          </Button>
          {validRows.length > 0 && (
            <Button onClick={importValid} disabled={saving || !seasonId} className="ml-auto">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {validRows.length} টি পেমেন্ট ইমপোর্ট করুন
            </Button>
          )}
        </div>

        {rows.length > 0 && (
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="secondary">মোট সারি: {rows.length}</Badge>
            <Badge variant="default">প্রস্তুত: {validRows.length}</Badge>
            <Badge variant="secondary"><Eye className="h-3 w-3 mr-1" />মোট বরাদ্দ: ৳{totalAlloc}</Badge>
            <Badge variant="destructive">ত্রুটি: {invalidRows.length}</Badge>
            {savedCount > 0 && <Badge>সংরক্ষিত: {savedCount}</Badge>}
          </div>
        )}

        {invalidRows.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>কিছু সারিতে ত্রুটি আছে</AlertTitle>
            <AlertDescription>ত্রুটিপূর্ণ সারি ইমপোর্ট হবে না। নিচে কারণ দেখুন।</AlertDescription>
          </Alert>
        )}

        {overpayRows.length > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>কিছু সারিতে অতিরিক্ত টাকা আছে</AlertTitle>
            <AlertDescription>
              ঐ সারিগুলোতে বকেয়ার চেয়ে বেশি টাকা দেয়া হয়েছে — শুধু বকেয়ার সমপরিমাণ বরাদ্দ হবে, বাকিটা উপেক্ষিত।
            </AlertDescription>
          </Alert>
        )}
      </Card>

      {rows.length > 0 && (
        <Card className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>অবস্থা</TableHead>
                <TableHead>সদস্য ID</TableHead>
                <TableHead>দাগ</TableHead>
                <TableHead className="text-right">টাকা</TableHead>
                <TableHead>বরাদ্দ (ইনভয়েস → পরিমাণ)</TableHead>
                <TableHead className="text-right">অবশিষ্ট</TableHead>
                <TableHead>সমস্যা</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.idx} className={r.status === "invalid" || r.status === "error" ? "bg-destructive/10" : ""}>
                  <TableCell>{r.idx + 1}</TableCell>
                  <TableCell>
                    {r.status === "saved" && <Badge>সংরক্ষিত</Badge>}
                    {r.status === "saving" && <Badge variant="secondary"><Loader2 className="h-3 w-3 animate-spin mr-1" />…</Badge>}
                    {r.status === "valid" && <Badge variant="secondary">প্রস্তুত</Badge>}
                    {r.status === "invalid" && <Badge variant="destructive">ত্রুটি</Badge>}
                    {r.status === "error" && <Badge variant="destructive">ব্যর্থ</Badge>}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{String(r.raw.account_number ?? "")}</TableCell>
                  <TableCell className="font-mono text-xs">{String(r.raw.dag_no ?? "")}</TableCell>
                  <TableCell className="text-right">৳{r.amount}</TableCell>
                  <TableCell className="text-xs">
                    {r.allocs.length === 0 ? "—" : (
                      <div className="space-y-0.5">
                        {r.allocs.map((a, k) => (
                          <div key={k} className="flex flex-wrap gap-1 items-center">
                            <span className="font-mono">{a.invoiceNo}</span>
                            <span className="text-muted-foreground">বকেয়া ৳{a.dueBefore}</span>
                            <span className="font-medium">→ ৳{a.take}</span>
                            <span className="text-muted-foreground">(পরে ৳{a.dueAfter})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.unallocated > 0.009 ? <span className="text-amber-600">৳{r.unallocated}</span> : "৳0"}
                  </TableCell>
                  <TableCell className="text-xs max-w-[240px]">
                    {r.errorMsg && <span className="text-destructive">{r.errorMsg}</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
