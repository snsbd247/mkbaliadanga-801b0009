import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import { useAuth } from "@/auth/AuthProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Upload, Download, AlertTriangle, Loader2 } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { toast } from "sonner";
import { decodeSpreadsheetBuffer } from "@/lib/csvDecode";
import { normalizeFarmerCode } from "@/lib/farmerCode";

/**
 * Bulk Farmer Import — simplified
 *
 * Columns (case-insensitive):
 *   farmer_id     (optional) — যদি দেয়া হয় ও already exist করে, এটি UPDATE হবে; না দিলে INSERT।
 *   is_voter      (optional) — true হলে Farmer ID-ই voter / savings account number হবে।
 *   name_en       (required)
 *   name_bn       (optional)
 *   father_name   (optional)
 *   mobile        (optional)
 *   village       (optional, free-text)
 *
 * File: .csv বা .xlsx
 */

type Cell = string | number | null;
type RowMap = Record<string, Cell>;

type RowState = {
  idx: number;
  raw: RowMap;
  status: "pending" | "valid" | "invalid" | "saving" | "saved" | "error";
  errorMsg: string | null;
  warnMsg: string | null;
  action: "insert" | "update" | null;
};

// Nominee field validation — returns non-blocking warnings with clear Bengali messages.
function validateNominee(raw: RowMap): string[] {
  const warnings: string[] = [];
  const val = (k: string) => String(raw[k] ?? "").trim();
  const name = val("nominee_name");
  const mobile = val("nominee_mobile");
  const nid = val("nominee_nid");
  const relation = val("nominee_relation");
  const address = val("nominee_address");
  const anyNominee = name || mobile || nid || relation || address;
  if (!anyNominee) return warnings; // nominee optional — nothing filled, no warning

  if (!name) warnings.push("নমিনির তথ্য আছে কিন্তু নমিনির নাম খালি");
  if (mobile && !/^01[3-9]\d{8}$/.test(mobile))
    warnings.push(`নমিনির মোবাইল সঠিক নয় (১১-ডিজিট 01XXXXXXXXX হতে হবে): ${mobile}`);
  if (nid && !/^\d{10,17}$/.test(nid.replace(/\s/g, "")))
    warnings.push(`নমিনির NID সঠিক নয় (১০-১৭ ডিজিট): ${nid}`);
  if (name && !relation)
    warnings.push("নমিনির সম্পর্ক (relation) খালি");
  return warnings;
}

const COLUMNS = [
  "farmer_id", "account_number", "is_voter", "voter_number", "name_en", "name_bn",
  "father_name", "mother_name", "nid", "mobile",
  "village", "post_office", "upazila", "district", "division", "address", "mouza", "union",
  "status", "savings_inactive", "photo_url",
  "nominee_name", "nominee_mobile", "nominee_relation", "nominee_nid", "nominee_address",
] as const;

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

