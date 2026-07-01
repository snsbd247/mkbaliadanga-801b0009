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
import { splitBillableArea } from "@/lib/irrigationBargaSplit";

/**
 * Irrigation invoice import — one CSV row per land/dag/season becomes one or
 * more invoices: the owner + each active sharecropper (barga) is billed
 * separately, prorated by their billed area (splitBillableArea). Canal &
 * maintenance charges are stored but excluded from the payable amount.
 */

type Cell = string | number | null;
type RowMap = Record<string, Cell>;

type PreviewInvoice = {
  billedCode: string;
  billedName: string;
  isBorga: boolean;
  area: number;
  irrigationAmount: number;
  canalAmount: number;
  maintenanceAmount: number;
  otherCharge: number;
  penalty: number;
  previousDue: number;
  payable: number;
  billedFarmerId: string;
};

type RowState = {
  idx: number;
  raw: RowMap;
  status: "pending" | "valid" | "invalid" | "saving" | "saved" | "error";
  errorMsg: string | null;
  landId?: string;
  ownerId?: string;
  preview: PreviewInvoice[];
};

const COLUMNS = [
  "account_number", "dag_no", "base_charge", "canal_charge",
  "maintenance_charge", "other_charge", "previous_due_brought", "penalty_amount", "note",
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

export default function IrrigationInvoiceImport() {
  const { officeId } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<RowState[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [seasonId, setSeasonId] = useState<string>("");

  // Lookup maps built when a file is parsed.
  const [farmerMap, setFarmerMap] = useState<Map<string, string>>(new Map());
  const [farmerNameById, setFarmerNameById] = useState<Map<string, string>>(new Map());
  const [landByOwnerDag, setLandByOwnerDag] = useState<Map<string, { id: string; area: number }>>(new Map());
  const [relsByLand, setRelsByLand] = useState<Map<string, any[]>>(new Map());

  useEffect(() => {
    document.title = "সেচ ইনভয়েস ইমপোর্ট — Irrigation Invoice Import";
    db.from("seasons").select("id,name,year,due_date").then(({ data }) => setSeasons(data ?? []));
  }, []);

  async function loadLookups() {
    const [{ data: fm }, { data: ld }, { data: rel }] = await Promise.all([
      db.from("farmers").select("id,farmer_code,name"),
      db.from("lands").select("id,owner_farmer_id,dag_no,dag_numbers,area_decimal"),
      db.from("land_relations").select("land_id,owner_farmer_id,sharecropper_farmer_id,area_decimal,share_percentage"),
    ]);
    const fMap = new Map<string, string>();
    const nMap = new Map<string, string>();
    (fm ?? []).forEach((f: any) => {
      if (f.farmer_code) fMap.set(String(f.farmer_code).trim(), f.id);
      nMap.set(f.id, f.name ?? String(f.farmer_code ?? ""));
    });
    const lMap = new Map<string, { id: string; area: number }>();
    (ld ?? []).forEach((l: any) => {
      const dags: string[] = [];
      if (l.dag_no) dags.push(String(l.dag_no).trim());
      if (Array.isArray(l.dag_numbers)) l.dag_numbers.forEach((d: any) => dags.push(String(d).trim()));
      dags.filter(Boolean).forEach((d) => lMap.set(`${l.owner_farmer_id}|${d}`, { id: l.id, area: num(l.area_decimal) }));
    });
    const rMap = new Map<string, any[]>();
    (rel ?? []).forEach((r: any) => {
      const arr = rMap.get(r.land_id) ?? [];
      arr.push(r);
      rMap.set(r.land_id, arr);
    });
    setFarmerMap(fMap); setFarmerNameById(nMap); setLandByOwnerDag(lMap); setRelsByLand(rMap);
    return { fMap, nMap, lMap, rMap };
  }

  function buildPreview(
    raw: RowMap,
    ownerId: string,
    land: { id: string; area: number },
    rels: any[],
    nMap: Map<string, string>,
    fMap: Map<string, string>,
  ): PreviewInvoice[] {
    const totalArea = land.area > 0 ? land.area : 0;
    const relations = rels.map((r) => ({
      sharecropper_farmer_id: r.sharecropper_farmer_id,
      area_decimal: r.area_decimal,
      share_percentage: r.share_percentage,
    }));
    const split = splitBillableArea({ owner_farmer_id: ownerId, parcel_area: totalArea, relations });

    const base = num(raw.base_charge);
    const canal = num(raw.canal_charge);
    const maint = num(raw.maintenance_charge);
    const other = num(raw.other_charge);
    const penalty = num(raw.penalty_amount);
    const prevDue = num(raw.previous_due_brought);
    const denom = totalArea > 0 ? totalArea : split.reduce((s, r) => s + r.billed_area, 0) || 1;

    // Reverse code lookup for names.
    const codeById = new Map<string, string>();
    for (const [code, id] of fMap.entries()) codeById.set(id, code);

    return split.map((s) => {
      const frac = s.billed_area / denom;
      const irrigationAmount = round2(base * frac);
      const canalAmount = round2(canal * frac);
      const maintenanceAmount = round2(maint * frac);
      const otherCharge = round2(other * frac);
      const pen = round2(penalty * frac);
      const pd = round2(prevDue * frac);
      const payable = round2(irrigationAmount + otherCharge + pen + pd);
      return {
        billedFarmerId: s.billed_farmer_id,
        billedCode: codeById.get(s.billed_farmer_id) ?? "",
        billedName: nMap.get(s.billed_farmer_id) ?? "",
        isBorga: s.is_borga,
        area: round2(s.billed_area),
        irrigationAmount, canalAmount, maintenanceAmount, otherCharge,
        penalty: pen, previousDue: pd, payable,
      };
    });
  }

  async function handleFile(f: File | null) {
    if (!f) return;
    try {
      const wb = await readBookFromFile(f);
      const parsed = parseSheet(wb);
      if (parsed.length === 0) { toast.error("ফাইল খালি।"); return; }
      const { fMap, nMap, lMap, rMap } = await loadLookups();

      const initial: RowState[] = parsed.map((raw, idx) => {
        const errors: string[] = [];
        let ownerId: string | undefined;
        let land: { id: string; area: number } | undefined;
        const ownerRaw = String(raw.account_number ?? "").trim();
        if (!ownerRaw) errors.push("account_number আবশ্যক");
        else {
          const r = normalizeFarmerCode(ownerRaw);
          if (r.ok === false) errors.push(`মালিকের ID সঠিক নয়: ${ownerRaw}`);
          else { raw.account_number = r.value; ownerId = fMap.get(r.value); if (!ownerId) errors.push(`মালিক পাওয়া যায়নি (${r.value})`); }
        }
        const dag = String(raw.dag_no ?? "").trim();
        if (!dag) errors.push("dag_no আবশ্যক");
        if (ownerId && dag) {
          land = lMap.get(`${ownerId}|${dag}`);
          if (!land) errors.push(`জমি পাওয়া যায়নি (মালিক ${ownerRaw}, দাগ ${dag})`);
        }
        if (num(raw.base_charge) <= 0 && num(raw.other_charge) <= 0 && num(raw.previous_due_brought) <= 0)
          errors.push("base_charge/other_charge/previous_due_brought কোনো একটি > ০ হতে হবে");

        const preview = (ownerId && land && !errors.length)
          ? buildPreview(raw, ownerId, land, rMap.get(land.id) ?? [], nMap, fMap)
          : [];

        return {
          idx, raw,
          status: errors.length ? "invalid" : "valid",
          errorMsg: errors.length ? errors.join("; ") : null,
          ownerId, landId: land?.id, preview,
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
  const totalInvoices = useMemo(() => validRows.reduce((s, r) => s + r.preview.length, 0), [validRows]);

  async function importValid() {
    if (!seasonId) { toast.error("আগে সিজন নির্বাচন করুন"); return; }
    if (validRows.length === 0) { toast.error("ইমপোর্ট করার মতো সঠিক সারি নেই।"); return; }
    setSaving(true);
    let inserted = 0, failed = 0;
    const updated = [...rows];
    const season = seasons.find((s) => s.id === seasonId);
    const dueDate = season?.due_date ?? new Date().toISOString().slice(0, 10);
    const stamp = Date.now().toString(36).toUpperCase();
    let seq = 0;

    for (const r of validRows) {
      const i = updated.findIndex((x) => x.idx === r.idx);
      updated[i] = { ...updated[i], status: "saving", errorMsg: null };
      setRows([...updated]);
      try {
        if (!r.landId || !r.ownerId) throw new Error("জমি/মালিক রেজলভ হয়নি");
        for (const inv of r.preview) {
          seq += 1;
          const invoiceNo = `IMP-${stamp}-${String(seq).padStart(4, "0")}`;
          const payload: any = {
            invoice_no: invoiceNo,
            office_id: officeId ?? null,
            season_id: seasonId,
            land_id: r.landId,
            owner_farmer_id: r.ownerId,
            farmer_id: inv.billedFarmerId,
            is_borga: inv.isBorga,
            irrigation_amount: inv.irrigationAmount,
            maintenance_amount: inv.maintenanceAmount,
            canal_amount: inv.canalAmount,
            other_charge: inv.otherCharge,
            delay_fee: inv.penalty,
            payable_amount: inv.payable,
            paid_amount: 0,
            due_amount: inv.payable,
            previous_due_amount: inv.previousDue,
            due_date: dueDate,
            invoice_status: "generated",
            note: r.raw.note ? String(r.raw.note) : null,
          };
          const { error } = await db.from("irrigation_invoices").insert(payload);
          if (error) throw new Error(error.message);
          inserted++;
        }
        updated[i] = { ...updated[i], status: "saved", errorMsg: null };
      } catch (e: any) {
        updated[i] = { ...updated[i], status: "error", errorMsg: e?.message ?? "ত্রুটি" };
        failed++;
      }
      setRows([...updated]);
    }

    setSavedCount(inserted);
    setSaving(false);

    try {
      await db.from("import_audit_logs").insert({
        office_id: officeId ?? null,
        module: "irrigation_invoices",
        mode: "insert",
        rows_processed: validRows.length,
        rows_inserted: inserted,
        rows_updated: 0,
        rows_failed: failed,
        summary: { season_id: seasonId, source: "IrrigationInvoiceImport" },
      });
    } catch { /* best-effort */ }

    if (failed === 0) toast.success(`${inserted} টি ইনভয়েস ইমপোর্ট হয়েছে`);
    else toast.warning(`${inserted} টি সফল, ${failed} টি সারি ব্যর্থ`);
  }

  return (
    <>
      <PageHeader title="সেচ ইনভয়েস ইমপোর্ট" description="প্রতি জমি/দাগ অনুযায়ী সেচ চার্জ আপলোড করুন — মালিক ও বর্গাদারের নামে আলাদা ইনভয়েস স্বয়ংক্রিয় তৈরি হবে" />

      <Card className="p-4 space-y-4">
        <div className="max-w-xs">
          <Label className="mb-1 block">সিজন</Label>
          <Select value={seasonId} onValueChange={setSeasonId}>
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
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
          <Button onClick={() => fileRef.current?.click()} variant="default">
            <Upload className="h-4 w-4 mr-2" /> ফাইল নির্বাচন করুন
          </Button>
          <Button onClick={() => downloadCsvTemplate("irrigation")} variant="outline">
            <Download className="h-4 w-4 mr-2" /> টেমপ্লেট (CSV)
          </Button>
          {validRows.length > 0 && (
            <Button onClick={importValid} disabled={saving || !seasonId} className="ml-auto">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {totalInvoices} টি ইনভয়েস ইমপোর্ট করুন
            </Button>
          )}
        </div>

        {rows.length > 0 && (
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="secondary">মোট সারি: {rows.length}</Badge>
            <Badge variant="default">প্রস্তুত: {validRows.length}</Badge>
            <Badge variant="secondary"><Eye className="h-3 w-3 mr-1" />ইনভয়েস তৈরি হবে: {totalInvoices}</Badge>
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
      </Card>

      {rows.length > 0 && (
        <Card className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>অবস্থা</TableHead>
                <TableHead>মালিক ID</TableHead>
                <TableHead>দাগ</TableHead>
                <TableHead>বিলযোগ্য (মালিক + বর্গাদার)</TableHead>
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
                  <TableCell className="text-xs">
                    {r.preview.length === 0 ? "—" : (
                      <div className="space-y-0.5">
                        {r.preview.map((p, k) => (
                          <div key={k} className="flex flex-wrap gap-1 items-center">
                            <Badge variant={p.isBorga ? "outline" : "secondary"} className="text-[10px]">
                              {p.isBorga ? "বর্গা" : "মালিক"}
                            </Badge>
                            <span className="font-mono">{p.billedCode}</span>
                            <span className="text-muted-foreground">{p.billedName}</span>
                            <span>· {p.area} শতক</span>
                            <span className="font-medium">· ৳{p.payable}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs max-w-[260px]">
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
