import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuCheckboxItem, DropdownMenuSeparator, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Printer, FileDown, Receipt, Pencil, Trash2, FileSpreadsheet, FileText, IdCard } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { money, money2, fmtDate } from "@/lib/format";
import { toBool } from "@/lib/bool";
import { computeIrrigationDue } from "@/lib/dues";
import { computeInvoiceDue } from "@/lib/irrigationDue";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { useNavigate } from "react-router-dom";

import { LocationPicker, type LocationValue } from "@/components/locations/LocationPicker";
import { parseLocationDbError, type LocationLevel } from "@/lib/locationValidation";
import { validateDagNumbers, findDuplicateDagInMouza, normalizeDagInput } from "@/lib/dagNumbers";
import { MouzaSelect } from "@/components/locations/MouzaSelect";
import { SavingsStatement } from "@/components/SavingsStatement";
import { EditButton, DeleteButton } from "@/components/ui/action-icon-button";
import { downloadBnReceiptPdf, normalizeIrrigationRatePerAcre, type BnReceiptData } from "@/lib/bnReceipts";
import { autoReceiptNo } from "@/lib/receiptNo";
import { calcInvoice, getChargeSettings } from "@/lib/irrigationInvoice";
import { ReceiptCopyMenu } from "@/components/receipts/ReceiptCopyMenu";
import { ReceiptSettingsButton } from "@/components/receipts/ReceiptSettingsButton";
import IrrigationInvoicesTab from "@/components/farmers/IrrigationInvoicesTab";
import FarmerLandHistoryTab from "@/components/farmers/FarmerLandHistoryTab";
import FarmerNotesTab from "@/components/farmers/FarmerNotesTab";
import OwnLandsTab from "@/components/farmers/OwnLandsTab";
import LandTransferDialog from "@/components/farmers/LandTransferDialog";
import LandTransferHistoryTab from "@/components/farmers/LandTransferHistoryTab";
import { useReceiptRenderArgs } from "@/lib/receiptOptions";
import { useBranding } from "@/lib/branding";
import { exportLandsPdf, exportLandsExcel, type LandExportRow } from "@/lib/landExport";
import { useAuth } from "@/auth/AuthProvider";
import { exportPaymentReceiptPDF } from "@/lib/exports";
import { FarmerSearchSelect } from "@/components/farmers/FarmerSearchSelect";
import { formatId5 } from "@/lib/idFormat";
import { loadSeasonRateMap, resolveRateForLand, type RateRow } from "@/lib/seasonRates";
import { toFarmerUpdatePayload } from "@/lib/farmerUpdateMapper";

import { LoanStatement } from "@/components/LoanStatement";
import { downloadIrrigationInvoicePdf, loadInvoiceSettings } from "@/lib/irrigationInvoicePdf";
import { ReceiptPreviewModal } from "@/components/irrigation/ReceiptPreviewModal";
import { buildPaidHistory, type PaidHistoryRow } from "@/lib/irrigationReceiptHistory";
import { formatLand, parseLandInput, normalizeLandSize } from "@/lib/landMath";
import { LandAmountBreakdown } from "@/components/LandAmountBreakdown";
import { LandNoteCell } from "@/components/farmers/LandNoteCell";
import { Textarea } from "@/components/ui/textarea";
import { LandTypeSelect, useLandTypes, landTypeLabel } from "@/components/locations/LandTypeSelect";

type LandRow = LandExportRow & { id: string; mouza_id?: string | null; ward_id?: string | null; owner_farmer_id?: string | null; land_type_id?: string | null };

const EMPTY_LAND = { dag_no: "", land_size: 0, owner_type: "owner", field_type: "medium_land", land_type_id: "" as string, owner_farmer_id: "" as string | "", owner_land_id: "" as string, patwari_id: "" as string | "", notes: "" };

// Show land size exactly as entered (up to 3 decimals) via the shared utility.
const fmtLand = (v: any) => formatLand(v);

function pickCurrentSeason(seasons: any[]) {
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const active = seasons.filter((s: any) => s.status === "active");

  return active.find((s: any) => {
    const start = s.start_date ? String(s.start_date).slice(0, 10) : null;
    const end = s.end_date ? String(s.end_date).slice(0, 10) : null;
    return (!start || start <= todayKey) && (!end || end >= todayKey);
  }) ?? active.find((s: any) => {
    const start = s.start_date ? String(s.start_date).slice(0, 10) : null;
    return !start || start <= todayKey;
  }) ?? active[0] ?? seasons[0] ?? null;
}