function normalizeKey(k: string) {
  return k.trim().toLowerCase().replace(/\s+/g, "_");
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

export default function FarmersImport() {
  const { t, tx } = useLang();
  const { isAdmin, officeId, rolesLoaded } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<RowState[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  useEffect(() => {
    document.title = `Bulk Farmer Import — ${t("appName")}`;
  }, [t]);

  function downloadTemplate(format: "xlsx" | "csv") {
    const headers = [...COLUMNS];
    const sample = [
      ["00001", "10001", "true", "10001", "Md. Abdur Rahman", "মোঃ আব্দুর রহমান", "Md. Karim Uddin", "Mst. Rahima", "1234567890", "01711000000", "Bagbari", "Baliadanga", "Sadar", "Tangail", "Dhaka", "গ্রামঃ বাগবাড়ী, ডাকঘরঃ বালিয়াডাঙ্গা", "Mouza A", "Baliadanga", "active", "false", "", "Md. Sabuj", "01911000000", "Son", "1234567890123", "Bagbari, Baliadanga"],
      ["",      "10002", "false", "", "Mst. Rahima Khatun", "মোসাঃ রহিমা খাতুন", "Md. Jashim", "Mst. Hasna", "9876543210", "01811000000", "Char Bhabanipur", "Baliadanga", "Sadar", "Tangail", "Dhaka", "", "", "", "active", "false", "", "", "", "", "", ""],
    ];
    if (format === "csv") {
      const csv = [headers, ...sample]
        .map((r) => r.map((v) => /[",\n]/.test(String(v ?? "")) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? "")).join(","))
        .join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "farmer-import-template.csv"; a.click();
      URL.revokeObjectURL(url);
      return;
    }
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sample]);
    const notes = XLSX.utils.aoa_to_sheet([
      ["Column", "Required", "Notes"],
      ["farmer_id", "No", "৫-ডিজিট padded কোড (যেমন 00001)। 'F-00001', '1', '2026-00000001' এর মতো ইনপুট স্বয়ংক্রিয়ভাবে 00001 হবে। existing হলে UPDATE, খালি হলে নতুন তৈরি হবে।"],
      ["account_number", "No", "হিসাব নম্বর (সঞ্চয়/শেয়ার অ্যাকাউন্ট)"],
      ["is_voter", "No", "true/হ্যাঁ/1 হলে voter/savings নম্বর আলাদা নয় — Farmer ID-ই ব্যবহৃত হবে।"],
      ["voter_number", "No", "ভোটার/সদস্য নম্বর (থাকলে is_voter স্বয়ংক্রিয়ভাবে true)"],
      ["name_en", "Yes", "ইংরেজী নাম (আবশ্যক)"],
      ["name_bn", "No", "বাংলা নাম"],
      ["father_name", "No", "পিতার নাম"],
      ["mother_name", "No", "মাতার নাম"],
      ["nid", "No", "জাতীয় পরিচয়পত্র নম্বর (শুধু সংখ্যা)"],
      ["mobile", "No", "১১-ডিজিট BD নম্বর, যেমন 017XXXXXXXX"],
      ["village", "No", "Free-text গ্রাম"],
      ["post_office", "No", "ডাকঘর"],
      ["upazila", "No", "উপজেলা"],
      ["district", "No", "জেলা"],
      ["division", "No", "বিভাগ"],
      ["address", "No", "সম্পূর্ণ ঠিকানা (free-text)"],
      ["mouza", "No", "মৌজার নাম — থাকলে mouza_id রিসলভ হবে"],
      ["union", "No", "ইউনিয়নের নাম — থাকলে union_id রিসলভ হবে"],
      ["status", "No", "active/inactive (ডিফল্ট active)"],
      ["savings_inactive", "No", "true হলে সঞ্চয় নিষ্ক্রিয়"],
      ["photo_url", "No", "ছবির URL"],
      ["nominee_name", "No", "নমিনির নাম"],
      ["nominee_mobile", "No", "নমিনির মোবাইল"],
      ["nominee_relation", "No", "নমিনির সম্পর্ক (যেমন: ছেলে, স্ত্রী)"],
      ["nominee_nid", "No", "নমিনির জাতীয় পরিচয়পত্র নম্বর"],
      ["nominee_address", "No", "নমিনির ঠিকানা"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Farmers");
    XLSX.utils.book_append_sheet(wb, notes, "Instructions");
    XLSX.writeFile(wb, "farmer-import-template.xlsx");
  }

  async function handleFile(f: File | null) {
    if (!f) return;
    try {
      const wb = await readBookFromFile(f);
      const parsed = parseSheet(wb);
      if (parsed.length === 0) { toast.error("File is empty."); return; }
      // Count member-no occurrences within this file to catch in-file duplicates
      const idCounts: Record<string, number> = {};
      parsed.forEach((raw) => {
        const idRaw = String(raw.farmer_id ?? raw.member_no ?? "").trim();
        if (!idRaw) return;
        const r = normalizeFarmerCode(idRaw);
        const key = r.ok === false ? idRaw : r.value;
        idCounts[key] = (idCounts[key] ?? 0) + 1;
      });
      const initial: RowState[] = parsed.map((raw, idx) => {
        const nameEn = String(raw.name_en ?? "").trim();
        const farmerIdRaw = String(raw.farmer_id ?? raw.member_no ?? "").trim();
        let farmerIdErr: string | null = null;
        let normalizedId: string | null = null;
        if (farmerIdRaw) {
          const r = normalizeFarmerCode(farmerIdRaw);
          if (r.ok === false) farmerIdErr = r.error;
          else { raw.farmer_id = r.value; normalizedId = r.value; } // canonicalize in-place for the save loop
        }
        if (!farmerIdErr && normalizedId && idCounts[normalizedId] > 1) {
          farmerIdErr = `Duplicate member no in file: ${normalizedId}`;
        }
        const errorMsg = !nameEn ? "name_en is required" : farmerIdErr;
        const warnings = validateNominee(raw);
        return {
          idx,
          raw,
          status: errorMsg ? "invalid" : "valid",
          errorMsg,
          warnMsg: warnings.length ? warnings.join("; ") : null,
          action: farmerIdRaw && !farmerIdErr ? "update" : "insert",
        };
      });
      setRows(initial);
      setSavedCount(0);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to read file");
    }
  }

  const validRows = useMemo(() => rows.filter((r) => r.status === "valid"), [rows]);
  const invalidRows = useMemo(() => rows.filter((r) => r.status === "invalid"), [rows]);
  const warnRows = useMemo(() => rows.filter((r) => r.warnMsg), [rows]);

  async function importValid() {
    if (validRows.length === 0) { toast.error("No valid rows to import."); return; }
    setSaving(true);
    let saved = 0;
    const updated = [...rows];

    // Prefetch mouza/union name → id maps for geo resolution
    const mouzaMap = new Map<string, string>();
    const unionMap = new Map<string, string>();
    try {
      const [{ data: mz }, { data: un }] = await Promise.all([
        db.from("mouzas").select("id,name,name_bn"),
        db.from("unions").select("id,name,name_bn"),
      ]);
      (mz ?? []).forEach((m: any) => {
        if (m.name) mouzaMap.set(String(m.name).trim().toLowerCase(), m.id);
        if (m.name_bn) mouzaMap.set(String(m.name_bn).trim().toLowerCase(), m.id);
      });
      (un ?? []).forEach((u: any) => {
        if (u.name) unionMap.set(String(u.name).trim().toLowerCase(), u.id);
        if (u.name_bn) unionMap.set(String(u.name_bn).trim().toLowerCase(), u.id);
      });
    } catch { /* geo resolution optional */ }

    for (const r of validRows) {
      const i = updated.findIndex((x) => x.idx === r.idx);
      updated[i] = { ...updated[i], status: "saving", errorMsg: null };
      setRows([...updated]);

      const farmerId = String(r.raw.farmer_id ?? r.raw.member_no ?? "").trim();
      const hasVoterInput = (r.raw.is_voter != null && String(r.raw.is_voter).trim() !== "") || !!String(r.raw.voter_number ?? "").trim();
      const rawVoter = String(r.raw.is_voter ?? r.raw.voter_number ?? "").trim().toLowerCase();
      const isVoter = ["1", "true", "yes", "y", "হ্যাঁ"].includes(rawVoter) || !!String(r.raw.voter_number ?? "").trim();

      const str = (v: any) => (v != null && String(v).trim() !== "" ? String(v).trim() : null);
      const boolVal = (v: any) => ["1", "true", "yes", "y", "হ্যাঁ"].includes(String(v ?? "").trim().toLowerCase());
      const mouzaId = r.raw.mouza ? mouzaMap.get(String(r.raw.mouza).trim().toLowerCase()) ?? null : null;
      const unionId = r.raw.union ? unionMap.get(String(r.raw.union).trim().toLowerCase()) ?? null : null;
      const basePayload: any = {
        name_en:          String(r.raw.name_en ?? "").trim(),
        name_bn:          str(r.raw.name_bn),
        father_name:      str(r.raw.father_name),
        mother_name:      str(r.raw.mother_name),
        nid:              str(r.raw.nid),
        mobile:           str(r.raw.mobile),
        village:          str(r.raw.village),
        post_office:      str(r.raw.post_office),
        upazila:          str(r.raw.upazila),
        district:         str(r.raw.district),
        division:         str(r.raw.division),
        address:          str(r.raw.address),
        account_number:   str(r.raw.account_number),
        voter_number:     str(r.raw.voter_number),
        photo_url:        str(r.raw.photo_url),
        status:           str(r.raw.status),
        mouza_id:         mouzaId,
        union_id:         unionId,
        nominee_name:     str(r.raw.nominee_name),
        nominee_mobile:   str(r.raw.nominee_mobile),
        nominee_relation: str(r.raw.nominee_relation),
        nominee_nid:      str(r.raw.nominee_nid),
        nominee_address:  str(r.raw.nominee_address),
        ...(hasVoterInput ? { is_voter: isVoter } : {}),
        ...(String(r.raw.savings_inactive ?? "").trim() !== "" ? { savings_inactive: boolVal(r.raw.savings_inactive) } : {}),
      };
      // Drop null-valued keys so an UPDATE never wipes existing data with blanks
      Object.keys(basePayload).forEach((k) => {
        if (basePayload[k] === null) delete basePayload[k];
      });

      try {
        if (farmerId) {
          // Find existing farmer by member_no
          const { data: existing } = await db
            .from("farmers")
            .select("id")
            .eq("member_no", farmerId)
            .maybeSingle();
          if (existing?.id) {
            const { error } = await db.from("farmers").update(basePayload).eq("id", existing.id);
            if (error) throw error;
          } else {
            const { error } = await db
              .from("farmers")
              .insert({ ...basePayload, member_no: farmerId, farmer_code: farmerId, office_id: officeId ?? null });
            if (error) throw error;
          }
        } else {
          const { error } = await db
            .from("farmers")
            .insert({ ...basePayload, office_id: officeId ?? null });
          if (error) throw error;
        }
        updated[i] = { ...updated[i], status: "saved" };
        saved++;
      } catch (e: any) {
        updated[i] = { ...updated[i], status: "error", errorMsg: e?.message ?? "Save failed" };
      }
      setRows([...updated]);
    }

    setSaving(false);
    setSavedCount(saved);
    if (saved > 0) toast.success(`Imported ${saved} farmer${saved === 1 ? "" : "s"}.`);
  }

  if (rolesLoaded && !isAdmin) {
    return (
      <Card className="p-6 m-4">
        <p className="text-muted-foreground">You don't have permission to import farmers.</p>
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        title="Bulk Farmer Import"
        description={tx("Upload a .csv or .xlsx file. If voter_number is set, the farmer auto-becomes a Voter / Savings active member.", ".csv বা .xlsx ফাইল আপলোড করুন। voter_number থাকলে farmer অটো Voter / Savings active সদস্য হবে।")}
      />

      <Card className="p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[260px]">
            <Label>File (.csv or .xlsx)</Label>
            <Input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls,.txt,.tsv"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button variant="outline" onClick={() => downloadTemplate("xlsx")}>
            <Download className="h-4 w-4 mr-1" /> XLSX Template
          </Button>
          <Button variant="outline" onClick={() => downloadTemplate("csv")}>
            <Download className="h-4 w-4 mr-1" /> CSV Template
          </Button>
          <Button onClick={importValid} disabled={validRows.length === 0 || saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
            Import {validRows.length} valid row{validRows.length === 1 ? "" : "s"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Required: <code>name_en</code>. Optional: <code>farmer_id, voter_number, name_bn, father_name, mobile, village</code>.
          <br />
          <span
            title={tx(
              "Farmer ID format: 5-digit padded number (e.g. 00001). Inputs like 'F-00001', '1', '2026-00000001' are auto-normalized to 00001. Letters or non-numeric values are rejected.",
              "Farmer ID ফরম্যাট: 5-digit padded (যেমন 00001)। 'F-00001', '1', '2026-00000001' এর মতো ইনপুট স্বয়ংক্রিয়ভাবে 00001 হবে। অক্ষর / সংখ্যা ছাড়া ভ্যালু রিজেক্ট হবে।"
            )}
            className="inline-flex h-4 w-4 mr-1 items-center justify-center rounded-full border text-[10px] cursor-help"
          >?</span>
          {tx("If farmer_id is given, existing farmer is updated, else a new one is created.", "farmer_id দিলে existing farmer থাকলে update, না থাকলে নতুন তৈরি হবে।")}
          <span className="ml-2">{tx("If voter_number is given, auto Voter / Savings active member.", "voter_number দিলে অটো Voter / Savings active সদস্য।")}</span>
        </p>
      </Card>

      {rows.length > 0 && (
        <Card className="p-3 mb-3">
          <div className="flex flex-wrap gap-3 text-sm">
            <Badge variant="default">Total: {rows.length}</Badge>
            <Badge variant="secondary">Valid: {validRows.length}</Badge>
            <Badge variant="destructive">Invalid: {invalidRows.length}</Badge>
            {warnRows.length > 0 && <Badge className="bg-amber-500 text-white hover:bg-amber-500">নমিনি সতর্কতা: {warnRows.length}</Badge>}
            {savedCount > 0 && <Badge>Saved: {savedCount}</Badge>}
          </div>
        </Card>
      )}

      {invalidRows.length > 0 && (
        <Alert variant="destructive" className="mb-3" role="alert" aria-live="polite">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{invalidRows.length} row(s) skipped</AlertTitle>
          <AlertDescription>
            {tx("Only rows containing name_en will be imported.", "শুধু যেসব row-তে name_en আছে সেগুলোই import হবে।")}
          </AlertDescription>
        </Alert>
      )}

      {rows.length > 0 && (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("action")}</TableHead>
                <TableHead>{t("farmerIdCol")}</TableHead>
                <TableHead>{t("voterNo")}</TableHead>
                <TableHead>{t("name")} (EN)</TableHead>
                <TableHead>{t("name")} (BN)</TableHead>
                <TableHead>{t("fatherName")}</TableHead>
                <TableHead>{t("mobile")}</TableHead>
                <TableHead>{t("village")}</TableHead>
                <TableHead>নমিনি নাম</TableHead>
                <TableHead>নমিনি মোবাইল</TableHead>
                <TableHead>নমিনি সম্পর্ক</TableHead>
                <TableHead>নমিনি NID</TableHead>
                <TableHead>নমিনি ঠিকানা</TableHead>
                <TableHead>{t("issueCol")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.idx} className={r.status === "invalid" || r.status === "error" ? "bg-destructive/10" : ""}>
                  <TableCell>{r.idx + 1}</TableCell>
                  <TableCell>
                    {r.status === "saved" && <Badge variant="default">{t("saved")}</Badge>}
                    {r.status === "saving" && <Badge variant="secondary"><Loader2 className="h-3 w-3 animate-spin mr-1" />{t("loading")}</Badge>}
                    {r.status === "valid" && <Badge variant="secondary">{t("readyBadge")}</Badge>}
                    {r.status === "invalid" && <Badge variant="destructive">{t("invalidBadge")}</Badge>}
                    {r.status === "error" && <Badge variant="destructive">{t("errorBadge")}</Badge>}
                    {r.status === "pending" && <Badge variant="outline">{t("pending")}</Badge>}
                  </TableCell>
                  <TableCell>{r.action === "update" ? <Badge variant="outline">{t("update")}</Badge> : <Badge variant="outline">{t("insertAction")}</Badge>}</TableCell>
                  <TableCell className="font-mono text-xs">{String(r.raw.farmer_id ?? r.raw.member_no ?? "")}</TableCell>
                  <TableCell className="font-mono text-xs">{String(r.raw.voter_number ?? "")}</TableCell>
                  <TableCell>{String(r.raw.name_en ?? "")}</TableCell>
                  <TableCell>{String(r.raw.name_bn ?? "")}</TableCell>
                  <TableCell>{String(r.raw.father_name ?? "")}</TableCell>
                  <TableCell>{String(r.raw.mobile ?? "")}</TableCell>
                  <TableCell>{String(r.raw.village ?? "")}</TableCell>
                  <TableCell>{String(r.raw.nominee_name ?? "")}</TableCell>
                  <TableCell className="font-mono text-xs">{String(r.raw.nominee_mobile ?? "")}</TableCell>
                  <TableCell>{String(r.raw.nominee_relation ?? "")}</TableCell>
                  <TableCell className="font-mono text-xs">{String(r.raw.nominee_nid ?? "")}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{String(r.raw.nominee_address ?? "")}</TableCell>
                  <TableCell className="text-xs max-w-[300px]">
                    {r.errorMsg && <span className="text-destructive">{r.errorMsg}</span>}
                    {r.warnMsg && <span className="block text-amber-600">⚠ {r.warnMsg}</span>}
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