export default function FarmerDetail() {
  const { id } = useParams<{ id: string }>();
  const { t, lang, tx } = useLang();
  const { isSuper } = useAuth();
  const nav = useNavigate();
  const [farmer, setFarmer] = useState<any>(null);
  const [lands, setLands] = useState<LandRow[]>([]);
  const [ownerNames, setOwnerNames] = useState<Record<string, string>>({});
  const [landNotes, setLandNotes] = useState<Record<string, string[]>>({});
  const [landSelfNotes, setLandSelfNotes] = useState<Record<string, string>>({});
  const [savings, setSavings] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [viewLoan, setViewLoan] = useState<any | null>(null);
  const [viewLoanInst, setViewLoanInst] = useState<any[]>([]);
  const [viewLoanPays, setViewLoanPays] = useState<any[]>([]);
  const [viewInstDetail, setViewInstDetail] = useState<any | null>(null);
  const [editLoanRow, setEditLoanRow] = useState<any | null>(null);
  const [editLoanForm, setEditLoanForm] = useState<{ plan_id: string; principal: number; interest_rate: number; interest_enabled: boolean; issued_on: string; next_due_on: string; note: string }>({ plan_id: "", principal: 0, interest_rate: 0, interest_enabled: true, issued_on: "", next_due_on: "", note: "" });
  const [loanPlans, setLoanPlans] = useState<any[]>([]);
  const [irr, setIrr] = useState<any[]>([]);
  const [invDue, setInvDue] = useState<number>(0);
  const [landInvMap, setLandInvMap] = useState<Record<string, { payable: number; paid: number; due: number; count: number }>>({});
  const [landInvoices, setLandInvoices] = useState<Record<string, any[]>>({});
  const [share, setShare] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [receiptRow, setReceiptRow] = useState<PaidHistoryRow | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [rateMap, setRateMap] = useState<RateRow[]>([]);
  const [activeSeasonName, setActiveSeasonName] = useState<string>("");
  const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);
  const [seasonOptions, setSeasonOptions] = useState<{ id: string; label: string }[]>([]);
  const [viewSeasonId, setViewSeasonId] = useState<string | null>(null);
  const [farmerOfficeId, setFarmerOfficeId] = useState<string | null>(null);
  const [landPayMap, setLandPayMap] = useState<Record<string, { lastDate: string | null; total: number }>>({});
  const [paymentFilter, setPaymentFilter] = useState<"all" | "paid" | "due">("all");
  const [landTypeFilter, setLandTypeFilter] = useState<string[]>([]);
  const [noteSearch, setNoteSearch] = useState("");
  const [hiddenInvoiceCount, setHiddenInvoiceCount] = useState<number>(0);
  const [backfilling, setBackfilling] = useState(false);
  const [offices, setOffices] = useState<any[]>([]);
  const [editFarmerOpen, setEditFarmerOpen] = useState(false);
  const [editFarmerForm, setEditFarmerForm] = useState<any | null>(null);
  const [editFarmerPhoto, setEditFarmerPhoto] = useState<File | null>(null);
  const [editFarmerSaving, setEditFarmerSaving] = useState(false);
  const [editFarmerLocErr, setEditFarmerLocErr] = useState<{ level: LocationLevel; message: string } | null>(null);
  
  

  // Add land dialog
  const [openLand, setOpenLand] = useState(false);
  const [land, setLand] = useState({ ...EMPTY_LAND });
  const [landLoc, setLandLoc] = useState<LocationValue>({});
  const [landLocErr, setLandLocErr] = useState<{ level: any; message: string } | null>(null);
  const [landDagDupErr, setLandDagDupErr] = useState<string | null>(null);
  const [savingLand, setSavingLand] = useState(false);
  const [ownerLands, setOwnerLands] = useState<any[]>([]);
  const { rows: landTypeRows } = useLandTypes();
  const [ownerLandsLoading, setOwnerLandsLoading] = useState(false);
  const [patwaris, setPatwaris] = useState<any[]>([]);
  const [transferLand, setTransferLand] = useState<any | null>(null);
  const [reclaimLand, setReclaimLand] = useState<any | null>(null);
  // Lands owned by this farmer that are given out to sharecroppers (borga)
  const [borgaOut, setBorgaOut] = useState<any[]>([]);
  const [borgaGivenMap, setBorgaGivenMap] = useState<Record<string, number>>({});


  // Load patwaris for assignment
  useEffect(() => {
    let qb = db.from("patwaris").select("id,name,name_bn,mobile").eq("is_active", true).order("name");
    if (farmer?.office_id) qb = qb.eq("office_id", farmer.office_id);
    qb.then(({ data }) => setPatwaris(data ?? []));
  }, [farmer?.office_id]);

  // Load lands of selected owner (for borgadar) so user can pick a Dag
  useEffect(() => {
    if (land.owner_type !== "borgadar" || !land.owner_farmer_id) {
      setOwnerLands([]);
      return;
    }
    setOwnerLandsLoading(true);
    let qb = db
      .from("lands_with_location")
      .select("id,dag_no,land_size,field_type,land_type_id,division_id,district_id,upazila_id,mouza_id,mouza_name,office_id")
      .eq("farmer_id", land.owner_farmer_id)
      .eq("owner_type", "owner");
    if (farmer?.office_id) qb = qb.eq("office_id", farmer.office_id);
    qb.then(({ data }) => {
      setOwnerLands(data ?? []);
      setOwnerLandsLoading(false);
    });
  }, [land.owner_type, land.owner_farmer_id, farmer?.office_id]);

  // Edit land dialog
  const [editLand, setEditLand] = useState<LandRow | null>(null);
  const [editForm, setEditForm] = useState({ ...EMPTY_LAND });
  const [editLoc, setEditLoc] = useState<LocationValue>({});
  const [editLocErr, setEditLocErr] = useState<{ level: any; message: string } | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  // Delete confirmation
  const [delTarget, setDelTarget] = useState<LandRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const brand = useBranding();
  const receiptArgs = useReceiptRenderArgs();

  useEffect(() => { if (id) loadAll(); }, [id]);
  useEffect(() => {
    db.from("loan_plans").select("*").eq("is_active", true).then(({ data }) => setLoanPlans(data ?? []));
    db.from("offices").select("id,name").order("name").then(({ data }) => setOffices(data ?? []));
  }, []);
  useEffect(() => { document.title = `${farmer?.name_en ?? ""} — ${t("farmers")}`; }, [farmer, t]);

  async function loadAll() {
    const [f, l, s, ln, ir, sh, pm] = await Promise.all([
      db.from("farmers").select("*, offices(name), divisions(name,name_bn), districts(name,name_bn), upazilas(name,name_bn)").eq("id", id!).maybeSingle(),
      (db.from as any)("lands_with_location").select("*").eq("farmer_id", id!).order("created_at"),
      db.from("savings_transactions").select("*").eq("farmer_id", id!).is("deleted_at", null).order("txn_date", { ascending: false }),
      db.from("loans").select("*, loan_payments(amount,paid_on)").eq("farmer_id", id!).is("deleted_at", null).order("issued_on", { ascending: false }),
      db.from("irrigation_charges").select("*, seasons(name,year,type), lands(dag_no), patwaris(name,name_bn,mobile)").eq("farmer_id", id!).is("deleted_at", null).order("entry_date", { ascending: false }),
      db.from("shares").select("balance").eq("farmer_id", id!).maybeSingle(),
      db.from("payments").select("id, kind, amount, method, note, created_at, idempotency_key, office_id, verify_token, receipt_no, offices(name), payment_allocations(*)").eq("farmer_id", id!).is("deleted_at", null).order("created_at", { ascending: false }).limit(200),
    ]);
    setFarmer(f.data); setLands((l.data as any) ?? []); setSavings(s.data ?? []);
    setLoans(ln.data ?? []); setIrr(ir.data ?? []); setShare(sh.data);
    setPayments(pm.data ?? []);

    // Fetch owner farmer names for borga lands
    const ownerIds = Array.from(new Set(((l.data as any) ?? []).map((x: any) => x.owner_farmer_id).filter(Boolean)));
    if (ownerIds.length) {
      const { data: owners } = await db.from("farmers").select("id,name_en,name_bn,farmer_code").in("id", ownerIds as string[]);
      const map: Record<string, string> = {};
      (owners ?? []).forEach((o: any) => { map[o.id] = o.name_bn || o.name_en || o.farmer_code || "—"; });
      setOwnerNames(map);
    } else setOwnerNames({});

    // Per-land notes from active land relations (Phase 4 — show in lands list)
    const landIdsForNotes = Array.from(new Set(((l.data as any) ?? []).map((x: any) => x.id).filter(Boolean)));
    if (landIdsForNotes.length) {
      const [{ data: rels }, { data: selfRows }] = await Promise.all([
        db.from("land_relations")
          .select("land_id,note")
          .in("land_id", landIdsForNotes as string[])
          .is("deleted_at", null)
          .is("valid_to", null),
        db.from("lands")
          .select("id,notes")
          .in("id", landIdsForNotes as string[]),
      ]);
      const nmap: Record<string, string[]> = {};
      (rels ?? []).forEach((r: any) => {
        const txt = (r.note ?? "").trim();
        if (txt) (nmap[r.land_id] ||= []).push(txt);
      });
      const selfMap: Record<string, string> = {};
      (selfRows ?? []).forEach((r: any) => {
        const txt = (r.notes ?? "").trim();
        if (txt) { selfMap[r.id] = txt; (nmap[r.id] ||= []).unshift(txt); }
      });
      setLandNotes(nmap);
      setLandSelfNotes(selfMap);
    } else { setLandNotes({}); setLandSelfNotes({}); }

    // ── Borga (sharecropping) — single source of truth: land_relations ──
    // The owner ALWAYS keeps the full land row. Borga is recorded as a
    // land_relations row (owner's land + sharecropper + area). Irrigation is
    // split per land (owner pays the remaining self-cultivated area, the
    // sharecropper pays the borga area) — see get_land_billing_split.
    try {
      const ownAllRows = ((l.data as any) ?? []).filter((x: any) => x.owner_type === "owner");
      const ownById: Record<string, any> = {};
      ownAllRows.forEach((x: any) => { ownById[x.id] = x; });
      const ownerLandIds = ownAllRows.map((x: any) => x.id);

      // (A) Borga GIVEN OUT — relations on this farmer's own land rows.
      const givenMap: Record<string, number> = {};
      const outRows: any[] = [];
      if (ownerLandIds.length) {
        const { data: relsOut } = await db.from("land_relations")
          .select("id,land_id,sharecropper_farmer_id,area_decimal,share_percentage")
          .in("land_id", ownerLandIds as string[])
          .not("sharecropper_farmer_id", "is", null)
          .is("deleted_at", null)
          .is("valid_to", null);
        (relsOut ?? []).forEach((r: any) => {
          const parent = ownById[r.land_id];
          const parentSize = Number(parent?.land_size || 0);
          const area = Number(r.area_decimal ?? (parentSize * Number(r.share_percentage || 0) / 100)) || 0;
          givenMap[r.land_id] = (givenMap[r.land_id] || 0) + area;
          outRows.push({
            id: r.id,
            _relation_id: r.id,
            _land_id: r.land_id,
            _sharecropper_id: r.sharecropper_farmer_id,
            _invoice_land_id: r.land_id,
            dag_no: parent?.dag_no ?? null,
            mouza: parent?.mouza_name ?? parent?.mouza ?? null,
            land_size: normalizeLandSize(area),
            farmer_id: r.sharecropper_farmer_id,
          });
        });
      }
      setBorgaGivenMap(givenMap);

      // (B) Borga TAKEN IN — relations where THIS farmer is the sharecropper.
      // Show the owner's land in this farmer's profile (read-only) so the same
      // parcel appears in BOTH profiles.
      const { data: relsIn } = await db.from("land_relations")
        .select("id,land_id,owner_farmer_id,area_decimal,share_percentage")
        .eq("sharecropper_farmer_id", id!)
        .is("deleted_at", null)
        .is("valid_to", null);
      const inParentIds = Array.from(new Set((relsIn ?? []).map((r: any) => r.land_id).filter(Boolean)));
      const inRows: any[] = [];
      if (inParentIds.length) {
        const { data: parents } = await (db.from as any)("lands_with_location")
          .select("*").in("id", inParentIds as string[]);
        const pById: Record<string, any> = {};
        (parents ?? []).forEach((p: any) => { pById[p.id] = p; });
        (relsIn ?? []).forEach((r: any) => {
          const p = pById[r.land_id];
          if (!p) return;
          const area = Number(r.area_decimal ?? (Number(p.land_size || 0) * Number(r.share_percentage || 0) / 100)) || 0;
          inRows.push({
            ...p,
            id: r.land_id,
            land_size: normalizeLandSize(area),
            owner_type: "borgadar",
            owner_farmer_id: r.owner_farmer_id,
            _borga_in: true,
            _relation_id: r.id,
          });
        });
      }
      // Merge borga-in rows into the lands list and resolve owner names.
      if (inRows.length) {
        setLands((prev: any[]) => {
          const existing = new Set(prev.map((x) => x.id));
          const add = inRows.filter((x) => !existing.has(x.id));
          return [...prev, ...add];
        });
        const inOwnerIds = Array.from(new Set(inRows.map((r) => r.owner_farmer_id).filter(Boolean)));
        const { data: ow } = await db.from("farmers").select("id,name_en,name_bn,farmer_code").in("id", inOwnerIds as string[]);
        setOwnerNames((prev) => {
          const next = { ...prev };
          (ow ?? []).forEach((o: any) => { next[o.id] = o.name_bn || o.name_en || o.farmer_code || "—"; });
          return next;
        });
      }

      // Tenant details + latest borga invoice for the Owned-(Borga) tab.
      const tenantIds = Array.from(new Set(outRows.map((r) => r.farmer_id).filter(Boolean)));
      const tenantMap: Record<string, any> = {};
      if (tenantIds.length) {
        const { data: tenants } = await db.from("farmers")
          .select("id,name_en,name_bn,farmer_code,mobile").in("id", tenantIds as string[]);
        (tenants ?? []).forEach((t: any) => { tenantMap[t.id] = t; });
      }
      const outLandIds = Array.from(new Set(outRows.map((r) => r._invoice_land_id).filter(Boolean)));
      const invMap: Record<string, any> = {};
      if (outLandIds.length) {
        const { data: invs } = await db.from("irrigation_invoices")
          .select("land_id,farmer_id,generated_at,payable_amount,paid_amount,due_amount")
          .in("land_id", outLandIds as string[])
          .eq("is_borga", true)
          .is("deleted_at", null)
          .order("generated_at", { ascending: false });
        (invs ?? []).forEach((iv: any) => {
          const key = `${iv.land_id}:${iv.farmer_id}`;
          if (!invMap[key]) invMap[key] = iv;
        });
      }
      setBorgaOut(outRows.map((r) => ({
        ...r,
        tenant: tenantMap[r.farmer_id],
        latest_invoice: invMap[`${r._invoice_land_id}:${r.farmer_id}`],
      })));
    } catch { setBorgaOut([]); setBorgaGivenMap({}); }





    // Outstanding from new irrigation_invoices (replaces legacy irrigation_charges total)
    const inv = await db
      .from("irrigation_invoices")
      .select("*, farmers!irrigation_invoices_farmer_id_fkey(name_bn,name_en,farmer_code,mobile,village), lands(mouza,dag_no,land_size), seasons(name,year,type)")
      .eq("farmer_id", id!)
      .is("deleted_at", null);
    if (inv.error) console.error("irrigation_invoices fetch error:", inv.error);
    const invRows = inv.data ?? [];
    const visibleInvCount = invRows.filter((r: any) => r.invoice_status !== "cancelled").length;
    // Canonical due (shared with Farmer List): excludes cancelled/deleted, keeps NULL status.
    setInvDue(computeIrrigationDue(invRows as any));
    // Detect invoices hidden from the current user due to office permissions
    try {
      const { data: trueCount } = await db.rpc("count_farmer_invoices", { _farmer_id: id! });
      setHiddenInvoiceCount(Math.max(0, Number(trueCount ?? 0) - visibleInvCount));
    } catch { setHiddenInvoiceCount(0); }
    // Per-land irrigation payment status (aggregate all invoices per land)
    const lim: Record<string, { payable: number; paid: number; due: number; count: number }> = {};
    const liDocs: Record<string, any[]> = {};
    invRows.forEach((r: any) => {
      if (!r.land_id || r.invoice_status === "cancelled") return;
      const m = lim[r.land_id] ?? { payable: 0, paid: 0, due: 0, count: 0 };
      m.payable += Number(r.payable_amount || 0);
      m.paid += Number(r.paid_amount || 0);
      m.due += Number(r.due_amount || 0);
      m.count += 1;
      lim[r.land_id] = m;
      (liDocs[r.land_id] ??= []).push(r);
    });
    setLandInvMap(lim);
    setLandInvoices(liDocs);

    // Load payment records per invoice → map to land (for tooltip date/amount)
    try {
      const invIds = invRows.map((r: any) => r.id).filter(Boolean);
      const invToLand: Record<string, string> = {};
      invRows.forEach((r: any) => { if (r.id && r.land_id) invToLand[r.id] = r.land_id; });
      if (invIds.length) {
        const { data: pays } = await db
          .from("irrigation_invoice_payments")
          .select("invoice_id,collected_amount,created_at")
          .in("invoice_id", invIds);
        const pm: Record<string, { lastDate: string | null; total: number }> = {};
        (pays ?? []).forEach((p: any) => {
          const landId = invToLand[p.invoice_id];
          if (!landId) return;
          const e = pm[landId] ?? { lastDate: null, total: 0 };
          e.total += Number(p.collected_amount || 0);
          if (!e.lastDate || new Date(p.created_at) > new Date(e.lastDate)) e.lastDate = p.created_at;
          pm[landId] = e;
        });
        setLandPayMap(pm);
      } else {
        setLandPayMap({});
      }
    } catch { setLandPayMap({}); }

    // Load all seasons + active season + per-land rate map (for Rate/Total columns in Land tab)
    try {
      setFarmerOfficeId(f.data?.office_id ?? null);
      const { data: allSeasons } = await db
        .from("seasons")
        .select("id,name,year,type,status,start_date,end_date")
        .order("year", { ascending: false });
      const opts = (allSeasons ?? []).map((s: any) => {
        const baseName = s.name || s.type || "";
        return { id: s.id, label: s.year ? `${baseName}-${s.year}` : baseName };
      });
      setSeasonOptions(opts);
      const sn = pickCurrentSeason(allSeasons ?? []);
      if (sn?.id) {
        setActiveSeasonId(sn.id);
        const baseName = sn.name || sn.type || "";
        setActiveSeasonName(sn.year ? `${baseName}-${sn.year}` : baseName);
        setViewSeasonId((prev) => prev ?? sn.id);
        const rows = await loadSeasonRateMap(viewSeasonId ?? sn.id, f.data?.office_id ?? null);
        setRateMap(rows);
      } else {
        setActiveSeasonId(null);
        setActiveSeasonName("");
        if (!viewSeasonId && opts[0]) setViewSeasonId(opts[0].id);
        setRateMap([]);
      }
    } catch { /* non-fatal */ }
  }

  // Reload per-land rate map when the viewed season changes
  useEffect(() => {
    if (!viewSeasonId) return;
    loadSeasonRateMap(viewSeasonId, farmerOfficeId).then(setRateMap).catch(() => {});
  }, [viewSeasonId, farmerOfficeId]);

  function landSeasonStatus(landId: string): { state: "none" | "paid" | "partial" | "due"; payable: number; paid: number; due: number } {
    const rows = (landInvoices[landId] ?? []).filter(
      (r: any) => r.invoice_status !== "cancelled" && viewSeasonId && r.season_id === viewSeasonId
    );
    if (!rows.length) return { state: "none", payable: 0, paid: 0, due: 0 };
    const payable = rows.reduce((a: number, r: any) => a + Number(r.payable_amount || 0), 0);
    const paid = rows.reduce((a: number, r: any) => a + Number(r.paid_amount || 0), 0);
    const due = rows.reduce((a: number, r: any) => a + Number(r.due_amount || 0), 0);
    let state: "paid" | "partial" | "due";
    if (due <= 0.005) state = "paid";
    else if (paid > 0.005) state = "partial";
    else state = "due";
    return { state, payable, paid, due };
  }

  async function handleBackfillInvoiceOffice() {
    setBackfilling(true);
    try {
      const { data, error } = await db.rpc("backfill_irrigation_invoice_office");
      if (error) throw error;
      toast.success(tx(`Fixed ${data ?? 0} invoice(s)`, `${data ?? 0} টি ইনভয়েস ঠিক করা হয়েছে`));
      await loadAll();
    } catch (e: any) {
      toast.error(e?.message ?? tx("Failed to backfill", "ঠিক করা যায়নি"));
    } finally {
      setBackfilling(false);
    }
  }




  function farmerLocationLine(fr: any): string {
    if (!fr) return "—";
    return fr.village || fr.villages?.name_bn || fr.villages?.name || "—";
  }


  function farmerForReceipt(extra: Partial<BnReceiptData["farmer"]> = {}): BnReceiptData["farmer"] {
    // Use first land's mouza as a default (savings/loan receipts also need মৌজা)
    const primaryMouza = (lands?.[0] as any)?.mouza_name ?? (lands?.[0] as any)?.mouza ?? null;
    return {
      name: farmer?.name_bn || farmer?.name_en || "—",
      member_no: farmer?.member_no ?? farmer?.account_number ?? null,
      father_or_husband: farmer?.father_name ?? null,
      village: farmer?.village ?? null,
      mobile: farmer?.mobile ?? null,
      mouza: primaryMouza,
      ...extra,
    };
  }
  function commonReceipt(): Pick<BnReceiptData, "company_name" | "company_name_bn" | "logo_url" | "org" | "collector_signature_url" | "office_collector_signature_url"> {
    return {
      company_name: brand.company_name,
      company_name_bn: brand.company_name_bn,
      logo_url: brand.logo_url ?? null,
      org: receiptArgs.org,
      collector_signature_url: receiptArgs.signatureUrl,
      office_collector_signature_url: receiptArgs.signatureUrl,
    };
  }

  async function getFarmerUnionName(): Promise<string | null> {
    if (!farmer?.union_id) return null;
    const { data } = await db.from("unions").select("name_bn,name").eq("id", farmer.union_id).maybeSingle();
    return data?.name_bn || data?.name || null;
  }

  async function reprintReceipt(p: any, copy: import("@/lib/bnReceipts").ReceiptCopy = "both") {
    if (!farmer) return;
    const k = (p.kind as string) || "savings";
    const kind: BnReceiptData["kind"] = k === "loan" ? "loan" : k === "irrigation" ? "irrigation" : "savings";
    const prefix = kind === "loan" ? "LOAN" : kind === "irrigation" ? "IRR" : "SAV";
    const description = p.note
      ?? (kind === "loan" ? "ঋণের কিস্তি গ্রহণ" : kind === "savings" ? "সঞ্চয় জমা গ্রহণ" : "সেচ চার্জ গ্রহণ");
    let irrigationExtras: Omit<Partial<BnReceiptData>, "farmer"> & { farmer?: Partial<BnReceiptData["farmer"]> } = {};
    if (kind === "irrigation") {
      const allocIds = (p.payment_allocations ?? [])
        .filter((a: any) => a.kind === "irrigation" && a.reference_id)
        .map((a: any) => a.reference_id);
      let invoiceRows: any[] = [];
      if (allocIds.length) {
        const { data } = await db
          .from("irrigation_invoices")
          .select("id,invoice_no,irrigation_amount,maintenance_amount,canal_amount,delay_fee,due_amount,discount_amount,season_rate,is_borga,note,seasons(name,year,status),land_type_name,irrigation_category_name,lands(mouza,dag_no,land_size,field_type,land_type_id,owner_type,owner_farmer_id,notes,patwaris(name,name_bn,mobile),owner:farmers!lands_owner_farmer_id_fkey(name_bn,name_en,member_no,farmer_code))")
          .in("id", allocIds);
        invoiceRows = data ?? [];
      }
      const isBorga = invoiceRows.some((inv) => inv?.is_borga);
      const primary = invoiceRows[0];
      const ownerInvoice = invoiceRows.find((inv) => inv?.is_borga && inv?.lands?.owner) ?? primary;
      const land = primary?.lands;
      const ownerFarmer = ownerInvoice?.lands?.owner;
      const ownerMember = ownerFarmer?.member_no || ownerFarmer?.farmer_code || null;
      const ownerName = ownerFarmer ? (ownerFarmer.name_bn || ownerFarmer.name_en) : null;
      const dagNo = Array.from(new Set(invoiceRows
        .map((inv) => (inv?.lands?.dag_no ?? "").trim())
        .filter(Boolean)
        .flatMap((s) => s.split(/[,;\s]+/))
        .filter(Boolean))).join(", ") || null;
      const landSize = invoiceRows.reduce((s, inv) => s + Number(inv?.lands?.land_size || 0), 0) || null;
      const billInfo = Array.from(new Set(invoiceRows
        .map((inv) => inv?.seasons?.name || inv?.irrigation_category_name || inv?.land_type_name || null)
        .filter(Boolean))).join("/") || "সেচ চার্জ";
      const fieldTypeBn = Array.from(new Set(invoiceRows
        .map((inv) => landTypeLabel(landTypeRows, inv?.lands?.land_type_id, inv?.lands?.field_type) || inv?.land_type_name || inv?.irrigation_category_name || null)
        .filter(Boolean))).join("/") || null;
      const patwari = invoiceRows.find((inv) => inv?.lands?.patwaris)?.lands?.patwaris ?? null;
      irrigationExtras = {
        bill_info: billInfo,
        village_union: await getFarmerUnionName(),
        member_summary: `${farmer?.member_no ?? farmer?.farmer_code ?? "N/A"}/${(isBorga && ownerMember) ? ownerMember : "N/A"}`,
        owner_self: !isBorga,
        land_owner_label: isBorga && ownerName ? `${ownerName}${ownerMember ? "-" + ownerMember : ""}` : "নিজ",
        rate: normalizeIrrigationRatePerAcre(primary?.season_rate, primary?.irrigation_amount, land?.land_size),
        current_season_charge: invoiceRows.reduce((s, inv) => s + Number(inv?.irrigation_amount || 0), 0),
        current_penalty: invoiceRows.reduce((s, inv) => s + Number(inv?.delay_fee || 0), 0),
        maintenance_charge: invoiceRows.reduce((s, inv) => s + Number(inv?.maintenance_amount || 0), 0),
        canal_charge: invoiceRows.reduce((s, inv) => s + Number(inv?.canal_amount || 0), 0),
        discount_amount: invoiceRows.reduce((s, inv) => s + Number(inv?.discount_amount || 0), 0),
        total_outstanding: invoiceRows.reduce((s, inv) => s + Number(inv?.due_amount || 0), 0),
        holding_description: invoiceRows.map((inv) => (inv?.lands?.notes ?? "").trim()).filter(Boolean).join(" || ") || null,
        patwari_name: patwari ? (patwari.name_bn || patwari.name) : null,
        patwari_mobile: patwari?.mobile ?? null,
        farmer: {
          mouza: invoiceRows.find((inv) => inv?.lands?.mouza)?.lands?.mouza ?? null,
          field_type_bn: fieldTypeBn,
          land_size: landSize,
          dag_no: dagNo,
          owner_type_bn: isBorga ? "বর্গাদার" : "মালিক",
        },
      };
    }
    const { farmer: irrigationFarmerExtras, ...irrigationReceiptExtras } = irrigationExtras;
    downloadBnReceiptPdf({
      kind,
      ...commonReceipt(),
      receipt_no: p.receipt_no || autoReceiptNo(prefix as any, p.id, new Date(p.created_at)),
      date: p.created_at,
      bill_info: kind === "irrigation" ? (irrigationExtras.bill_info ?? "সেচ চার্জ") : undefined,
      farmer: farmerForReceipt(irrigationFarmerExtras),
      ...(kind === "irrigation" ? irrigationReceiptExtras : {}),
      collected_amount: Number(p.amount),
      description,
      verify_url: p.verify_token ? `${window.location.origin}/r/${p.verify_token}` : null,
    }, copy, (kind === "loan" || kind === "savings")
      ? { ...receiptArgs.options, paper: "a5", orientation: "l" }
      : receiptArgs.options);
  }

  function printSavings(s: any, copy: import("@/lib/bnReceipts").ReceiptCopy = "both") {
    const typeLabel = s.type === "deposit" ? tx("Deposit", "জমা") : tx("Withdrawal", "উত্তোলন");
    const acNo = (farmer as any)?.account_number || (farmer as any)?.member_no || (farmer as any)?.farmer_code || "—";
    // Build savings summary from loaded savings list (txns sorted desc by created_at)
    const allTxns: any[] = (savings as any) || [];
    const sorted = [...allTxns].sort((a, b) => String(a.txn_date ?? a.created_at).localeCompare(String(b.txn_date ?? b.created_at)));
    let balance = 0;
    let depositTotal = 0;
    let balanceBefore = 0;
    let balanceAfter = 0;
    for (const t of sorted) {
      const amt = Number(t.amount || 0);
      if (t.type === "deposit") { depositTotal += amt; }
      if (t.id === s.id) { balanceBefore = balance; }
      balance += (t.type === "deposit" ? amt : -amt);
      if (t.id === s.id) { balanceAfter = balance; }
    }
    const categoryMap: Record<string, string> = {
      general: tx("General", "সাধারণ"), hawlat: tx("Hawlat", "হাওলাত"),
      bank: tx("Bank", "ব্যাংক"), donation: tx("Donation", "দান"), misc: tx("Misc", "বিবিধ"),
    };
    downloadBnReceiptPdf({
      kind: "savings",
      ...commonReceipt(),
      receipt_no: s.receipt_no || autoReceiptNo("SAV", s.id, new Date(s.txn_date ?? s.created_at)),
      date: s.txn_date ?? s.created_at,
      farmer: farmerForReceipt(),
      description: `${typeLabel}${s.note ? " — " + s.note : ""}`,
      collected_amount: Number(s.amount),
      verify_url: `${window.location.origin}/r/sav-${s.id}`,
      savings_account_no: String(acNo),
      savings_category_bn: s.category ? (categoryMap[s.category] || s.category) : null,
      savings_balance_before: balanceBefore,
      savings_balance_after: balanceAfter,
      savings_deposit_total: depositTotal,
      outstanding: balanceAfter,
    }, copy, { ...receiptArgs.options, paper: "a5", orientation: "l" });
  }
  function buildLandInvoicePayload(inv: any) {
    return {
      invoice_no: inv.invoice_no,
      generated_at: inv.generated_at,
      due_date: inv.due_date,
      is_borga: inv.is_borga,
      note: inv.note,
      irrigation_amount: inv.irrigation_amount,
      maintenance_amount: inv.maintenance_amount,
      canal_amount: inv.canal_amount,
      other_charge: inv.other_charge,
      delay_fee: inv.delay_fee,
      payable_amount: inv.payable_amount,
      paid_amount: inv.paid_amount,
      due_amount: inv.due_amount,
      invoice_status: inv.invoice_status,
      rate_source: inv.rate_source ?? (inv.is_manual_rate ? "MANUAL" : "STANDARD"),
      applied_rate: inv.applied_rate ?? inv.season_rate ?? null,
      original_standard_rate: inv.original_standard_rate ?? null,
      irrigation_category_name: inv.irrigation_category_name ?? null,
      farmer: {
        name: inv.farmers?.name_bn ?? inv.farmers?.name_en,
        farmer_code: inv.farmers?.farmer_code,
        mobile: inv.farmers?.mobile,
        village: inv.farmers?.village ?? null,
      },
      land: { mouza: inv.lands?.mouza, dag_no: inv.lands?.dag_no, land_size: inv.lands?.land_size },
      season: inv.seasons,
    };
  }
  async function downloadLandInvoices(landId: string) {
    const rows = (landInvoices[landId] ?? []);
    if (!rows.length) { toast.error(tx("No invoice", "ইনভয়েস নেই")); return; }
    try {
      const settings = loadInvoiceSettings();
      for (const inv of rows) {
        await downloadIrrigationInvoicePdf(buildLandInvoicePayload(inv), "farmer", settings);
      }
    } catch (e: any) {
      toast.error(e?.message ?? tx("Failed to generate PDF", "পিডিএফ তৈরি ব্যর্থ"));
    }
  }
  async function printIrrigation(i: any, copy: import("@/lib/bnReceipts").ReceiptCopy = "farmer") {
    const land = (lands || []).find((x: any) => x.id === i.land_id) as any;
    const pw = i.patwaris ?? null;

    // Land owner label: "নিজ" for self, otherwise "Owner Name (member_no)"
    let landOwnerLabel: string | null = null;
    let ownerMemberNo: string | null = null;
    if (land) {
      if (land.owner_type === "borgadar" && land.owner_farmer_id && land.owner_farmer_id !== farmer?.id) {
        const { data: own } = await db
          .from("farmers")
          .select("name_bn,name_en,member_no,farmer_code")
          .eq("id", land.owner_farmer_id)
          .maybeSingle();
        if (own) {
          ownerMemberNo = own.member_no || own.farmer_code || null;
          landOwnerLabel = `${own.name_bn || own.name_en}${ownerMemberNo ? "-" + ownerMemberNo : ""}`;
        } else {
          landOwnerLabel = "—";
        }
      } else {
        landOwnerLabel = tx("Self", "নিজ");
      }
    }

    // Field type Bangla label — prefer the catalogue name, fall back to the legacy enum.
    const fieldTypeBn = landTypeLabel(landTypeRows, (land as any)?.land_type_id, land?.field_type) || (({
      high_land: tx("High land", "উঁচু জমি"),
      medium_land: tx("Medium land", "মাঝারি জমি"),
      low_land: tx("Low land", "নিচু জমি"),
      other: tx("Other", "অন্যান্য"),
    } as Record<string, string>)[land?.field_type as string] ?? null);

    // Full ledger outstanding for this farmer (sum of due across all open invoices)
    const { data: dueRows } = await db
      .from("irrigation_invoices")
      .select("due_amount")
      .eq("farmer_id", farmer?.id ?? id!)
      .is("deleted_at", null);
    const totalOutstanding = (dueRows ?? []).reduce((s: number, r: any) => s + Number(r.due_amount || 0), 0);

    // Collected from outstanding (this entry): how much of paid amount went to previous due
    const paid = Number(i.paid_amount || 0);
    const baseCharge = Number(i.base_charge ?? 0);
    const extras = Number(i.penalty_amount ?? 0) + Number(i.maintenance_charge ?? 0) + Number(i.canal_charge ?? 0) + Number(i.other_charge ?? 0);
    const currentSeasonAmount = baseCharge + extras;
    const collectedFromOutstanding = Math.max(0, paid - currentSeasonAmount > 0 ? paid - currentSeasonAmount : 0);

    downloadBnReceiptPdf({
      kind: "irrigation",
      ...commonReceipt(),
      receipt_no: i.receipt_no || autoReceiptNo("IRR", i.id, new Date(i.entry_date)),
      date: i.entry_date,
      bill_info: i.seasons ? `${i.seasons.name ?? ""}${i.seasons.year ? ", " + i.seasons.year : ""}` : undefined,
      farmer: farmerForReceipt({
        mouza: land?.mouza_name ?? land?.mouza ?? null,
        field_type_bn: fieldTypeBn,
        land_size: land?.land_size != null ? Number(land.land_size) : null,
        dag_no: land?.dag_no ?? i.lands?.dag_no ?? null,
        owner_type_bn: land?.owner_type === "borgadar" ? "বর্গাদার" : land?.owner_type === "owner" ? "মালিক" : null,
      }),
      village_union: await getFarmerUnionName(),
      member_summary: `${farmer?.member_no ?? farmer?.farmer_code ?? "N/A"}/${land?.owner_type === "borgadar" && land?.owner_farmer_id ? (ownerMemberNo ?? "N/A") : "N/A"}`,
      owner_self: landOwnerLabel === tx("Self", "নিজ"),
      rate: normalizeIrrigationRatePerAcre(null, baseCharge, land?.land_size),
      charge_amount: Number(i.total),
      previous_due: Number(i.previous_due_brought ?? 0),
      land_owner_label: landOwnerLabel,
      current_season_charge: baseCharge,
      current_penalty: Number(i.penalty_amount ?? 0),
      penalty_amount: Number(i.penalty_amount ?? 0),
      maintenance_charge: Number(i.maintenance_charge ?? 0),
      canal_charge: Number(i.canal_charge ?? 0),
      total_outstanding: totalOutstanding,
      collected_from_outstanding: collectedFromOutstanding,
      remark: i.note ?? null,
      holding_description: (land as any)?.notes ?? null,
      patwari_name: pw ? (pw.name_bn || pw.name) : null,
      patwari_mobile: pw?.mobile ?? null,
      collected_amount: Number(i.paid_amount || i.total),
    }, copy, receiptArgs.options);
  }
  async function deleteSavings(s: any) {
    if (!window.confirm("Delete this savings transaction?")) return;
    const { error } = await db.from("savings_transactions").update({ deleted_at: new Date().toISOString() } as any).eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success(t("pgDeleted" as any)); loadAll();
  }
  async function deleteIrrigation(i: any) {
    if (!window.confirm("Delete this irrigation entry?")) return;
    const { error } = await db.from("irrigation_charges").update({ deleted_at: new Date().toISOString() } as any).eq("id", i.id);
    if (error) return toast.error(error.message);
    toast.success(t("pgDeleted" as any)); loadAll();
  }
  async function deletePayment(p: any) {
    if (!window.confirm("Delete this payment? এই রসিদ ডাটাবেজ থেকে স্থায়ীভাবে মুছে যাবে এবং সংশ্লিষ্ট ইনভয়েসের বকেয়া পুনঃস্থাপন হবে।")) return;

    // 1. Reverse allocations so invoice dues are restored before removal.
    const allocs: any[] = (p.payment_allocations ?? []).length
      ? p.payment_allocations
      : [{ kind: p.kind, reference_id: p.reference_id, amount: p.amount }];
    for (const a of allocs) {
      const amt = Number(a.amount || 0);
      if (a.kind === "irrigation" && a.reference_id) {
        if (amt > 0) {
          const { data: inv } = await db.from("irrigation_invoices").select("paid_amount,payable_amount").eq("id", a.reference_id).maybeSingle();
          if (inv) {
            const st = computeInvoiceDue(inv.payable_amount, Number(inv.paid_amount || 0) - amt);
            await db.from("irrigation_invoices").update({ paid_amount: st.paid, due_amount: st.due, invoice_status: st.status } as any).eq("id", a.reference_id);
          }
        }
        await db.from("irrigation_invoice_payments").delete().eq("invoice_id", a.reference_id).eq("payment_id", p.id);
      }
    }

    // 2. Remove any remaining link rows for this payment, then hard-delete.
    await db.from("irrigation_invoice_payments").delete().eq("payment_id", p.id);
    await db.from("payment_allocations").delete().eq("payment_id", p.id);
    const { error } = await db.from("payments").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success(t("pgDeleted" as any)); loadAll();
  }


  async function addLand() {
    setLandLocErr(null);
    setLandDagDupErr(null);
    // Only Mouza is required for land location.
    const loc = landLoc as any;
    if (!loc.mouza_name || !String(loc.mouza_name).trim()) { setLandLocErr({ level: "mouza", message: t("mouzaRequired" as any) || "মৌজা দিন" }); return; }
    if (!land.dag_no.trim()) return toast.error(t("dagRequired" as any));
    let canonicalDag = land.dag_no.trim();
    let dagTokens: string[] = [canonicalDag];
    if (land.owner_type === "owner") {
      const dv = validateDagNumbers(land.dag_no);
      if (dv.ok === false) return toast.error(dv.error);
      canonicalDag = dv.values.join(", ");
      dagTokens = dv.values;
    }
    // Prevent duplicate Dag within the same Mouza (across existing land records).
    {
      let dq = db.from("lands").select("dag_no,mouza_id,mouza").is("deleted_at", null);
      const mid = (landLoc as any).mouza_id;
      dq = mid ? dq.eq("mouza_id", mid) : dq.eq("mouza", String(loc.mouza_name).trim());
      const { data: sameMouza } = await dq;
      const dup = findDuplicateDagInMouza(dagTokens, (sameMouza ?? []).map((r: any) => r.dag_no));
      if (dup) {
        const msg = (t("dagDuplicateInMouza" as any) || "এই মৌজায় দাগ নাম্বার আগে থেকেই আছে") + `: "${dup}"`;
        setLandDagDupErr(msg);
        toast.error(msg);
        return;
      }
    }
    if (!(land.land_size > 0)) return toast.error(t("landSizeRequired" as any));
    if (land.owner_type === "borgadar" && !land.owner_farmer_id) {
      return toast.error(t("ownerRequiredForBorgadar" as any));
    }
    if ((land.owner_type === "owner" || (land.owner_type === "borgadar" && land.owner_farmer_id)) && !land.land_type_id) {
      return toast.error(tx("Please select a Field Type (land type)", "জমির ধরন (Field Type) নির্বাচন করুন"));
    }
    setSavingLand(true);
    try {
      // Borga (sharecropping) is stored as a single source of truth in
      // `land_relations`, NOT as a standalone owner-billed `lands` row. This
      // reduces the owner's billable area so a fully-shared parcel is never
      // invoiced against the owner — only against the cultivating sharecropper.
      if (land.owner_type === "borgadar") {
        if (!land.owner_land_id) {
          toast.error(tx("Please select the owner's plot (Dag) for this borga land.", "এই বর্গা জমির জন্য মালিকের দাগ নির্বাচন করুন।"));
          return;
        }
        const { data: parentLand } = await db.from("lands")
          .select("id,land_size,office_id").eq("id", land.owner_land_id).maybeSingle();
        const parentSize = Number((parentLand as any)?.land_size || 0);
        const area = Number(land.land_size || 0);
        const sharePct = parentSize > 0 ? Math.min(100, +((area / parentSize) * 100).toFixed(4)) : 0;
        const { error } = await db.from("land_relations").insert({
          land_id: land.owner_land_id,
          owner_farmer_id: land.owner_farmer_id,
          sharecropper_farmer_id: id!,
          area_decimal: area,
          share_percentage: sharePct,
          valid_from: new Date().toISOString().slice(0, 10),
          office_id: (parentLand as any)?.office_id ?? (landLoc as any).office_id ?? null,
          note: land.notes?.trim() || null,
        } as any);
        if (error) { toast.error(error.message); return; }
      } else {
        const { error } = await db.from("lands").insert({
          farmer_id: id!,
          mouza: (landLoc as any).mouza_name ?? "",
          division_id: (landLoc as any).division_id ?? null,
          district_id: (landLoc as any).district_id ?? null,
          upazila_id: (landLoc as any).upazila_id ?? null,
          mouza_id: (landLoc as any).mouza_id ?? null,
          dag_no: canonicalDag,
          land_size: land.land_size,
          owner_type: land.owner_type as any,
          field_type: land.field_type as any,
          land_type_id: land.land_type_id || null,
          owner_farmer_id: null,
          patwari_id: land.patwari_id || null,
          notes: land.notes?.trim() || null,
        } as any);
        if (error) { toast.error(error.message); return; }
      }
      toast.success(t("saved")); setOpenLand(false);
      // #16 — show an estimated irrigation due for the new land in the active season.
      void estimateNewLandDue(land.land_size, (landLoc as any).office_id ?? null);
      setLand({ ...EMPTY_LAND });
      setLandLoc({});
      loadAll();
    } finally { setSavingLand(false); }
  }

  // Read-only estimate (no DB invoice created). Uses the active season's base rate.
  async function estimateNewLandDue(landSize: number, officeId: string | null, suffix = "") {
    try {
      const { data: season } = await db
        .from("seasons").select("id,name,year,due_date,status")
        .eq("status", "active").order("year", { ascending: false }).limit(1).maybeSingle();
      if (!season?.id) return;
      let rq = db.from("irrigation_rates")
        .select("base_rate,office_id").eq("season_id", season.id).eq("is_active", true);
      const { data: rates } = await rq;
      const rate = (rates ?? []).find((r: any) => officeId && r.office_id === officeId)?.base_rate
        ?? (rates ?? [])[0]?.base_rate;
      if (!(Number(rate) > 0)) return;
      const settings = await getChargeSettings(officeId);
      const calc = calcInvoice({
        land_size_shotok: landSize,
        rate_per_shotok: Number(rate),
        settings,
        due_date: season.due_date || new Date().toISOString().slice(0, 10),
      });
      toast.info(
        `${tx("Estimated irrigation due", "আনুমানিক সেচ বকেয়া")} (${season.name ?? season.year}): ${money(calc.due_amount)}${suffix}`,
        { duration: 7000 },
      );
    } catch { /* estimate only — ignore errors */ }
  }

  async function openEdit(row: LandRow) {
    setEditLand(row);
    setEditForm({
      dag_no: row.dag_no ?? "",
      land_size: Number(row.land_size ?? 0),
      owner_type: (row.owner_type as any) ?? "owner",
      field_type: (row.field_type as any) ?? "medium_land",
      land_type_id: ((row as any).land_type_id as string) ?? "",
      owner_farmer_id: ((row as any).owner_farmer_id as string) ?? "",
      owner_land_id: ((row as any).owner_land_id as string) ?? "",
      patwari_id: ((row as any).patwari_id as string) ?? "",
      notes: ((row as any).notes as string) ?? landSelfNotes[row.id] ?? "",
    });
    setEditLocErr(null);
    // Hydrate full location chain so LocationPicker preselects the saved values.
    let initialLoc: any = {
      division_id: (row as any).division_id ?? null,
      district_id: (row as any).district_id ?? null,
      upazila_id: (row as any).upazila_id ?? null,
      mouza_id: (row as any).mouza_id ?? null,
      mouza_name: row.mouza ?? null,
    };
    if (initialLoc.mouza_id) {
      const { data: m } = await db
        .from("mouzas")
        .select("id,name,upazila_id,upazilas:upazila_id(id,name,district_id,districts:district_id(id,name,division_id,divisions:division_id(id,name)))")
        .eq("id", initialLoc.mouza_id)
        .maybeSingle();
      if (m) {
        const up: any = (m as any).upazilas;
        const di: any = up?.districts;
        const dv: any = di?.divisions;
        initialLoc = {
          division_id: dv?.id ?? initialLoc.division_id,
          division_name: dv?.name ?? null,
          district_id: di?.id ?? initialLoc.district_id,
          district_name: di?.name ?? null,
          upazila_id: up?.id ?? initialLoc.upazila_id,
          upazila_name: up?.name ?? null,
          mouza_id: (m as any).id,
          mouza_name: (m as any).name ?? row.mouza,
        };
      }
    }
    setEditLoc(initialLoc);
  }

  async function saveEdit() {
    if (!editLand) return;
    setEditSaving(true);
    const prevSize = Number(editLand.land_size ?? 0);
    try {
      const el = editLoc as any;
      if (!el.mouza_name || !String(el.mouza_name).trim()) { setEditLocErr({ level: "mouza", message: t("mouzaRequired" as any) || "মৌজা দিন" }); return; }
      let canonicalDag = editForm.dag_no.trim();
      let dagNumbers: string[] = canonicalDag ? [canonicalDag] : [];
      if (editForm.owner_type === "owner") {
        const dv = validateDagNumbers(editForm.dag_no);
        if (dv.ok === false) { toast.error(dv.error); return; }
        canonicalDag = dv.values.join(", ");
        dagNumbers = dv.values;
      }
      if (!editForm.land_type_id) {
        toast.error(tx("Please select a Field Type (land type)", "জমির ধরন (Field Type) নির্বাচন করুন"));
        return;
      }
      const { data, error } = await db.from("lands").update({
        mouza: (editLoc as any).mouza_name ?? "",
        division_id: (editLoc as any).division_id ?? null,
        district_id: (editLoc as any).district_id ?? null,
        upazila_id: (editLoc as any).upazila_id ?? null,
        mouza_id: (editLoc as any).mouza_id ?? null,
        dag_no: canonicalDag,
        dag_numbers: dagNumbers,
        land_size: editForm.land_size,
        owner_type: editForm.owner_type as any,
        field_type: editForm.field_type as any,
        land_type_id: editForm.land_type_id || null,
        patwari_id: editForm.patwari_id || null,
        notes: editForm.notes?.trim() || null,
      } as any).eq("id", editLand.id).select("id");
      if (error) { toast.error(error.message); return; }
      if (!data || data.length === 0) {
        toast.error(t("noPermissionOrNotFound" as any) || "পরিবর্তন সংরক্ষণ করা যায়নি — অনুমতি নেই বা রেকর্ড পাওয়া যায়নি।");
        return;
      }
      // Audit trail for note changes made via the edit dialog
      const newNote = editForm.notes?.trim() || null;
      const oldNote = (editLand as any).notes?.trim() || null;
      if (newNote !== oldNote) {
        const { data: u } = await supabase.auth.getUser();
        await db.from("land_note_audit").insert({
          land_id: editLand.id,
          office_id: (editLand as any).office_id ?? null,
          old_note: oldNote,
          new_note: newNote,
          changed_by: u?.user?.id ?? null,
        } as any);
      }
      toast.success(t("saved"));
      // #13 — if billable area increased on edit, surface the extra estimated due.
      const delta = Number(editForm.land_size ?? 0) - prevSize;
      if (delta > 0.0001) {
        const ownerNote = editForm.owner_type === "borgadar"
          ? tx(" (borgadar's due)", " (বর্গাদারের ডিউ)")
          : tx(" (owner's due)", " (নিজ নামে ডিউ)");
        void estimateNewLandDue(delta, (editLoc as any).office_id ?? null, ownerNote);
      }
      setEditLand(null);
      setEditLoc({});
      loadAll();
    } finally { setEditSaving(false); }
  }

  async function confirmDelete() {
    if (!delTarget) return;
    setDeleting(true);
    try {
      // Block if referenced by irrigation_invoices, legacy irrigation_charges, or land_relations
      const [{ count: invCnt }, { count: irrCnt }, { count: relCnt }] = await Promise.all([
        db.from("irrigation_invoices").select("id", { count: "exact", head: true }).eq("land_id", delTarget.id).is("deleted_at", null),
        db.from("irrigation_charges").select("id", { count: "exact", head: true }).eq("land_id", delTarget.id).is("deleted_at", null),
        db.from("land_relations").select("id", { count: "exact", head: true }).eq("land_id", delTarget.id),
      ]);
      const totalIrr = (invCnt ?? 0) + (irrCnt ?? 0);
      if (totalIrr > 0 || (relCnt ?? 0) > 0) {
        toast.error(`Cannot delete: linked to ${totalIrr} irrigation entries and ${relCnt ?? 0} relations.`);
        return;
      }
      const { error } = await db.from("lands").update({ deleted_at: new Date().toISOString() } as any).eq("id", delTarget.id);
      if (error) { toast.error(error.message); return; }
      toast.success(t("pgLandDeleted" as any));
      setDelTarget(null);
      loadAll();
    } finally { setDeleting(false); }
  }

  if (!farmer) return <div className="text-muted-foreground">{t("pgLoadingDots" as any)}</div>;

  const totalDeposits = savings.filter(s => s.status === "approved" && s.type === "deposit").reduce((a, s) => a + Number(s.amount), 0);
  const totalWithdraws = savings.filter(s => s.status === "approved" && s.type === "withdraw").reduce((a, s) => a + Number(s.amount), 0);
  const savingsBal = totalDeposits - totalWithdraws;
  const loanDue = loans.filter(l => l.status === "approved").reduce((a, l) => {
    const paid = (l.loan_payments ?? []).reduce((x: number, p: any) => x + Number(p.amount), 0);
    return a + (Number(l.total_payable) - paid);
  }, 0);
  // Irrigation due now sourced from irrigation_invoices (legacy irrigation_charges removed from UI).
  const irrDue = invDue;

  const buildLocLine = (l: LandRow) => {
    const parts = [l.division_name, l.district_name, l.upazila_name, l.union_name, l.ward_name, l.village_name, l.mouza_name].filter(Boolean);
    return parts.length ? parts.join(" › ") : (l.mouza ?? "-");
  };

  function levelLabel(level: LocationLevel) {
    const map: Record<LocationLevel, string> = {
      division: t("division"), district: t("district"), upazila: t("upazila"),
      union: t("union"), ward: t("ward"), village: t("village"), mouza: t("mouza"),
    };
    return map[level];
  }

  async function uploadFarmerPhoto(file: File): Promise<string | undefined> {
    const ext = file.name.split(".").pop();
    const path = `farmers/${Date.now()}.${ext}`;
    const { error } = await db.storage.from("farmer-photos").upload(path, file);
    if (error) { toast.error(error.message); return undefined; }
    return db.storage.from("farmer-photos").getPublicUrl(path).data.publicUrl;
  }

  function openFarmerEdit() {
    setEditFarmerLocErr(null);
    setEditFarmerPhoto(null);
    setEditFarmerForm({
      ...farmer,
      office_id: farmer.office_id ?? "",
      voter_number: farmer.voter_number ?? "",
      account_number: farmer.account_number ?? farmer.voter_number ?? "",
      division_id: farmer.division_id ?? null,
      district_id: farmer.district_id ?? null,
      upazila_id: farmer.upazila_id ?? null,
      union_id: farmer.union_id ?? null,
      ward_id: farmer.ward_id ?? null,
      village_id: farmer.village_id ?? null,
      mouza_id: farmer.mouza_id ?? null,
    });
    setEditFarmerOpen(true);
  }

  async function saveFarmerEdit() {
    if (!editFarmerForm) return;
    if (!String(editFarmerForm.name_en ?? "").trim()) return toast.error(tx("Name (English) is required", "ইংরেজি নাম আবশ্যক"));
    if (editFarmerForm.member_no) {
      const { data: dup } = await db.rpc("member_no_exists" as any, { _member_no: String(editFarmerForm.member_no).trim(), _exclude_id: editFarmerForm.id ?? null });
      if (dup === true) return toast.error(t("duplicateFarmerId"));
    }
    setEditFarmerSaving(true);
    try {
      let photo_url: string | undefined;
      if (editFarmerPhoto) {
        photo_url = await uploadFarmerPhoto(editFarmerPhoto);
        if (!photo_url) return;
      }
      const payload = toFarmerUpdatePayload(editFarmerForm, photo_url ? { photo_url } : {});
      const { error } = await db.from("farmers").update(payload as any).eq("id", editFarmerForm.id);
      if (error) {
        const lvl = parseLocationDbError(error.message);
        if (lvl) setEditFarmerLocErr({ level: lvl, message: tx(`Invalid ${levelLabel(lvl)} selection`, `${levelLabel(lvl)} নির্বাচন সঠিক নয়`) });
        else toast.error(error.message);
        return;
      }
      toast.success(t("farmerUpdated"));
      setEditFarmerOpen(false);
      setEditFarmerForm(null);
      setEditFarmerPhoto(null);
      loadAll();
    } finally { setEditFarmerSaving(false); }
  }

  return (
    <>
      <PageHeader title={lang === "bn" ? (farmer.name_bn || farmer.name_en) : farmer.name_en}
        description={`${farmer.member_no ?? farmer.farmer_code} • ${farmer.offices?.name ?? ""}`}
        actions={<>
          <ReceiptSettingsButton />
          <Button
            variant={farmer.status === "inactive" ? "default" : "outline"}
            onClick={async () => {
              const next = farmer.status === "active" ? "inactive" : "active";
              const { error } = await db.from("farmers").update({ status: next } as any).eq("id", farmer.id);
              if (error) return toast.error(error.message);
              setFarmer((p: any) => p ? { ...p, status: next } : p);
              toast.success(next === "active" ? tx("Member activated", "সদস্য সক্রিয় করা হয়েছে") : tx("Member marked inactive", "সদস্য নিষ্ক্রিয় করা হয়েছে"));
            }}
          >
            {farmer.status === "inactive" ? tx("Activate", "সক্রিয় করুন") : tx("Make Inactive", "নিষ্ক্রিয় করুন")}
          </Button>
          <Button variant="outline" onClick={openFarmerEdit}><Pencil className="h-4 w-4 mr-1" />{t("edit")}</Button>
          <Button variant="outline" onClick={() => nav(`/payments?farmer=${farmer.id}`)}><Receipt className="h-4 w-4 mr-1" />{t("payNow")}</Button>
          <Button variant="outline" onClick={() => nav(`/farmers/${farmer.id}/card`)}><IdCard className="h-4 w-4 mr-1" />{t("pgPrintCard")}</Button>
          <Button variant="outline" onClick={() => nav(`/farmers/${farmer.id}/report?print=1`)}><Printer className="h-4 w-4 mr-1" />{t("print")}</Button>
          <Button onClick={() => nav(`/farmers/${farmer.id}/report`)}>
            <FileDown className="h-4 w-4 mr-1" />{t("exportPdf")}
          </Button>
        </>}
      />

      <Card className="p-5 mb-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <Avatar className="h-24 w-24">
            {farmer.photo_url && <AvatarImage src={farmer.photo_url} />}
            <AvatarFallback className="bg-primary text-primary-foreground text-2xl">{farmer.name_en[0]}</AvatarFallback>
          </Avatar>
          <div className="grid flex-1 min-w-0 grid-cols-2 gap-x-4 gap-y-3 text-sm md:grid-cols-4">
            <div className="min-w-0"><div className="text-xs text-muted-foreground">{t("pgFarmerId")}</div><div className="font-mono font-semibold break-all">{formatId5(farmer.member_no ?? farmer.farmer_code)}</div></div>
            <div className="min-w-0"><div className="text-xs text-muted-foreground">{t("nameEn")}</div><div className="font-medium break-words">{farmer.name_en}</div></div>
            <div className="min-w-0"><div className="text-xs text-muted-foreground">{t("nameBn")}</div><div className="font-medium break-words">{farmer.name_bn ?? "-"}</div></div>
            <div className="min-w-0"><div className="text-xs text-muted-foreground">{t("fatherName")}</div><div className="break-words">{farmer.father_name ?? "-"}</div></div>
            <div className="min-w-0"><div className="text-xs text-muted-foreground">{t("motherName")}</div><div className="break-words">{farmer.mother_name ?? "-"}</div></div>
            <div className="min-w-0"><div className="text-xs text-muted-foreground">{t("nid")}</div><div className="font-mono break-all">{farmer.nid ?? "-"}</div></div>
            <div className="min-w-0"><div className="text-xs text-muted-foreground">{t("mobile")}</div><div className="break-all">{farmer.mobile ?? "-"}</div></div>
            <div className="min-w-0"><div className="text-xs text-muted-foreground">{t("pgVoterNumber")}</div><div className="font-mono break-all">{farmer.voter_number ? formatId5(farmer.voter_number) : "—"}</div></div>
            <div className="col-span-2 md:col-span-4 min-w-0"><div className="text-xs text-muted-foreground">{t("village")} / {t("pgLocation")}</div><div className="text-sm break-words">{farmerLocationLine(farmer)}</div></div>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-md border bg-card p-2">
            <QRCodeSVG value={`${window.location.origin}/scan?acc=${formatId5(farmer.member_no ?? farmer.farmer_code)}`} size={96} />
            <div className="text-[10px] text-muted-foreground">{t("qrCode")}</div>
            <div className="font-mono text-[10px]">{formatId5(farmer.member_no ?? farmer.farmer_code)}</div>
          </div>
        </div>
      </Card>

      {(farmer.nominee_name || farmer.nominee_mobile || farmer.nominee_relation || farmer.nominee_nid || farmer.nominee_address) && (
        <Card className="p-4 mb-4">
          <div className="text-xs font-semibold text-muted-foreground mb-2">
            {tx("Nominee Information", "নমিনির তথ্য")}
          </div>
          <div className="grid gap-x-4 gap-y-2 text-sm grid-cols-2 md:grid-cols-4">
            <div className="min-w-0"><div className="text-xs text-muted-foreground">{tx("Nominee Name", "নমিনির নাম")}</div><div className="break-words font-medium">{farmer.nominee_name ?? "—"}</div></div>
            <div className="min-w-0"><div className="text-xs text-muted-foreground">{tx("Relation", "সম্পর্ক")}</div><div className="break-words">{farmer.nominee_relation ?? "—"}</div></div>
            <div className="min-w-0"><div className="text-xs text-muted-foreground">{tx("Mobile", "মোবাইল")}</div><div className="break-all">{farmer.nominee_mobile ?? "—"}</div></div>
            <div className="min-w-0"><div className="text-xs text-muted-foreground">{tx("NID", "এনআইডি")}</div><div className="font-mono break-all">{farmer.nominee_nid ?? "—"}</div></div>
            {farmer.nominee_address && (
              <div className="col-span-2 md:col-span-4 min-w-0"><div className="text-xs text-muted-foreground">{tx("Address", "ঠিকানা")}</div><div className="text-sm break-words">{farmer.nominee_address}</div></div>
            )}
          </div>
        </Card>
      )}

      {!toBool(farmer.is_voter) && (
        <Card className="p-3 mb-4 border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 text-sm">
          ⚠️ {tx("This farmer is not enabled as Voter / Savings A/C. No savings, loan or share data will exist. Toggle Voter from Edit above to enable.", "এই ফার্মার Voter / Savings A/C হিসেবে এনাবল নেই। সঞ্চয়, ঋণ এবং শেয়ার সংক্রান্ত কোন তথ্য বা ট্রাঞ্জেকশন থাকবে না। এনাবল করতে উপরে Edit থেকে Voter টগল চালু করুন।")}
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4 mb-4">
        {toBool(farmer.is_voter) && <div className="stat-card"><div className="text-xs text-muted-foreground">{t("totalSavings")}</div><div className="text-xl font-bold mt-1">{money(savingsBal)}</div></div>}
        {toBool(farmer.is_voter) && <div className="stat-card"><div className="text-xs text-muted-foreground">{t("shareBalance")}</div><div className="text-xl font-bold mt-1">{money(share?.balance ?? 0)}</div></div>}
        
        <div className="stat-card"><div className="text-xs text-muted-foreground">{t("irrigation")} {t("dueAmount")}</div><div className={"text-xl font-bold mt-1 " + (irrDue > 0 ? "due-text" : "")}>{money(irrDue)}</div></div>
      </div>

      <Tabs defaultValue="lands">
        <TabsList>
          <TabsTrigger value="lands">{t("lands")}</TabsTrigger>
          <TabsTrigger value="own_lands">{tx("Own Lands", "নিজের জমি")}</TabsTrigger>
          
          <TabsTrigger value="land_history">{tx("Land History", "ভূমির ইতিহাস")}</TabsTrigger>
          <TabsTrigger value="land_transfers">{tx("Transfer History", "হস্তান্তর ইতিহাস")}</TabsTrigger>
          {borgaOut.length > 0 && <TabsTrigger value="owned_borga">{tx("Owned (Borga)", "মালিকানাধীন জমি")}</TabsTrigger>}
          {toBool(farmer.is_voter) && <TabsTrigger value="savings">{t("savings")}</TabsTrigger>}
          {toBool(farmer.is_voter) && <TabsTrigger value="loans">{tx("Loans", "ঋণ")}</TabsTrigger>}
          <TabsTrigger value="statement">{t("statement")}</TabsTrigger>
          
          <TabsTrigger value="irr_invoices">{t("irrigation")}</TabsTrigger>
          <TabsTrigger value="payments">{t("pgPaymentsTab")}</TabsTrigger>
          {toBool(farmer.is_voter) && <TabsTrigger value="shares">{t("shareBalance")}</TabsTrigger>}
          <TabsTrigger value="notes">{tx("Notes", "নোট")}</TabsTrigger>
        </TabsList>

        <TabsContent value="lands">
          <Card>
            <div className="flex flex-wrap justify-end gap-2 p-3 border-b">
              <Button size="sm" variant="outline" disabled={lands.length === 0}
                onClick={() => exportLandsPdf({ name_en: farmer.name_en, account_number: farmer.account_number, farmer_code: farmer.farmer_code }, lands.map((l) => ({ ...l, field_type_label: landTypeLabel(landTypeRows, (l as any).land_type_id, l.field_type) || undefined })))}>
                <FileText className="h-4 w-4 mr-1" />{t("pgExportPdf" as any)}
              </Button>
              <Button size="sm" variant="outline" disabled={lands.length === 0}
                onClick={() => exportLandsExcel({ name_en: farmer.name_en, account_number: farmer.account_number, farmer_code: farmer.farmer_code }, lands.map((l) => ({ ...l, field_type_label: landTypeLabel(landTypeRows, (l as any).land_type_id, l.field_type) || undefined })))}>
                <FileSpreadsheet className="h-4 w-4 mr-1" />{t("pgExportExcel" as any)}
              </Button>
              <Dialog open={openLand} onOpenChange={(o) => {
                setOpenLand(o);
                if (!o) { setLand({ ...EMPTY_LAND }); setLandLoc({}); setLandLocErr(null); }
              }}>
                <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />{t("addNew")}</Button></DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>{t("addNew")} — {t("lands")}</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    {/* 1. Owner Type + Owner */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>{t("ownerType")} <span className="text-destructive">*</span></Label>
                        <Select value={land.owner_type} disabled={savingLand} onValueChange={v => { setLand({ ...EMPTY_LAND, owner_type: v }); setLandLoc({}); setLandLocErr(null); }}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="owner">{t("owner")}</SelectItem><SelectItem value="borgadar">{t("borgadar")}</SelectItem></SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>{t("owner")} {land.owner_type === "borgadar" ? <span className="text-destructive">*</span> : <span className="text-xs text-muted-foreground">(auto)</span>}</Label>
                        {land.owner_type === "borgadar" ? (
                          <FarmerSearchSelect
                            value={land.owner_farmer_id || null}
                            onChange={(fid) => { setLand({ ...EMPTY_LAND, owner_type: "borgadar", owner_farmer_id: fid ?? "" }); setLandLoc({}); }}
                            excludeIds={[id!]}
                            placeholder={t("selectOwnerSearch" as any)}
                            disabled={savingLand}
                          />
                        ) : (
                          <Input disabled value={farmer?.name_en ?? ""} />
                        )}
                      </div>
                    </div>

                    {/* 2a. Borgadar: pick Dag from owner's lands → auto-fills size, field_type, location */}
                    {land.owner_type === "borgadar" && land.owner_farmer_id && (
                      <div>
                        <Label>{t("dagNo")} <span className="text-destructive">*</span></Label>
                        <Select
                          value={land.dag_no || ""}
                          disabled={savingLand || ownerLandsLoading}
                          onValueChange={(v) => {
                            const src = ownerLands.find((o) => o.dag_no === v);
                            if (src) {
                              setLand({
                                ...land,
                                dag_no: v,
                                owner_land_id: src.id ?? "",
                                land_size: Number(src.land_size ?? 0),
                                field_type: src.field_type ?? land.field_type,
                                land_type_id: src.land_type_id ?? land.land_type_id,
                              });
                              setLandLoc({
                                division_id: src.division_id ?? null,
                                district_id: src.district_id ?? null,
                                upazila_id: src.upazila_id ?? null,
                                mouza_id: src.mouza_id ?? null,
                                mouza_name: src.mouza_name ?? null,
                              });
                              setLandLocErr(null);
                            } else {
                              setLand({ ...land, dag_no: v });
                            }
                          }}
                        >
                          <SelectTrigger><SelectValue placeholder={ownerLandsLoading ? t("loading" as any) : (ownerLands.length ? t("selectDagFromOwner" as any) : t("ownerHasNoLands" as any))} /></SelectTrigger>
                          <SelectContent>
                            {ownerLands.map((o) => (
                              <SelectItem key={o.id} value={o.dag_no ?? ""}>
                                {o.dag_no} — {o.land_size} {t("decimal" as any)} {o.mouza_name ? `(${o.mouza_name})` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* 2b. Location picker — for owner: manual entry; for borgadar: shown auto-filled (still editable) */}
                    {(land.owner_type === "owner" || (land.owner_type === "borgadar" && land.owner_farmer_id)) && (
                      <div>
                        <Label className="text-sm font-medium mb-2 block">{t("mouza" as any) || "মৌজা"} <span className="text-destructive">*</span></Label>
                        <MouzaSelect
                          value={(landLoc as any).mouza_name ?? ""}
                          placeholder={t("mouza" as any) || "মৌজা"}
                          onChange={(name) => { setLandLoc({ mouza_name: name } as any); if (landLocErr) setLandLocErr(null); }}
                        />
                        {landLocErr?.message && <p className="text-xs text-destructive mt-1">{landLocErr.message}</p>}
                      </div>
                    )}

                    {/* 3. For owner only: Dag No input */}
                    {land.owner_type === "owner" && (() => {
                      const live = land.dag_no.trim() ? validateDagNumbers(land.dag_no) : null;
                      const liveErr = live && live.ok === false ? live.error : null;
                      const preview = live && live.ok ? live.values.join(", ") : null;
                      return (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>{t("dagNo")} <span className="text-destructive">*</span></Label>
                            <Input
                              disabled={savingLand}
                              value={land.dag_no}
                              onChange={e => { setLand({ ...land, dag_no: e.target.value }); if (landDagDupErr) setLandDagDupErr(null); }}
                              onBlur={e => { const norm = normalizeDagInput(e.target.value); if (norm && norm !== land.dag_no) setLand({ ...land, dag_no: norm }); }}
                              placeholder="123, 124/A, 125-B"
                              aria-invalid={!!liveErr || !!landDagDupErr}
                              className={(liveErr || landDagDupErr) ? "border-destructive focus-visible:ring-destructive" : undefined}
                            />
                            {liveErr ? (
                              <p className="text-xs text-destructive mt-1">{liveErr} — {tx("Please separate with commas; only digits/letters/", "দয়া করে কমা দিয়ে আলাদা করুন এবং শুধু সংখ্যা/অক্ষর/")}<code>/</code>/<code>-</code>{tx(" allowed.", " ব্যবহার করুন।")}</p>
                            ) : (
                              <p className="text-xs text-muted-foreground mt-1">
                                {tx("Separate multiple Dag numbers with comma (,). Allowed: digits, letters, ", "একাধিক দাগ নং কমা (,) দিয়ে আলাদা করুন। অনুমোদিত: সংখ্যা, অক্ষর, ")}<code>/</code> {tx("and", "ও")} <code>-</code> {tx("(max 200 chars each). Examples:", "(প্রতিটি সর্বোচ্চ ২০০ অক্ষর)। উদাহরণ:")} <code>123</code>, <code>124/A</code>, <code>1-250</code>
                                {preview && preview !== land.dag_no.trim() && <> — {tx("will be saved as:", "সংরক্ষণে রূপান্তরিত হবে:")} <strong>{preview}</strong></>}
                              </p>
                            )}
                            {landDagDupErr && <p role="alert" className="text-xs text-destructive mt-1">{landDagDupErr}</p>}
                          </div>
                        </div>
                      );
                    })()}

                    {/* 4. Land size + Field type */}
                    {(land.owner_type === "owner" || (land.owner_type === "borgadar" && land.owner_farmer_id)) && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>{t("landSize")} ({t("decimal" as any)}) <span className="text-destructive">*</span></Label>
                          <Input disabled={savingLand} type="number" step="0.0001" value={land.land_size} onChange={e => {
                            const r = parseLandInput(e.target.value);
                            if (r.error === "precision") toast.error(tx("Land size allows up to 3 decimals only", "জমির পরিমাণ সর্বোচ্চ ৩ দশমিক পর্যন্ত"));
                            setLand({ ...land, land_size: r.value });
                          }} />
                        </div>
                        <div>
                          <Label>{t("fieldType")} <span className="text-destructive">*</span></Label>
                          <LandTypeSelect
                            landTypeId={land.land_type_id}
                            fieldType={land.field_type}
                            disabled={savingLand}
                            onChange={(id, ft) => setLand({ ...land, land_type_id: id, field_type: ft })}
                          />
                        </div>
                      </div>
                    )}

                    {/* Calculation breakdown: land size × rate → amount + rounding */}
                    {(land.owner_type === "owner" || (land.owner_type === "borgadar" && land.owner_farmer_id)) && land.land_size > 0 && (() => {
                      const matched = resolveRateForLand(rateMap, land as any);
                      const rate = matched ? Number(matched.rate_per_shotok) : 0;
                      return <LandAmountBreakdown landSize={land.land_size} rate={rate} label={tx("Irrigation", "সেচ")} />;
                    })()}

                    {/* 5. Patwari */}
                    {(land.owner_type === "owner" || (land.owner_type === "borgadar" && land.owner_farmer_id)) && (
                      <div>
                        <Label>{tx("Patwari", "পাটুয়ারি")}</Label>
                        <Select value={land.patwari_id || "__none__"} disabled={savingLand} onValueChange={v => setLand({ ...land, patwari_id: v === "__none__" ? "" : v })}>
                          <SelectTrigger><SelectValue placeholder={tx("Select patwari", "পাটুয়ারি নির্বাচন করুন")} /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">{tx("— None —", "— নেই —")}</SelectItem>
                            {patwaris.map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.name_bn || p.name}{p.mobile ? ` (${p.mobile})` : ""}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Per-land note (shown later in the lands list) */}
                    <div>
                      <Label>{tx("Note (optional)", "নোট (ঐচ্ছিক)")}</Label>
                      <Textarea disabled={savingLand} rows={2} value={land.notes} maxLength={2000}
                        onChange={e => setLand({ ...land, notes: e.target.value.slice(0, 2000) })}
                        placeholder={tx("e.g. disputed land, partial owner, special remark", "যেমন: বিরোধপূর্ণ জমি, আংশিক মালিক, বিশেষ মন্তব্য")} />
                      <div className="text-[10px] text-muted-foreground text-right">{(land.notes ?? "").length}/2000</div>
                    </div>
                  </div>
                  <DialogFooter><Button variant="outline" disabled={savingLand} onClick={() => setOpenLand(false)}>{t("cancel")}</Button><Button onClick={addLand} disabled={savingLand}>{savingLand ? "…" : t("save")}</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            {seasonOptions.length > 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground border-b bg-muted/30 flex flex-wrap items-center gap-2">
                <span>{tx("Season:", "মৌসুম:")}</span>
                <Select value={viewSeasonId ?? undefined} onValueChange={(v) => setViewSeasonId(v)}>
                  <SelectTrigger className="h-7 w-auto min-w-[140px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {seasonOptions.map((s) => (
                      <SelectItem key={s.id} value={s.id} className="text-xs">
                        {s.label}{s.id === activeSeasonId ? ` (${tx("current", "চলতি")})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span>— {tx("Rate, Total & Payment Status are based on this season", "Rate, Total ও Payment Status এই মৌসুম অনুযায়ী")}</span>
              </div>
            )}
            {(() => {
              const statuses = lands.map((l) => landSeasonStatus(l.id).state);
              const paidCount = statuses.filter((s) => s === "paid").length;
              const partialCount = statuses.filter((s) => s === "partial").length;
              const dueCount = statuses.filter((s) => s === "due").length;
              const noneCount = statuses.filter((s) => s === "none").length;
              return (
                <div className="px-3 py-2 flex flex-wrap items-center gap-3 text-sm border-b">
                  <span className="font-medium">{tx("Total Lands", "মোট জমি")}: <strong>{lands.length}</strong></span>
                  <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600">{tx("Paid", "পরিশোধিত")}: {paidCount}</Badge>
                  {partialCount > 0 && <Badge variant="default" className="bg-amber-500 hover:bg-amber-500">{tx("Partially Paid", "আংশিক পরিশোধিত")}: {partialCount}</Badge>}
                  <Badge variant="destructive">{tx("Due", "বকেয়া")}: {dueCount}</Badge>
                  {noneCount > 0 && <Badge variant="secondary">{tx("No invoice", "ইনভয়েস নেই")}: {noneCount}</Badge>}
                  <div className="ml-auto flex items-center gap-2">
                    <Input
                      value={noteSearch}
                      onChange={(e) => setNoteSearch(e.target.value)}
                      placeholder={tx("Search by note…", "নোট দিয়ে খুঁজুন…")}
                      className="h-8 w-[180px] text-xs"
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="h-8 w-[180px] text-xs justify-start font-normal">
                          {landTypeFilter.length === 0
                            ? tx("All land types", "সব জমির ধরন")
                            : tx(`${landTypeFilter.length} type(s)`, `${landTypeFilter.length} ধরন`)}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="max-h-[300px] overflow-auto">
                        {landTypeRows.map((lt) => (
                          <DropdownMenuCheckboxItem
                            key={lt.id}
                            checked={landTypeFilter.includes(lt.id)}
                            onCheckedChange={(c) =>
                              setLandTypeFilter((prev) => (c ? [...prev, lt.id] : prev.filter((x) => x !== lt.id)))
                            }
                            onSelect={(e) => e.preventDefault()}
                          >
                            {lt.name_bn || lt.name}
                          </DropdownMenuCheckboxItem>
                        ))}
                        {landTypeFilter.length > 0 && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => setLandTypeFilter([])}>
                              {tx("Clear", "মুছুন")}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Select value={paymentFilter} onValueChange={(v) => setPaymentFilter(v as any)}>
                      <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{tx("All", "সব")}</SelectItem>
                        <SelectItem value="paid">{tx("Paid only", "শুধু পরিশোধিত")}</SelectItem>
                        <SelectItem value="due">{tx("Due only", "শুধু বকেয়া")}</SelectItem>
                      </SelectContent>
                    </Select>
                    {(landTypeFilter.length > 0 || paymentFilter !== "all" || noteSearch.trim()) && (
                      <Button
                        variant="ghost"
                        className="h-8 px-2 text-xs"
                        onClick={() => { setLandTypeFilter([]); setPaymentFilter("all"); setNoteSearch(""); }}
                      >
                        {tx("Reset", "রিসেট")}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })()}
            {hiddenInvoiceCount > 0 && (
              <div className="px-3 py-2 flex flex-wrap items-center gap-3 text-sm border-b bg-amber-50 text-amber-900">
                <span>
                  ⚠️ {tx(
                    `${hiddenInvoiceCount} invoice(s) are hidden because they are assigned to another office (or no office). Their status may show as "No invoice".`,
                    `${hiddenInvoiceCount} টি ইনভয়েস অন্য অফিসে (বা কোনো অফিস ছাড়া) থাকায় লুকানো আছে। এগুলোর স্ট্যাটাস "ইনভয়েস নেই" দেখাতে পারে।`
                  )}
                </span>
                {isSuper && (
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={backfilling} onClick={handleBackfillInvoiceOffice}>
                    {backfilling ? tx("Fixing…", "ঠিক করা হচ্ছে…") : tx("Fix office assignment", "অফিস ঠিক করুন")}
                  </Button>
                )}
              </div>
            )}
            {(() => {
              const missing = lands.filter((l: any) => !l.land_type_id);
              if (missing.length === 0) return null;
              return (
                <div className="px-3 py-2 flex flex-wrap items-center gap-2 text-sm border-b bg-red-50 text-red-900">
                  <span>
                    ⚠️ {tx(
                      `${missing.length} land(s) have no land type selected and may show as "Others". Click to edit:`,
                      `${missing.length} টি জমিতে কোনো জমির ধরন নির্বাচন করা নেই এবং "Others" দেখাতে পারে। সম্পাদনা করতে ক্লিক করুন:`
                    )}
                  </span>
                  {missing.map((l: any) => (
                    <Link key={l.id} to={`/lands/${l.id}`} className="underline font-medium">
                      {l.dag_no || l.id.slice(0, 6)}
                    </Link>
                  ))}
                </div>
              );
            })()}
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t("pgLocation")}</TableHead>
                <TableHead>{t("dagNo")}</TableHead>
                <TableHead className="text-right">{t("landSize")}</TableHead>
                <TableHead>{t("ownerType")}</TableHead>
                <TableHead>{tx("Owner", "মালিক")}</TableHead>
                <TableHead>{tx("Patwari", "পাটুয়ারি")}</TableHead>
                <TableHead>{t("fieldType")}</TableHead>
                <TableHead className="text-right">{tx("Rate / Shotok", "রেট/শতক")}</TableHead>
                <TableHead className="text-right">{tx("Total Amount", "মোট টাকা")}</TableHead>
                <TableHead>{tx("Irrigation Charge", "সেচ চার্জ")}</TableHead>
                <TableHead>{tx("Payment Status", "পেমেন্ট স্ট্যাটাস")}</TableHead>
                <TableHead className="text-right">{t("actions")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(() => {
                  const matchesNote = (l: any) => {
                    const q = noteSearch.trim().toLowerCase();
                    if (!q) return true;
                    const parts = [landSelfNotes[l.id], ...(landNotes[l.id] ?? [])].filter(Boolean).join(" ").toLowerCase();
                    return parts.includes(q);
                  };
                  const matchesFilter = (l: any) => {
                    if (!matchesNote(l)) return false;
                    if (landTypeFilter.length > 0 && !landTypeFilter.includes((l.land_type_id ?? "") as string)) return false;
                    if (paymentFilter === "all") return true;
                    const s = landSeasonStatus(l.id).state;
                    if (paymentFilter === "paid") return s === "paid";
                    return s === "due" || s === "partial";
                  };
                  // "Lands" tab = what the farmer actually cultivates:
                  //  • own lands' remaining self-cultivated area (exclude fully borga-given)
                  //  • lands taken in as a sharecropper (borga-in)
                  const ownRows = lands
                    .filter(l => l.owner_type === "owner" && matchesFilter(l))
                    .map(l => {
                      const size = Number(l.land_size || 0);
                      const given = Math.min(size, Math.max(0, Number(borgaGivenMap[l.id] || 0)));
                      const selfArea = Math.max(0, +(size - given).toFixed(4));
                      return { ...l, land_size: selfArea };
                    })
                    .filter(l => Number(l.land_size) > 0.0001);
                  const borgaRows = lands.filter(l => l.owner_type !== "owner" && matchesFilter(l));
                  const renderRow = (l: any) => {
                    const matched = resolveRateForLand(rateMap, l);
                    const rate = matched ? Number(matched.rate_per_shotok) : 0;
                    const total = rate * Number(l.land_size || 0);
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="text-xs max-w-md whitespace-normal">{buildLocLine(l)}</TableCell>
                        <TableCell><Link to={`/lands/${l.id}`} className="underline">{l.dag_no}</Link>
                          <LandNoteCell
                            landId={l.id}
                            officeId={l.office_id ?? null}
                            note={landSelfNotes[l.id] ?? ""}
                            onSaved={(n) => setLandSelfNotes((p) => ({ ...p, [l.id]: n }))}
                          />
                        </TableCell>
                        <TableCell className="text-right">{fmtLand(l.land_size)}</TableCell>
                        <TableCell>{t((l.owner_type as any) ?? "")}</TableCell>
                        <TableCell className="text-xs">
                          {l.owner_type === "owner"
                            ? <span className="text-muted-foreground">{tx("Self-owned", "নিজ মালিক")}</span>
                            : (l.owner_farmer_id ? (
                                <Link to={`/farmers/${l.owner_farmer_id}`} className="underline text-primary">
                                  {ownerNames[l.owner_farmer_id] ?? "—"}
                                </Link>
                              ) : "—")}
                        </TableCell>
                        <TableCell className="text-xs">{l.patwari_name_bn || l.patwari_name || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell>{landTypeLabel(landTypeRows, (l as any).land_type_id, l.field_type) || t((l.field_type as any) ?? "")}</TableCell>
                        <TableCell className="text-right">{rate ? money2(rate) : <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="text-right">{rate ? money2(total) : <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell>
                          {(() => {
                            const m = landSeasonStatus(l.id);
                            if (m.state === "none") return <span className="text-muted-foreground text-xs">{tx("No invoice", "ইনভয়েস নেই")}</span>;
                            const isDue = m.due > 0.005;
                            return (
                              <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={() => downloadLandInvoices(l.id)}>
                                <FileDown className="h-3.5 w-3.5" />
                                {isDue ? tx("Invoice", "ইনভয়েস") : tx("Receipt", "রসিদ")}
                              </Button>
                            );
                          })()}
                        </TableCell>

                        <TableCell>
                          {(() => {
                            const m = landSeasonStatus(l.id);
                            if (m.state === "none") return <span className="text-muted-foreground text-xs">—</span>;
                            const isDue = m.due > 0.005;
                            const badge = isDue
                              ? <Badge variant="destructive">{tx("Due", "বকেয়া")} {money(m.due)}</Badge>
                              : <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600">{tx("Paid", "পরিশোধিত")}</Badge>;
                            const pay = landPayMap[l.id];
                            return (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild><span className="cursor-help">{badge}</span></TooltipTrigger>
                                  <TooltipContent>
                                    <div className="text-xs space-y-0.5">
                                      <div>{tx("Payable", "প্রদেয়")}: {money(m.payable ?? 0)}</div>
                                      <div>{tx("Paid", "পরিশোধিত")}: {money(m.paid ?? 0)}</div>
                                      <div>{tx("Due", "বকেয়া")}: {money(m.due ?? 0)}</div>
                                      {pay?.lastDate && <div>{tx("Last payment", "সর্বশেষ পেমেন্ট")}: {fmtDate(pay.lastDate)}</div>}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          })()}
                        </TableCell>



                        <TableCell className="text-right">
                          {l._borga_in ? (
                            <span className="text-xs text-muted-foreground">{tx("Sharecropped (read-only)", "বর্গা চাষ (শুধু দেখা)")}</span>
                          ) : (
                            <>
                              <EditButton onClick={() => openEdit(l)} title={t("edit")} />
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setTransferLand(l)} title={tx("Transfer / Distribute", "হস্তান্তর / বণ্টন")}>
                                {tx("Transfer", "হস্তান্তর")}
                              </Button>
                              {l.owner_type === "borgadar" && l.owner_farmer_id && (
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setReclaimLand(l)} title={tx("Reclaim to Owner", "মালিকে ফেরত")}>
                                  {tx("Reclaim", "ফেরত")}
                                </Button>
                              )}
                              <DeleteButton onClick={() => setDelTarget(l)} title={t("delete")} />
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  };
                  const subtotalRow = (label: string, rows: any[]) => {
                    if (!rows.length) return null;
                    const sizeSum = rows.reduce((s, l) => s + Number(l.land_size || 0), 0);
                    const amtSum = rows.reduce((s, l) => {
                      const m = resolveRateForLand(rateMap, l);
                      return s + (m ? Number(m.rate_per_shotok) * Number(l.land_size || 0) : 0);
                    }, 0);
                    return (
                      <TableRow className="bg-muted/40 font-semibold">
                        <TableCell colSpan={2} className="text-right">{label} ({tx("Subtotal", "উপ-মোট")})</TableCell>
                        <TableCell className="text-right">{fmtLand(sizeSum)}</TableCell>
                        <TableCell colSpan={5} />
                        <TableCell className="text-right">{money2(amtSum)}</TableCell>
                        <TableCell />
                        <TableCell />
                        <TableCell />
                      </TableRow>
                    );
                  };
                  const sectionHeader = (label: string) => (
                    <TableRow className="bg-primary/10">
                      <TableCell colSpan={12} className="font-bold text-sm py-2">{label}</TableCell>
                    </TableRow>
                  );
                  const out: React.ReactNode[] = [];
                  if (ownRows.length) {
                    out.push(<React.Fragment key="own-h">{sectionHeader(tx("Own Land", "নিজের জমি"))}</React.Fragment>);
                    ownRows.forEach(l => out.push(renderRow(l)));
                    out.push(<React.Fragment key="own-st">{subtotalRow(tx("Own Land", "নিজের জমি"), ownRows)}</React.Fragment>);
                  }
                  if (borgaRows.length) {
                    out.push(<React.Fragment key="borga-h">{sectionHeader(tx("Borga Land", "বর্গা জমি"))}</React.Fragment>);
                    borgaRows.forEach(l => out.push(renderRow(l)));
                    out.push(<React.Fragment key="borga-st">{subtotalRow(tx("Borga Land", "বর্গা জমি"), borgaRows)}</React.Fragment>);
                  }
                  if (lands.length > 0) {
                    const totalSize = lands.reduce((s, l) => s + Number(l.land_size || 0), 0);
                    const totalAmt = lands.reduce((s, l) => {
                      const m = resolveRateForLand(rateMap, l);
                      return s + (m ? Number(m.rate_per_shotok) * Number(l.land_size || 0) : 0);
                    }, 0);
                    out.push(
                      <TableRow key="grand" className="bg-muted/70 font-bold border-t-2">
                        <TableCell colSpan={2} className="text-right">{tx("Grand Total", "সর্বমোট")}</TableCell>
                        <TableCell className="text-right">{fmtLand(totalSize)}</TableCell>
                        <TableCell colSpan={5} />
                        <TableCell className="text-right">{money2(totalAmt)}</TableCell>
                        <TableCell />
                        <TableCell />
                        <TableCell />
                      </TableRow>
                    );
                  } else {
                    out.push(<TableRow key="empty"><TableCell colSpan={12} className="text-center text-muted-foreground">{t("noData")}</TableCell></TableRow>);
                  }
                  return out;
                })()}
              </TableBody>
            </Table>
          </Card>

        </TabsContent>

        <TabsContent value="own_lands">
          <OwnLandsTab
            lands={lands}
            rateMap={rateMap}
            resolveRateForLand={resolveRateForLand}
            landSeasonStatus={landSeasonStatus}
            buildLocLine={buildLocLine}
            fmtLand={fmtLand}
            t={t as any}
            tx={tx}
            farmer={{ name_en: farmer.name_en, account_number: farmer.account_number, farmer_code: farmer.farmer_code }}
            downloadLandInvoices={downloadLandInvoices}
            openEdit={openEdit}
            onDelete={setDelTarget}
            borgaOut={borgaOut}
            borgaGivenMap={borgaGivenMap}

          />
        </TabsContent>


        <TabsContent value="land_history">
          <Card className="mb-4">
            <div className="p-3 border-b font-medium">
              {tx("Give Borga / Transfer / Distribute Land", "জমি বর্গা / হস্তান্তর / বণ্টন করুন")}
              <div className="text-xs text-muted-foreground font-normal mt-1">
                {tx("Select a land below to give it on borga to a sharecropper, sell/transfer it to a new owner, or distribute it among heirs.", "নিচ থেকে জমি নির্বাচন করে বর্গাদারকে বর্গা দিন, নতুন মালিকের কাছে বিক্রি/হস্তান্তর করুন, অথবা উত্তরাধিকারীদের মাঝে বণ্টন করুন।")}
              </div>
            </div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t("pgLocation")}</TableHead>
                <TableHead>{t("dagNo")}</TableHead>
                <TableHead className="text-right">{t("landSize")}</TableHead>
                <TableHead>{t("ownerType")}</TableHead>
                <TableHead className="text-right">{t("actions")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {lands.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">{tx("No lands", "কোনো জমি নেই")}</TableCell></TableRow>
                ) : lands.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs max-w-md whitespace-normal">{buildLocLine(l)}</TableCell>
                    <TableCell><Link to={`/lands/${l.id}`} className="underline">{l.dag_no}</Link></TableCell>
                    <TableCell className="text-right">{fmtLand(l.land_size)}</TableCell>
                    <TableCell>{t((l.owner_type as any) ?? "")}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setTransferLand(l)}>
                        {tx("Transfer / Borga", "হস্তান্তর / বর্গা")}
                      </Button>
                      {l.owner_type === "borgadar" && l.owner_farmer_id && (
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setReclaimLand(l)}>
                          {tx("Reclaim", "ফেরত")}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          <FarmerLandHistoryTab farmerId={id!} />
        </TabsContent>

        <TabsContent value="land_transfers">
          <Card className="p-3">
            <LandTransferHistoryTab farmerId={id!} />
          </Card>
        </TabsContent>

        <TabsContent value="owned_borga">
          <Card>
            <div className="p-3 border-b font-medium">
              {tx("Lands you own that are sharecropped by others", "আপনার মালিকানার জমি যা অন্যরা বর্গা চাষ করছেন")}
            </div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>{tx("Dag", "দাগ")}</TableHead>
                <TableHead>{tx("Mouza", "মৌজা")}</TableHead>
                <TableHead>{tx("Area", "জমির পরিমাণ")}</TableHead>
                <TableHead>{tx("Sharecropper", "বর্গাদার")}</TableHead>
                <TableHead>{tx("Latest Invoice", "সর্বশেষ ইনভয়েস")}</TableHead>
                <TableHead>{tx("Status", "স্ট্যাটাস")}</TableHead>
                <TableHead className="text-right">{t("actions")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {borgaOut.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                    {tx("No sharecropped lands", "কোনো বর্গা জমি নেই")}
                  </TableCell></TableRow>
                )}
                {borgaOut.map((l) => {
                  const inv = l.latest_invoice;
                  const due = inv ? Number(inv.due_amount || 0) : 0;
                  const status = !inv ? "—" : (due <= 0 ? tx("Paid", "পরিশোধিত") : tx("Due", "বকেয়া"));
                  return (
                    <TableRow key={l.id}>
                      <TableCell>{l.dag_no || (l.dag_numbers || []).join(", ") || "—"}</TableCell>
                      <TableCell>{l.mouza_name || l.mouza || "—"}</TableCell>
                      <TableCell>{l.land_size}</TableCell>
                      <TableCell>
                        {l.tenant ? (
                          <Link to={`/farmers/${l.tenant.id}`} className="underline text-primary">
                            {l.tenant.name_bn || l.tenant.name_en}
                            {l.tenant.farmer_code ? <span className="text-xs text-muted-foreground"> ({l.tenant.farmer_code})</span> : null}
                          </Link>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {inv ? `${fmtDate((inv.generated_at || "").slice(0,10))} · ৳${inv.payable_amount}` : "—"}
                      </TableCell>
                      <TableCell>
                        {inv ? (
                          <Badge variant={due <= 0 ? "default" : "destructive"}>{status}</Badge>
                        ) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
                          onClick={() => setReclaimLand({ ...l, owner_farmer_id: id })}>
                          {tx("Reclaim", "ফেরত")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>





        <TabsContent value="savings">
          <Card><Table>
            <TableHeader><TableRow>
              <TableHead>{t("date")}</TableHead><TableHead>{t("type")}</TableHead>
              <TableHead>{t("amount")}</TableHead><TableHead>{t("status")}</TableHead>
              <TableHead className="text-right">{t("actions")}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {savings.map(s => (
                <TableRow key={s.id}>
                  <TableCell>{fmtDate(s.txn_date)}</TableCell>
                  <TableCell>{t(s.type as any)}</TableCell>
                  <TableCell>{money(s.amount)}</TableCell>
                  <TableCell><Badge>{t(s.status as any)}</Badge></TableCell>
                  <TableCell className="text-right">
                    <ReceiptCopyMenu onSelect={(c) => printSavings(s, c)} title={t("print")} />
                    {isSuper && <DeleteButton onConfirm={() => deleteSavings(s)} title={t("delete")} />}
                  </TableCell>
                </TableRow>
              ))}
              {savings.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{t("noData")}</TableCell></TableRow>}
            </TableBody>
          </Table></Card>
        </TabsContent>

        <TabsContent value="loans">
          <Card>
            <div className="px-4 py-3 border-b flex flex-wrap items-center gap-3">
              <div className="text-sm"><span className="text-muted-foreground">{tx("Loan Due (Principal)", "ঋণ বাকি (আসল)")}: </span><span className="font-bold">{money(loanDue)}</span></div>
              <Button asChild size="sm" variant="outline" className="ml-auto"><Link to="/loans"><Plus className="h-4 w-4 mr-1" />{tx("Issue Loan", "ঋণ ইস্যু")}</Link></Button>
            </div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>{tx("Issued", "ইস্যু")}</TableHead>
                <TableHead className="text-right">{tx("Principal", "আসল")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead className="text-right">{t("actions")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {loans.map((l: any) => (
                  <TableRow key={l.id}>
                    <TableCell>{fmtDate(l.issued_on)}</TableCell>
                    <TableCell className="text-right font-mono">{money(l.principal)}</TableCell>
                    <TableCell><Badge variant={l.status === "approved" ? "default" : l.status === "pending" ? "secondary" : "outline"}>{l.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      {l.status === "approved" && <Button size="sm" variant="ghost" onClick={() => setViewLoan(l)}><FileText className="h-4 w-4 mr-1" />{tx("Statement", "স্টেটমেন্ট")}</Button>}
                    </TableCell>
                  </TableRow>
                ))}
                {loans.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">{t("noData")}</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>


        <TabsContent value="statement">
          <SavingsStatement farmer={farmer} />
        </TabsContent>




        <TabsContent value="irr_invoices">
          <IrrigationInvoicesTab farmerId={farmer.id} />
        </TabsContent>

        <TabsContent value="payments">
          <Card><Table>
            <TableHeader><TableRow>
              <TableHead>{t("date")}</TableHead>
              <TableHead>{t("type")}</TableHead>
              <TableHead>{t("pgMethod")}</TableHead>
              <TableHead className="text-right">{t("amount")}</TableHead>
              <TableHead>{t("pgOffice")}</TableHead>
              <TableHead className="text-right">{t("pgReceipt")}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{fmtDate(p.created_at)}</TableCell>
                  <TableCell><Badge variant="secondary">{p.kind}</Badge></TableCell>
                  <TableCell>{p.method ?? "cash"}</TableCell>
                  <TableCell className="text-right tabular-nums font-mono">{money(p.amount)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.offices?.name ?? "-"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className="mr-2"
                      onClick={() => {
                        const [row] = buildPaidHistory(Number(p.amount || 0), [
                          { receipt_no: p.receipt_no, amount: Number(p.amount || 0), paid_at: p.created_at, method: p.method },
                        ], { kind: "IRR", seed: p.id });
                        setReceiptRow(row);
                        setReceiptOpen(true);
                      }}
                    >
                      {tx("Preview", "প্রিভিউ")}
                    </Button>
                    <ReceiptCopyMenu size="sm" label={t("pgDownload" as any)} onSelect={(c) => reprintReceipt(p, c)} />
                    {isSuper && <DeleteButton onConfirm={() => deletePayment(p)} title={t("delete")} />}
                  </TableCell>
                </TableRow>
              ))}
              {payments.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{t("noData")}</TableCell></TableRow>
              )}
            </TableBody>
          </Table></Card>
        </TabsContent>

        <TabsContent value="shares">
          <Card>
            <div className="px-4 py-3 border-b flex flex-wrap items-center gap-3">
              <div className="text-sm">
                <span className="text-muted-foreground">{t("shareBalance")}: </span>
                <span className="font-bold">{money(share?.balance ?? 0)}</span>
              </div>
              <Button asChild size="sm" variant="outline" className="ml-auto">
                <Link to={`/share-collection?farmer=${id}`}><Plus className="h-4 w-4 mr-1" />{t("addNew")}</Link>
              </Button>
            </div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("type")}</TableHead>
                <TableHead className="text-right">{t("amount")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("note")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {savings.filter((s: any) => s.type === "share_collection" || s.type === "share_deposit").map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell>{fmtDate(s.txn_date ?? s.created_at)}</TableCell>
                    <TableCell><Badge variant="secondary">{s.type}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums font-mono">{money(s.amount)}</TableCell>
                    <TableCell><Badge variant={s.status === "approved" ? "default" : "outline"}>{s.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{s.note ?? "-"}</TableCell>
                  </TableRow>
                ))}
                {savings.filter((s: any) => s.type === "share_collection" || s.type === "share_deposit").length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">{t("noData")}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
        <TabsContent value="notes">
          <FarmerNotesTab farmerId={id!} />
        </TabsContent>
      </Tabs>

      <LandTransferDialog
        open={!!transferLand}
        onOpenChange={(v) => { if (!v) setTransferLand(null); }}
        sourceLand={transferLand}
        sourceFarmerId={id!}
        onDone={() => { setTransferLand(null); loadAll(); }}
      />

      <LandTransferDialog
        open={!!reclaimLand}
        onOpenChange={(v) => { if (!v) setReclaimLand(null); }}
        sourceLand={reclaimLand}
        sourceFarmerId={id!}
        reclaimOwnerId={reclaimLand?.owner_farmer_id ?? null}
        onDone={() => { setReclaimLand(null); loadAll(); }}
      />


      <Dialog open={editFarmerOpen} onOpenChange={(o) => { if (!o && !editFarmerSaving) { setEditFarmerOpen(false); setEditFarmerForm(null); setEditFarmerPhoto(null); setEditFarmerLocErr(null); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("edit")} — {lang === "bn" ? (farmer.name_bn || farmer.name_en) : farmer.name_en}</DialogTitle></DialogHeader>
          {editFarmerForm && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><Label>{t("nameEn")} *</Label><Input value={editFarmerForm.name_en ?? ""} disabled={editFarmerSaving} onChange={e => setEditFarmerForm({ ...editFarmerForm, name_en: e.target.value })} /></div>
                <div><Label>{t("nameBn")}</Label><Input value={editFarmerForm.name_bn ?? ""} disabled={editFarmerSaving} onChange={e => setEditFarmerForm({ ...editFarmerForm, name_bn: e.target.value })} /></div>
                <div><Label>{t("fatherName")}</Label><Input value={editFarmerForm.father_name ?? ""} disabled={editFarmerSaving} onChange={e => setEditFarmerForm({ ...editFarmerForm, father_name: e.target.value })} /></div>
                <div><Label>{t("motherName")}</Label><Input value={editFarmerForm.mother_name ?? ""} disabled={editFarmerSaving} onChange={e => setEditFarmerForm({ ...editFarmerForm, mother_name: e.target.value })} /></div>
                <div><Label>{t("nid")}</Label><Input value={editFarmerForm.nid ?? ""} disabled={editFarmerSaving} inputMode="numeric" maxLength={17} onChange={e => setEditFarmerForm({ ...editFarmerForm, nid: e.target.value })} /></div>
                <div><Label>{t("mobile")}</Label><Input value={editFarmerForm.mobile ?? ""} disabled={editFarmerSaving} inputMode="tel" maxLength={20} onChange={e => setEditFarmerForm({ ...editFarmerForm, mobile: e.target.value })} /></div>
                <div><Label>{t("farmerIdLabel")}</Label><Input value={editFarmerForm.member_no ?? ""} disabled={editFarmerSaving || !isSuper} maxLength={5} inputMode="numeric" onChange={e => setEditFarmerForm({ ...editFarmerForm, member_no: e.target.value.replace(/\D/g, "").slice(0, 5) })} /></div>
                <div><Label>{t("voterSavingsAccount")}</Label><Input value={editFarmerForm.voter_number ?? ""} disabled={editFarmerSaving || (!!farmer.voter_number && !isSuper)} maxLength={5} inputMode="numeric" onChange={e => { const v = e.target.value.replace(/\D/g, "").slice(0, 5); setEditFarmerForm({ ...editFarmerForm, voter_number: v, account_number: v, is_voter: !!v }); }} /></div>
                <div><Label>{t("office")}</Label><Select value={editFarmerForm.office_id || "__none__"} disabled={editFarmerSaving} onValueChange={v => setEditFarmerForm({ ...editFarmerForm, office_id: v === "__none__" ? "" : v })}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger><SelectContent><SelectItem value="__none__">—</SelectItem>{offices.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>{t("photo")}</Label><Input type="file" accept="image/*" disabled={editFarmerSaving} onChange={e => setEditFarmerPhoto(e.target.files?.[0] ?? null)} /></div>
                <div className="md:col-span-2"><Label>{t("address")}</Label><Input value={editFarmerForm.address ?? ""} disabled={editFarmerSaving} onChange={e => setEditFarmerForm({ ...editFarmerForm, address: e.target.value })} /></div>
              </div>
              <div className="border-t pt-3">
                <div className="text-xs font-semibold text-muted-foreground mb-2">{tx("Nominee Information", "নমিনির তথ্য")}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div><Label>{tx("Nominee Name", "নমিনির নাম")}</Label><Input value={editFarmerForm.nominee_name ?? ""} disabled={editFarmerSaving} onChange={e => setEditFarmerForm({ ...editFarmerForm, nominee_name: e.target.value })} /></div>
                  <div><Label>{tx("Nominee Mobile", "নমিনির মোবাইল")}</Label><Input value={editFarmerForm.nominee_mobile ?? ""} disabled={editFarmerSaving} onChange={e => setEditFarmerForm({ ...editFarmerForm, nominee_mobile: e.target.value })} /></div>
                  <div><Label>{tx("Relation", "সম্পর্ক")}</Label><Input value={editFarmerForm.nominee_relation ?? ""} disabled={editFarmerSaving} onChange={e => setEditFarmerForm({ ...editFarmerForm, nominee_relation: e.target.value })} /></div>
                  <div><Label>{tx("Nominee NID", "নমিনির এনআইডি")}</Label><Input value={editFarmerForm.nominee_nid ?? ""} disabled={editFarmerSaving} onChange={e => setEditFarmerForm({ ...editFarmerForm, nominee_nid: e.target.value })} /></div>
                  <div className="md:col-span-2"><Label>{tx("Nominee Address", "নমিনির ঠিকানা")}</Label><Input value={editFarmerForm.nominee_address ?? ""} disabled={editFarmerSaving} onChange={e => setEditFarmerForm({ ...editFarmerForm, nominee_address: e.target.value })} /></div>
                </div>
              </div>
              <div className="border-t pt-3">
                <div className="text-xs font-medium text-muted-foreground mb-2">{t("locationStrictHint")}</div>
                <LocationPicker mouzaOnly value={editFarmerForm} onChange={(loc) => { setEditFarmerForm({ ...editFarmerForm, ...loc }); setEditFarmerLocErr(null); }} errorLevel={(editFarmerLocErr?.level as any) ?? null} errorMessage={editFarmerLocErr?.message ?? null} labels={{ division: t("division"), district: t("district"), upazila: t("upazila"), village: t("village"), mouza: t("mouza") }} />
              </div>
              <DialogFooter><Button variant="outline" disabled={editFarmerSaving} onClick={() => setEditFarmerOpen(false)}>{t("cancel")}</Button><Button disabled={editFarmerSaving} onClick={saveFarmerEdit}>{editFarmerSaving ? "…" : t("save")}</Button></DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit land dialog */}
      <Dialog open={!!editLand} onOpenChange={(o) => { if (!o && !editSaving) { setEditLand(null); setEditLoc({}); setEditLocErr(null); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("pgEditLand")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium mb-2 block">{t("mouza" as any) || "মৌজা"} <span className="text-destructive">*</span></Label>
              <MouzaSelect
                value={(editLoc as any).mouza_name ?? ""}
                placeholder={t("mouza" as any) || "মৌজা"}
                onChange={(name) => { setEditLoc({ mouza_name: name } as any); if (editLocErr) setEditLocErr(null); }}
              />
              {editLocErr?.message && <p className="text-xs text-destructive mt-1">{editLocErr.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("dagNo")}</Label>
                {(() => {
                  const live = editForm.dag_no.trim() ? validateDagNumbers(editForm.dag_no) : null;
                  const liveErr = live && live.ok === false ? live.error : null;
                  const preview = live && live.ok ? live.values.join(", ") : null;
                  return (
                    <>
                      <Input
                        disabled={editSaving}
                        value={editForm.dag_no}
                        onChange={e => setEditForm({ ...editForm, dag_no: e.target.value })}
                        placeholder="123, 124/A, 125-B"
                        aria-invalid={!!liveErr}
                        className={liveErr ? "border-destructive focus-visible:ring-destructive" : undefined}
                      />
                      {liveErr ? (
                        <p className="text-xs text-destructive mt-1">{liveErr} — {tx("Separate with commas; only digits/letters/", "কমা দিয়ে আলাদা করুন; শুধু সংখ্যা/অক্ষর/")}<code>/</code>/<code>-</code>{tx(" allowed.", " অনুমোদিত।")}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-1">
                          {tx("Separate multiple Dag numbers with comma (,). Example:", "একাধিক দাগ নং কমা (,) দিয়ে আলাদা করুন। উদাহরণ:")} <code>123, 124/A, 125-B</code>
                          {preview && preview !== editForm.dag_no.trim() && <> — {tx("will be saved as:", "সংরক্ষণে রূপান্তরিত হবে:")} <strong>{preview}</strong></>}
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>
              <div><Label>{t("landSize")}</Label><Input disabled={editSaving} type="number" step="0.0001" value={editForm.land_size} onChange={e => {
                const r = parseLandInput(e.target.value);
                if (r.error === "precision") toast.error(tx("Land size allows up to 3 decimals only", "জমির পরিমাণ সর্বোচ্চ ৩ দশমিক পর্যন্ত"));
                setEditForm({ ...editForm, land_size: r.value });
              }} /></div>
              <div><Label>{t("ownerType")}</Label>
                <Select value={editForm.owner_type} disabled={editSaving} onValueChange={v => setEditForm({ ...editForm, owner_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="owner">{t("owner")}</SelectItem><SelectItem value="borgadar">{t("borgadar")}</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>{t("fieldType")} <span className="text-destructive">*</span></Label>
                <LandTypeSelect
                  landTypeId={editForm.land_type_id}
                  fieldType={editForm.field_type}
                  disabled={editSaving}
                  onChange={(id, ft) => setEditForm({ ...editForm, land_type_id: id, field_type: ft })}
                />
              </div>
            </div>
            <div>
              <Label>{tx("Patwari", "পাটুয়ারি")}</Label>
              <Select value={editForm.patwari_id || "__none__"} disabled={editSaving} onValueChange={v => setEditForm({ ...editForm, patwari_id: v === "__none__" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder={tx("Select patwari", "পাটুয়ারি নির্বাচন করুন")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{tx("— None —", "— নেই —")}</SelectItem>
                  {patwaris.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name_bn || p.name}{p.mobile ? ` (${p.mobile})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{tx("Note (optional)", "নোট (ঐচ্ছিক)")}</Label>
              <Textarea disabled={editSaving} rows={2} value={editForm.notes} maxLength={2000}
                onChange={e => setEditForm({ ...editForm, notes: e.target.value.slice(0, 2000) })}
                placeholder={tx("e.g. disputed land, partial owner, special remark", "যেমন: বিরোধপূর্ণ জমি, আংশিক মালিক, বিশেষ মন্তব্য")} />
              <div className="text-[10px] text-muted-foreground text-right">{(editForm.notes ?? "").length}/2000</div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={editSaving} onClick={() => setEditLand(null)}>{t("cancel")}</Button>
            <Button onClick={saveEdit} disabled={editSaving}>{editSaving ? "…" : t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!delTarget} onOpenChange={(o) => { if (!o && !deleting) setDelTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("pgDeleteLandTitle" as any)}</AlertDialogTitle>
            <AlertDialogDescription>
              {(t("pgDeleteLandDesc" as any) as string).replace("{dag}", String(delTarget?.dag_no ?? ""))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmDelete(); }} disabled={deleting}>
              {deleting ? "…" : t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!viewLoan} onOpenChange={(o) => { if (!o) setViewLoan(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{tx("Loan Statement", "ঋণ স্টেটমেন্ট")}</DialogTitle></DialogHeader>
          {viewLoan && <LoanStatement loanId={viewLoan.id} />}
        </DialogContent>
      </Dialog>
      <ReceiptPreviewModal
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        row={receiptRow}
        payable={receiptRow?.amount ?? 0}
        farmerName={farmer?.name_bn ?? farmer?.name_en}
      />
    </>

  );
}
