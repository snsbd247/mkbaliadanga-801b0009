import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Printer, FileDown, Receipt, Pencil, Trash2, FileSpreadsheet, FileText, IdCard } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { money, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { useNavigate } from "react-router-dom";

import { LocationPicker, type LocationValue } from "@/components/locations/LocationPicker";
import { parseLocationDbError, type LocationLevel } from "@/lib/locationValidation";
import { validateDagNumbers } from "@/lib/dagNumbers";
import { SavingsStatement } from "@/components/SavingsStatement";
import { EditButton, DeleteButton } from "@/components/ui/action-icon-button";
import { downloadBnReceiptPdf, type BnReceiptData } from "@/lib/bnReceipts";
import { autoReceiptNo } from "@/lib/receiptNo";
import { ReceiptCopyMenu } from "@/components/receipts/ReceiptCopyMenu";
import { ReceiptSettingsButton } from "@/components/receipts/ReceiptSettingsButton";
import IrrigationInvoicesTab from "@/components/farmers/IrrigationInvoicesTab";
import FarmerLandHistoryTab from "@/components/farmers/FarmerLandHistoryTab";
import FarmerNotesTab from "@/components/farmers/FarmerNotesTab";
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

type LandRow = LandExportRow & { id: string; mouza_id?: string | null; ward_id?: string | null; owner_farmer_id?: string | null };

const EMPTY_LAND = { dag_no: "", land_size: 0, owner_type: "owner", field_type: "medium_land", owner_farmer_id: "" as string | "", patwari_id: "" as string | "" };

export default function FarmerDetail() {
  const { id } = useParams<{ id: string }>();
  const { t, lang, tx } = useLang();
  const { isSuper } = useAuth();
  const nav = useNavigate();
  const [farmer, setFarmer] = useState<any>(null);
  const [lands, setLands] = useState<LandRow[]>([]);
  const [ownerNames, setOwnerNames] = useState<Record<string, string>>({});
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
  const [share, setShare] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [rateMap, setRateMap] = useState<RateRow[]>([]);
  const [activeSeasonName, setActiveSeasonName] = useState<string>("");
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
  const [savingLand, setSavingLand] = useState(false);
  const [ownerLands, setOwnerLands] = useState<any[]>([]);
  const [ownerLandsLoading, setOwnerLandsLoading] = useState(false);
  const [patwaris, setPatwaris] = useState<any[]>([]);
  const [transferLand, setTransferLand] = useState<any | null>(null);
  // Lands owned by this farmer that are given out to sharecroppers (borga)
  const [borgaOut, setBorgaOut] = useState<any[]>([]);

  // Load patwaris for assignment
  useEffect(() => {
    let qb = supabase.from("patwaris").select("id,name,name_bn,mobile").eq("is_active", true).order("name");
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
    let qb = supabase
      .from("lands_with_location")
      .select("id,dag_no,land_size,field_type,division_id,district_id,upazila_id,mouza_id,mouza_name,office_id")
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
    supabase.from("loan_plans").select("*").eq("is_active", true).then(({ data }) => setLoanPlans(data ?? []));
    supabase.from("offices").select("id,name").order("name").then(({ data }) => setOffices(data ?? []));
  }, []);
  useEffect(() => { document.title = `${farmer?.name_en ?? ""} — ${t("farmers")}`; }, [farmer, t]);

  async function loadAll() {
    const [f, l, s, ln, ir, sh, pm] = await Promise.all([
      supabase.from("farmers").select("*, offices(name), divisions(name,name_bn), districts(name,name_bn), upazilas(name,name_bn)").eq("id", id!).maybeSingle(),
      (supabase.from as any)("lands_with_location").select("*").eq("farmer_id", id!).order("created_at"),
      supabase.from("savings_transactions").select("*").eq("farmer_id", id!).is("deleted_at", null).order("txn_date", { ascending: false }),
      supabase.from("loans").select("*, loan_payments(amount,paid_on)").eq("farmer_id", id!).is("deleted_at", null).order("issued_on", { ascending: false }),
      supabase.from("irrigation_charges").select("*, seasons(name,year,type), lands(dag_no), patwaris(name,name_bn,mobile)").eq("farmer_id", id!).is("deleted_at", null).order("entry_date", { ascending: false }),
      supabase.from("shares").select("balance").eq("farmer_id", id!).maybeSingle(),
      supabase.from("payments").select("id, kind, amount, method, note, created_at, idempotency_key, office_id, verify_token, receipt_no, offices(name)").eq("farmer_id", id!).is("deleted_at", null).order("created_at", { ascending: false }).limit(200),
    ]);
    setFarmer(f.data); setLands((l.data as any) ?? []); setSavings(s.data ?? []);
    setLoans(ln.data ?? []); setIrr(ir.data ?? []); setShare(sh.data);
    setPayments(pm.data ?? []);

    // Fetch owner farmer names for borga lands
    const ownerIds = Array.from(new Set(((l.data as any) ?? []).map((x: any) => x.owner_farmer_id).filter(Boolean)));
    if (ownerIds.length) {
      const { data: owners } = await supabase.from("farmers").select("id,name_en,name_bn,farmer_code").in("id", ownerIds as string[]);
      const map: Record<string, string> = {};
      (owners ?? []).forEach((o: any) => { map[o.id] = o.name_bn || o.name_en || o.farmer_code || "—"; });
      setOwnerNames(map);
    } else setOwnerNames({});

    // Load borga lands where THIS farmer is the owner (given out to sharecroppers)
    try {
      const { data: bout } = await (supabase.from as any)("lands_with_location")
        .select("*")
        .eq("owner_farmer_id", id!)
        .eq("owner_type", "borgadar")
        .order("created_at");
      const rows = (bout as any[]) ?? [];
      const tenantIds = Array.from(new Set(rows.map((r) => r.farmer_id).filter(Boolean)));
      const tenantMap: Record<string, any> = {};
      if (tenantIds.length) {
        const { data: tenants } = await supabase.from("farmers")
          .select("id,name_en,name_bn,farmer_code,mobile").in("id", tenantIds as string[]);
        (tenants ?? []).forEach((t: any) => { tenantMap[t.id] = t; });
      }
      const landIds = rows.map((r) => r.id);
      const invMap: Record<string, any> = {};
      if (landIds.length) {
        const { data: invs } = await supabase.from("irrigation_invoices")
          .select("land_id,generated_at,payable_amount,paid_amount,due_amount")
          .in("land_id", landIds as string[])
          .is("deleted_at", null)
          .order("generated_at", { ascending: false });
        (invs ?? []).forEach((iv: any) => { if (!invMap[iv.land_id]) invMap[iv.land_id] = iv; });
      }
      setBorgaOut(rows.map((r) => ({ ...r, tenant: tenantMap[r.farmer_id], latest_invoice: invMap[r.id] })));
    } catch { setBorgaOut([]); }

    // Outstanding from new irrigation_invoices (replaces legacy irrigation_charges total)
    const inv = await supabase
      .from("irrigation_invoices")
      .select("land_id,payable_amount,paid_amount,due_amount,invoice_status")
      .eq("farmer_id", id!)
      .is("deleted_at", null);
    const invRows = inv.data ?? [];
    setInvDue(invRows.reduce((a: number, r: any) => a + Number(r.due_amount || 0), 0));
    // Per-land irrigation payment status (aggregate all invoices per land)
    const lim: Record<string, { payable: number; paid: number; due: number; count: number }> = {};
    invRows.forEach((r: any) => {
      if (!r.land_id || r.invoice_status === "cancelled") return;
      const m = lim[r.land_id] ?? { payable: 0, paid: 0, due: 0, count: 0 };
      m.payable += Number(r.payable_amount || 0);
      m.paid += Number(r.paid_amount || 0);
      m.due += Number(r.due_amount || 0);
      m.count += 1;
      lim[r.land_id] = m;
    });
    setLandInvMap(lim);

    // Load active season + per-land rate map (for Rate/Total columns in Land tab)
    try {
      const { data: sn } = await supabase
        .from("seasons")
        .select("id,name,year,type,status")
        .eq("status", "active")
        .order("year", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (sn?.id) {
        setActiveSeasonName(sn.name || `${sn.type} ${sn.year}`);
        const rows = await loadSeasonRateMap(sn.id, f.data?.office_id ?? null);
        setRateMap(rows);
      } else {
        setActiveSeasonName("");
        setRateMap([]);
      }
    } catch { /* non-fatal */ }
  }

  function farmerLocationLine(fr: any): string {
    if (!fr) return "—";
    const pick = (n: any) => n?.name_bn || n?.name || null;
    const parts = [
      pick(fr.divisions), pick(fr.districts), pick(fr.upazilas),
      pick(fr.unions), pick(fr.wards), pick(fr.villages), pick(fr.mouzas),
    ].filter(Boolean);
    if (parts.length) return parts.join(" › ");
    return fr.village || fr.address || "—";
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
  function commonReceipt(): Pick<BnReceiptData, "company_name" | "company_name_bn" | "logo_url" | "org"> {
    return {
      company_name: brand.company_name,
      company_name_bn: brand.company_name_bn,
      logo_url: brand.logo_url ?? null,
      org: receiptArgs.org,
    };
  }

  function reprintReceipt(p: any, copy: import("@/lib/bnReceipts").ReceiptCopy = "both") {
    if (!farmer) return;
    const k = (p.kind as string) || "savings";
    const kind: BnReceiptData["kind"] = k === "loan" ? "loan" : k === "irrigation" ? "irrigation" : "savings";
    const prefix = kind === "loan" ? "LOAN" : kind === "irrigation" ? "IRR" : "SAV";
    const description = p.note
      ?? (kind === "loan" ? "ঋণের কিস্তি গ্রহণ" : kind === "savings" ? "সঞ্চয় জমা গ্রহণ" : "সেচ চার্জ গ্রহণ");
    downloadBnReceiptPdf({
      kind,
      ...commonReceipt(),
      receipt_no: p.receipt_no || autoReceiptNo(prefix as any, p.id, new Date(p.created_at)),
      date: p.created_at,
      bill_info: kind === "irrigation" ? "সেচ চার্জ" : undefined,
      farmer: farmerForReceipt(),
      collected_amount: Number(p.amount),
      description,
      verify_url: p.verify_token ? `${window.location.origin}/r/${p.verify_token}` : null,
    }, copy, receiptArgs.options);
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
    }, copy, receiptArgs.options);
  }
  async function printIrrigation(i: any, copy: import("@/lib/bnReceipts").ReceiptCopy = "both") {
    const land = (lands || []).find((x: any) => x.id === i.land_id) as any;
    const pw = i.patwaris ?? null;

    // Land owner label: "নিজ" for self, otherwise "Owner Name (member_no)"
    let landOwnerLabel: string | null = null;
    if (land) {
      if (land.owner_type === "borgadar" && land.owner_farmer_id && land.owner_farmer_id !== farmer?.id) {
        const { data: own } = await supabase
          .from("farmers")
          .select("name_bn,name_en,member_no")
          .eq("id", land.owner_farmer_id)
          .maybeSingle();
        if (own) {
          landOwnerLabel = `${own.name_bn || own.name_en}${own.member_no ? " (" + own.member_no + ")" : ""}`;
        } else {
          landOwnerLabel = "—";
        }
      } else {
        landOwnerLabel = tx("Self", "নিজ");
      }
    }

    // Field type Bangla label
    const fieldTypeBn = ({
      high_land: tx("High land", "উঁচু জমি"),
      medium_land: tx("Medium land", "মাঝারি জমি"),
      low_land: tx("Low land", "নিচু জমি"),
      other: tx("Other", "অন্যান্য"),
    } as Record<string, string>)[land?.field_type as string] ?? null;

    // Full ledger outstanding for this farmer (sum of due across all open invoices)
    const { data: dueRows } = await supabase
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
      rate: baseCharge + extras,
      charge_amount: Number(i.total),
      previous_due: Number(i.previous_due_brought ?? 0),
      land_owner_label: landOwnerLabel,
      current_season_charge: baseCharge,
      penalty_amount: Number(i.penalty_amount ?? 0),
      maintenance_charge: Number(i.maintenance_charge ?? 0),
      canal_charge: Number(i.canal_charge ?? 0),
      total_outstanding: totalOutstanding,
      collected_from_outstanding: collectedFromOutstanding,
      remark: i.note ?? null,
      patwari_name: pw ? (pw.name_bn || pw.name) : null,
      patwari_mobile: pw?.mobile ?? null,
      collected_amount: Number(i.paid_amount || i.total),
    }, copy, receiptArgs.options);
  }
  async function deleteSavings(s: any) {
    if (!window.confirm("Delete this savings transaction?")) return;
    const { error } = await supabase.from("savings_transactions").update({ deleted_at: new Date().toISOString() } as any).eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success(t("pgDeleted" as any)); loadAll();
  }
  async function deleteIrrigation(i: any) {
    if (!window.confirm("Delete this irrigation entry?")) return;
    const { error } = await supabase.from("irrigation_charges").update({ deleted_at: new Date().toISOString() } as any).eq("id", i.id);
    if (error) return toast.error(error.message);
    toast.success(t("pgDeleted" as any)); loadAll();
  }
  async function deletePayment(p: any) {
    if (!window.confirm("Delete this payment?")) return;
    const { error } = await supabase.from("payments").update({ deleted_at: new Date().toISOString() } as any).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success(t("pgDeleted" as any)); loadAll();
  }

  async function addLand() {
    setLandLocErr(null);
    // Require location: division → district → upazila → mouza (village not used on lands form)
    const loc = landLoc as any;
    if (!loc.division_id) { setLandLocErr({ level: "division", message: t("locationInvalidMissingParent" as any) || "Please complete the location" }); return; }
    if (!loc.district_id) { setLandLocErr({ level: "district", message: t("locationInvalidMissingParent" as any) || "Please complete the location" }); return; }
    if (!loc.upazila_id)  { setLandLocErr({ level: "upazila",  message: t("locationInvalidMissingParent" as any) || "Please complete the location" }); return; }
    if (!loc.mouza_id)    { setLandLocErr({ level: "mouza",    message: t("mouzaRequired" as any) }); return; }
    if (!land.dag_no.trim()) return toast.error(t("dagRequired" as any));
    let canonicalDag = land.dag_no.trim();
    if (land.owner_type === "owner") {
      const dv = validateDagNumbers(land.dag_no);
      if (dv.ok === false) return toast.error(dv.error);
      canonicalDag = dv.values.join(", ");
    }
    if (!(land.land_size > 0)) return toast.error(t("landSizeRequired" as any));
    if (land.owner_type === "borgadar" && !land.owner_farmer_id) {
      return toast.error(t("ownerRequiredForBorgadar" as any));
    }
    setSavingLand(true);
    try {
      const { error } = await supabase.from("lands").insert({
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
        owner_farmer_id: land.owner_type === "borgadar" ? land.owner_farmer_id : null,
        patwari_id: land.patwari_id || null,
      } as any);
      if (error) { toast.error(error.message); return; }
      toast.success(t("saved")); setOpenLand(false);
      setLand({ ...EMPTY_LAND });
      setLandLoc({});
      loadAll();
    } finally { setSavingLand(false); }
  }

  async function openEdit(row: LandRow) {
    setEditLand(row);
    setEditForm({
      dag_no: row.dag_no ?? "",
      land_size: Number(row.land_size ?? 0),
      owner_type: (row.owner_type as any) ?? "owner",
      field_type: (row.field_type as any) ?? "medium_land",
      owner_farmer_id: ((row as any).owner_farmer_id as string) ?? "",
      patwari_id: ((row as any).patwari_id as string) ?? "",
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
      const { data: m } = await supabase
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
    try {
      const el = editLoc as any;
      if (!el.division_id) { setEditLocErr({ level: "division", message: t("locationInvalidMissingParent" as any) || "Please complete the location" }); return; }
      if (!el.district_id) { setEditLocErr({ level: "district", message: t("locationInvalidMissingParent" as any) || "Please complete the location" }); return; }
      if (!el.upazila_id)  { setEditLocErr({ level: "upazila",  message: t("locationInvalidMissingParent" as any) || "Please complete the location" }); return; }
      if (!el.mouza_id)    { setEditLocErr({ level: "mouza",    message: t("mouzaRequired" as any) || "Mouza required" }); return; }
      let canonicalDag = editForm.dag_no.trim();
      if (editForm.owner_type === "owner") {
        const dv = validateDagNumbers(editForm.dag_no);
        if (dv.ok === false) { toast.error(dv.error); return; }
        canonicalDag = dv.values.join(", ");
      }
      const { error } = await supabase.from("lands").update({
        mouza: (editLoc as any).mouza_name ?? "",
        division_id: (editLoc as any).division_id ?? null,
        district_id: (editLoc as any).district_id ?? null,
        upazila_id: (editLoc as any).upazila_id ?? null,
        mouza_id: (editLoc as any).mouza_id ?? null,
        dag_no: canonicalDag,
        land_size: editForm.land_size,
        owner_type: editForm.owner_type as any,
        field_type: editForm.field_type as any,
        patwari_id: editForm.patwari_id || null,
      } as any).eq("id", editLand.id);
      if (error) { toast.error(error.message); return; }
      toast.success(t("saved"));
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
        supabase.from("irrigation_invoices").select("id", { count: "exact", head: true }).eq("land_id", delTarget.id).is("deleted_at", null),
        supabase.from("irrigation_charges").select("id", { count: "exact", head: true }).eq("land_id", delTarget.id).is("deleted_at", null),
        supabase.from("land_relations").select("id", { count: "exact", head: true }).eq("land_id", delTarget.id),
      ]);
      const totalIrr = (invCnt ?? 0) + (irrCnt ?? 0);
      if (totalIrr > 0 || (relCnt ?? 0) > 0) {
        toast.error(`Cannot delete: linked to ${totalIrr} irrigation entries and ${relCnt ?? 0} relations.`);
        return;
      }
      const { error } = await supabase.from("lands").update({ deleted_at: new Date().toISOString() } as any).eq("id", delTarget.id);
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
    const { error } = await supabase.storage.from("farmer-photos").upload(path, file);
    if (error) { toast.error(error.message); return undefined; }
    return supabase.storage.from("farmer-photos").getPublicUrl(path).data.publicUrl;
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
      const { data: dup } = await supabase.rpc("member_no_exists" as any, { _member_no: String(editFarmerForm.member_no).trim(), _exclude_id: editFarmerForm.id ?? null });
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
      const { error } = await supabase.from("farmers").update(payload as any).eq("id", editFarmerForm.id);
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

      {!farmer.is_voter && (
        <Card className="p-3 mb-4 border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 text-sm">
          ⚠️ {tx("This farmer is not enabled as Voter / Savings A/C. No savings, loan or share data will exist. Toggle Voter from Edit above to enable.", "এই ফার্মার Voter / Savings A/C হিসেবে এনাবল নেই। সঞ্চয়, ঋণ এবং শেয়ার সংক্রান্ত কোন তথ্য বা ট্রাঞ্জেকশন থাকবে না। এনাবল করতে উপরে Edit থেকে Voter টগল চালু করুন।")}
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4 mb-4">
        {farmer.is_voter && <div className="stat-card"><div className="text-xs text-muted-foreground">{t("totalSavings")}</div><div className="text-xl font-bold mt-1">{money(savingsBal)}</div></div>}
        {farmer.is_voter && <div className="stat-card"><div className="text-xs text-muted-foreground">{t("shareBalance")}</div><div className="text-xl font-bold mt-1">{money(share?.balance ?? 0)}</div></div>}
        
        <div className="stat-card"><div className="text-xs text-muted-foreground">{t("irrigation")} {t("dueAmount")}</div><div className={"text-xl font-bold mt-1 " + (irrDue > 0 ? "due-text" : "")}>{money(irrDue)}</div></div>
      </div>

      <Tabs defaultValue="lands">
        <TabsList>
          <TabsTrigger value="lands">{t("lands")}</TabsTrigger>
          <TabsTrigger value="paid_lands">{tx("Paid Lands", "পরিশোধিত জমি")}</TabsTrigger>
          <TabsTrigger value="land_history">{tx("Land History", "ভূমির ইতিহাস")}</TabsTrigger>
          <TabsTrigger value="land_transfers">{tx("Transfer History", "হস্তান্তর ইতিহাস")}</TabsTrigger>
          {borgaOut.length > 0 && <TabsTrigger value="owned_borga">{tx("Owned (Borga)", "মালিকানাধীন জমি")}</TabsTrigger>}
          {farmer.is_voter && <TabsTrigger value="savings">{t("savings")}</TabsTrigger>}
          <TabsTrigger value="statement">{t("statement")}</TabsTrigger>
          {farmer.is_voter && <TabsTrigger value="loans">{t("loans")}</TabsTrigger>}
          <TabsTrigger value="irr_invoices">{t("irrigation")}</TabsTrigger>
          <TabsTrigger value="payments">{t("pgPaymentsTab")}</TabsTrigger>
          {farmer.is_voter && <TabsTrigger value="shares">{t("shareBalance")}</TabsTrigger>}
          <TabsTrigger value="notes">{tx("Notes", "নোট")}</TabsTrigger>
        </TabsList>

        <TabsContent value="lands">
          <Card>
            <div className="flex flex-wrap justify-end gap-2 p-3 border-b">
              <Button size="sm" variant="outline" disabled={lands.length === 0}
                onClick={() => exportLandsPdf({ name_en: farmer.name_en, account_number: farmer.account_number, farmer_code: farmer.farmer_code }, lands)}>
                <FileText className="h-4 w-4 mr-1" />{t("pgExportPdf" as any)}
              </Button>
              <Button size="sm" variant="outline" disabled={lands.length === 0}
                onClick={() => exportLandsExcel({ name_en: farmer.name_en, account_number: farmer.account_number, farmer_code: farmer.farmer_code }, lands)}>
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
                                land_size: Number(src.land_size ?? 0),
                                field_type: src.field_type ?? land.field_type,
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
                        <Label className="text-sm font-medium mb-2 block">{t("location" as any) || "Location"}</Label>
                        <LocationPicker
                          value={landLoc}
                          onChange={(v) => { setLandLoc(v); if (landLocErr) setLandLocErr(null); }}
                          errorLevel={landLocErr?.level ?? null}
                          errorMessage={landLocErr?.message ?? null}
                          showVillage={false}
                        />
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
                              onChange={e => setLand({ ...land, dag_no: e.target.value })}
                              placeholder="123, 124/A, 125-B"
                              aria-invalid={!!liveErr}
                              className={liveErr ? "border-destructive focus-visible:ring-destructive" : undefined}
                            />
                            {liveErr ? (
                              <p className="text-xs text-destructive mt-1">{liveErr} — {tx("Please separate with commas; only digits/letters/", "দয়া করে কমা দিয়ে আলাদা করুন এবং শুধু সংখ্যা/অক্ষর/")}<code>/</code>/<code>-</code>{tx(" allowed.", " ব্যবহার করুন।")}</p>
                            ) : (
                              <p className="text-xs text-muted-foreground mt-1">
                                {tx("Separate multiple Dag numbers with comma (,). Example:", "একাধিক দাগ নং কমা (,) দিয়ে আলাদা করুন। উদাহরণ:")} <code>123, 124/A, 125-B</code>
                                {preview && preview !== land.dag_no.trim() && <> — {tx("will be saved as:", "সংরক্ষণে রূপান্তরিত হবে:")} <strong>{preview}</strong></>}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* 4. Land size + Field type */}
                    {(land.owner_type === "owner" || (land.owner_type === "borgadar" && land.owner_farmer_id)) && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>{t("landSize")} ({t("decimal" as any)}) <span className="text-destructive">*</span></Label>
                          <Input disabled={savingLand} type="number" step="0.01" value={land.land_size} onChange={e => setLand({ ...land, land_size: +e.target.value })} />
                        </div>
                        <div>
                          <Label>{t("fieldType")}</Label>
                          <Select value={land.field_type} disabled={savingLand} onValueChange={v => setLand({ ...land, field_type: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="high_land">{t("highLand")}</SelectItem>
                              <SelectItem value="medium_land">{t("mediumLand")}</SelectItem>
                              <SelectItem value="low_land">{t("lowLand")}</SelectItem>
                              <SelectItem value="other">{t("other")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

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
                  </div>
                  <DialogFooter><Button variant="outline" disabled={savingLand} onClick={() => setOpenLand(false)}>{t("cancel")}</Button><Button onClick={addLand} disabled={savingLand}>{savingLand ? "…" : t("save")}</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            {activeSeasonName && (
              <div className="px-3 py-2 text-xs text-muted-foreground border-b bg-muted/30">
                {tx("Current season:", "চলতি মৌসুম:")} <span className="font-medium text-foreground">{activeSeasonName}</span> — {tx("Rate & Total are based on this season's irrigation rate", "Rate ও Total এই মৌসুমের সেচ রেট অনুযায়ী")}
              </div>
            )}
            {(() => {
              const statuses = lands.map((l) => {
                const m = landInvMap[l.id];
                if (!m || m.count === 0) return "none";
                return m.due > 0.005 ? "due" : "paid";
              });
              const paidCount = statuses.filter((s) => s === "paid").length;
              const dueCount = statuses.filter((s) => s === "due").length;
              const noneCount = statuses.filter((s) => s === "none").length;
              return (
                <div className="px-3 py-2 flex flex-wrap items-center gap-3 text-sm border-b">
                  <span className="font-medium">{tx("Total Lands", "মোট জমি")}: <strong>{lands.length}</strong></span>
                  <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600">{tx("Paid", "পরিশোধিত")}: {paidCount}</Badge>
                  <Badge variant="destructive">{tx("Due", "বকেয়া")}: {dueCount}</Badge>
                  {noneCount > 0 && <Badge variant="secondary">{tx("No invoice", "ইনভয়েস নেই")}: {noneCount}</Badge>}
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
                <TableHead className="text-right">{t("actions")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(() => {
                  const ownRows = lands.filter(l => l.owner_type === "owner");
                  const borgaRows = lands.filter(l => l.owner_type !== "owner");
                  const renderRow = (l: any) => {
                    const matched = resolveRateForLand(rateMap, l);
                    const rate = matched ? Number(matched.rate_per_shotok) : 0;
                    const total = rate * Number(l.land_size || 0);
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="text-xs max-w-md whitespace-normal">{buildLocLine(l)}</TableCell>
                        <TableCell><Link to={`/lands/${l.id}`} className="underline">{l.dag_no}</Link></TableCell>
                        <TableCell className="text-right">{Number(l.land_size).toFixed(2)}</TableCell>
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
                        <TableCell>{t((l.field_type as any) ?? "")}</TableCell>
                        <TableCell className="text-right">{rate ? money(rate) : <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="text-right">{rate ? money(total) : <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell>
                          {(() => {
                            const m = landInvMap[l.id];
                            if (!m || m.count === 0) return <span className="text-muted-foreground text-xs">{tx("No invoice", "ইনভয়েস নেই")}</span>;
                            return m.due > 0.005
                              ? <Badge variant="destructive">{tx("Due", "বকেয়া")} {money(m.due)}</Badge>
                              : <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600">{tx("Paid", "পরিশোধিত")}</Badge>;
                          })()}
                        </TableCell>
                        <TableCell className="text-right">
                          <EditButton onClick={() => openEdit(l)} title={t("edit")} />
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setTransferLand(l)} title={tx("Transfer / Distribute", "হস্তান্তর / বণ্টন")}>
                            {tx("Transfer", "হস্তান্তর")}
                          </Button>
                          <DeleteButton onClick={() => setDelTarget(l)} title={t("delete")} />
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
                        <TableCell className="text-right">{sizeSum.toFixed(2)}</TableCell>
                        <TableCell colSpan={5} />
                        <TableCell className="text-right">{money(amtSum)}</TableCell>
                        <TableCell />
                        <TableCell />
                      </TableRow>
                    );
                  };
                  const sectionHeader = (label: string) => (
                    <TableRow className="bg-primary/10">
                      <TableCell colSpan={11} className="font-bold text-sm py-2">{label}</TableCell>
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
                        <TableCell className="text-right">{totalSize.toFixed(2)}</TableCell>
                        <TableCell colSpan={5} />
                        <TableCell className="text-right">{money(totalAmt)}</TableCell>
                        <TableCell />
                        <TableCell />
                      </TableRow>
                    );
                  } else {
                    out.push(<TableRow key="empty"><TableCell colSpan={11} className="text-center text-muted-foreground">{t("noData")}</TableCell></TableRow>);
                  }
                  return out;
                })()}
              </TableBody>
            </Table>
          </Card>

        </TabsContent>

        <TabsContent value="paid_lands">
          <Card>
            <div className="p-3 border-b font-medium">
              {tx("Lands with fully paid irrigation charge", "যে জমিগুলোর সেচ চার্জ সম্পূর্ণ পরিশোধিত")}
            </div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t("pgLocation")}</TableHead>
                <TableHead>{t("dagNo")}</TableHead>
                <TableHead className="text-right">{t("landSize")}</TableHead>
                <TableHead>{t("ownerType")}</TableHead>
                <TableHead className="text-right">{tx("Paid Amount", "পরিশোধিত টাকা")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(() => {
                  const paidLands = lands.filter((l) => {
                    const m = landInvMap[l.id];
                    return m && m.count > 0 && m.due <= 0.005;
                  });
                  if (paidLands.length === 0) {
                    return <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">{tx("No fully paid lands", "কোনো সম্পূর্ণ পরিশোধিত জমি নেই")}</TableCell></TableRow>;
                  }
                  return paidLands.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs max-w-md whitespace-normal">{buildLocLine(l)}</TableCell>
                      <TableCell><Link to={`/lands/${l.id}`} className="underline">{l.dag_no}</Link></TableCell>
                      <TableCell className="text-right">{Number(l.land_size).toFixed(2)}</TableCell>
                      <TableCell>{t((l.owner_type as any) ?? "")}</TableCell>
                      <TableCell className="text-right">{money(landInvMap[l.id]?.paid ?? 0)}</TableCell>
                    </TableRow>
                  ));
                })()}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>


        <TabsContent value="land_history">
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
              </TableRow></TableHeader>
              <TableBody>
                {borgaOut.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">
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

        <TabsContent value="statement">
          <SavingsStatement farmer={farmer} />
        </TabsContent>

        <TabsContent value="loans">
          <Card><Table>
            <TableHeader><TableRow>
              <TableHead>{t("issuedOn")}</TableHead><TableHead>{t("principal")}</TableHead>
              <TableHead>{t("interestRate")}</TableHead><TableHead>{t("totalPayable")}</TableHead>
              <TableHead className="text-right">পরিশোধিত</TableHead>
              <TableHead className="text-right">বাকি</TableHead>
              <TableHead>{t("nextDue")}</TableHead><TableHead>{t("status")}</TableHead>
              <TableHead className="text-right">{t("actions")}</TableHead>
            </TableRow></TableHeader>
            <TableBody>{(() => {
              const totals = loans.reduce((acc, l) => {
                const paid = (l.loan_payments ?? []).reduce((a: number, p: any) => a + Number(p.amount), 0);
                const due = Math.max(0, Number(l.total_payable) - paid);
                acc.principal += Number(l.principal || 0);
                acc.payable += Number(l.total_payable || 0);
                acc.paid += paid; acc.due += due;
                return acc;
              }, { principal: 0, payable: 0, paid: 0, due: 0 });
              return (<>
                {loans.map(l => {
                  const paid = (l.loan_payments ?? []).reduce((a: number, p: any) => a + Number(p.amount), 0);
                  const due = Math.max(0, Number(l.total_payable) - paid);
                  return (
                    <TableRow key={l.id}>
                      <TableCell>{fmtDate(l.issued_on)}</TableCell>
                      <TableCell>{money(l.principal)}</TableCell>
                      <TableCell>{l.interest_rate}%</TableCell>
                      <TableCell>{money(l.total_payable)}</TableCell>
                      <TableCell className="text-right text-success">{money(paid)}</TableCell>
                      <TableCell className={`text-right ${due > 0 ? "text-destructive font-semibold" : ""}`}>{money(due)}</TableCell>
                      <TableCell className={due > 0 ? "due-text" : ""}>{fmtDate(l.next_due_on)}</TableCell>
                      <TableCell><Badge>{t(l.status as any)}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => nav(`/loans/${l.id}`)} title={t("view" as any)}><FileText className="h-4 w-4" /></Button>
                        <ReceiptCopyMenu onSelect={(c) => printLoan(l, c)} title={t("print")} />
                        {isSuper && <EditButton onClick={() => editLoanGoto(l)} title={t("edit")} />}
                        {isSuper && <DeleteButton onConfirm={() => deleteLoan(l)} title={t("delete")} />}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {loans.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">{t("noData")}</TableCell></TableRow>}
                {loans.length > 0 && (
                  <TableRow className="bg-muted/70 font-bold border-t-2">
                    <TableCell className="text-right">সর্বমোট ({loans.length})</TableCell>
                    <TableCell>{money(totals.principal)}</TableCell>
                    <TableCell></TableCell>
                    <TableCell>{money(totals.payable)}</TableCell>
                    <TableCell className="text-right text-success">{money(totals.paid)}</TableCell>
                    <TableCell className="text-right text-destructive">{money(totals.due)}</TableCell>
                    <TableCell colSpan={3}></TableCell>
                  </TableRow>
                )}
              </>);
            })()}</TableBody>
          </Table></Card>
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
                <LocationPicker value={editFarmerForm} onChange={(loc) => { setEditFarmerForm({ ...editFarmerForm, ...loc }); setEditFarmerLocErr(null); }} errorLevel={(editFarmerLocErr?.level as any) ?? null} errorMessage={editFarmerLocErr?.message ?? null} labels={{ division: t("division"), district: t("district"), upazila: t("upazila"), village: t("village"), mouza: t("mouza") }} />
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
              <Label className="text-sm font-medium mb-2 block">{t("pgLocation")}</Label>
              <LocationPicker value={editLoc} onChange={(v) => { setEditLoc(v); if (editLocErr) setEditLocErr(null); }}
                errorLevel={editLocErr?.level ?? null} errorMessage={editLocErr?.message ?? null} showVillage={false} />
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
              <div><Label>{t("landSize")}</Label><Input disabled={editSaving} type="number" step="0.01" value={editForm.land_size} onChange={e => setEditForm({ ...editForm, land_size: +e.target.value })} /></div>
              <div><Label>{t("ownerType")}</Label>
                <Select value={editForm.owner_type} disabled={editSaving} onValueChange={v => setEditForm({ ...editForm, owner_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="owner">{t("owner")}</SelectItem><SelectItem value="borgadar">{t("borgadar")}</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>{t("fieldType")}</Label>
                <Select value={editForm.field_type} disabled={editSaving} onValueChange={v => setEditForm({ ...editForm, field_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high_land">{t("highLand")}</SelectItem>
                    <SelectItem value="medium_land">{t("mediumLand")}</SelectItem>
                    <SelectItem value="low_land">{t("lowLand")}</SelectItem>
                    <SelectItem value="other">{t("other")}</SelectItem>
                  </SelectContent>
                </Select>
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

      <Dialog open={!!viewLoan} onOpenChange={(o) => { if (!o) { setViewLoan(null); setViewLoanInst([]); setViewLoanPays([]); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("loanDetails" as any)}</DialogTitle></DialogHeader>
          {viewLoan && (() => {
             const totalPaid = viewLoanPays.reduce((s, p) => s + Number(p.amount), 0);
             const totalDue = Math.max(0, Number(viewLoan.total_payable) - totalPaid);
             const paidCount = viewLoanInst.filter(i => i.status === "paid").length;
             const remainCount = viewLoanInst.filter(i => i.status !== "paid").length;
             const nextDueInst = viewLoanInst.find(i => i.status !== "paid");
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div><div className="text-xs text-muted-foreground">{t("issuedOn")}</div><div>{fmtDate(viewLoan.issued_on)}</div></div>
                  <div><div className="text-xs text-muted-foreground">{t("principal")}</div><div>{money(viewLoan.principal)}</div></div>
                  <div><div className="text-xs text-muted-foreground">{t("totalPayable")}</div><div className="font-bold">{money(viewLoan.total_payable)}</div></div>
                  <div><div className="text-xs text-muted-foreground">{t("paidAmount")}</div><div className="text-success font-semibold">{money(totalPaid)}</div></div>
                  <div><div className="text-xs text-muted-foreground">{t("dueAmount")}</div><div className={totalDue > 0 ? "due-text font-semibold" : ""}>{money(totalDue)}</div></div>
                  <div><div className="text-xs text-muted-foreground">{t("status")}</div><div><Badge>{t(viewLoan.status as any)}</Badge></div></div>
                  {viewLoanInst.length > 0 && <>
                    <div><div className="text-xs text-muted-foreground">{t("installmentsPaid" as any)}</div><div>{paidCount} / {viewLoanInst.length}</div></div>
                    <div><div className="text-xs text-muted-foreground">{t("installmentsRemaining" as any)}</div><div>{remainCount}</div></div>
                  </>}
                  {viewLoanInst.length > 0 && (() => {
                    const type = viewLoan.loan_plans?.installment_type
                      || (viewLoanInst.length > 0 && viewLoanInst[0].due_date && viewLoanInst[1]?.due_date
                        ? (() => {
                            const diff = (new Date(viewLoanInst[1].due_date).getTime() - new Date(viewLoanInst[0].due_date).getTime()) / 86400000;
                            return diff >= 25 ? "monthly" : diff >= 6 ? "weekly" : "daily";
                          })()
                        : "monthly");
                    const label = type === "monthly" ? t("perMonth" as any) : type === "weekly" ? t("perWeek" as any) : t("perDay" as any);
                    const amounts = viewLoanInst.map(i => Number(i.amount));
                    const minA = Math.min(...amounts);
                    const maxA = Math.max(...amounts);
                    const display = minA === maxA ? money(minA) : `${money(minA)} – ${money(maxA)}`;
                    return (
                      <div className="col-span-2"><div className="text-xs text-muted-foreground">{label}</div><div className="font-bold">{display} <span className="text-xs text-muted-foreground">× {viewLoanInst.length} {t("installments" as any)}</span></div></div>
                    );
                  })()}
                  {nextDueInst && (
                    <div className="col-span-2"><div className="text-xs text-muted-foreground">{t("nextDue" as any)}</div><div className="font-semibold">{fmtDate(nextDueInst.due_date)} — <span className="due-text">{money(Math.max(0, Number(nextDueInst.amount) - Number(nextDueInst.paid_amount)))}</span></div></div>
                  )}
                  {(() => {
                    const schedTotal = viewLoanInst.reduce((s, i) => s + Number(i.amount || 0), 0);
                    const insPaid = viewLoanInst.reduce((s, i) => s + Number(i.paid_amount || 0), 0);
                    const tol = 0.5;
                    const ok = (!viewLoanInst.length || Math.abs(schedTotal - Number(viewLoan.total_payable)) <= tol)
                      && Math.abs(insPaid - totalPaid) <= tol;
                    return (
                      <div className="col-span-4">
                        <Badge variant={ok ? "secondary" : "destructive"}>
                          {ok ? `✓ ${t("totalsMatch" as any)}` : `⚠ ${t("totalsMismatch" as any)}`}
                        </Badge>
                      </div>
                    );
                  })()}
                </div>

                {viewLoanInst.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">{t("installments" as any)}</div>
                    <Table>
                      <TableHeader><TableRow><TableHead>#</TableHead><TableHead>{t("nextDue")}</TableHead><TableHead className="text-right">{t("total")}</TableHead><TableHead className="text-right">{t("paidAmount")}</TableHead><TableHead>{t("status")}</TableHead><TableHead className="text-right">{t("actions")}</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {viewLoanInst.map(it => {
                          const remaining = Math.max(0, Number(it.amount) - Number(it.paid_amount));
                          const today0 = new Date(); today0.setHours(0, 0, 0, 0);
                          const isOverdue = it.status !== "paid" && new Date(it.due_date) < today0;
                          return (
                            <TableRow key={it.id} className={`cursor-pointer ${isOverdue ? "bg-destructive/5" : ""}`} onClick={() => setViewInstDetail(it)}>
                              <TableCell>{it.installment_no}</TableCell>
                              <TableCell className={isOverdue ? "due-text font-semibold" : ""}>{fmtDate(it.due_date)}</TableCell>
                              <TableCell className="text-right">{money(it.amount)}</TableCell>
                              <TableCell className="text-right">{money(it.paid_amount)}</TableCell>
                              <TableCell>
                                {isOverdue
                                  ? <Badge variant="destructive">{t("overdue" as any) || "Overdue"}</Badge>
                                  : <Badge variant={it.status === "paid" ? "secondary" : it.status === "partial" ? "default" : "outline"}>{t(it.status as any) || it.status}</Badge>}
                              </TableCell>
                              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                {it.status !== "paid" && (
                                  <Button size="sm" variant="outline" onClick={() => nav(`/payments?farmer=${id}&loan=${viewLoan.id}&amount=${remaining.toFixed(2)}`)}>
                                    <Receipt className="h-3 w-3 mr-1" />{t("pay" as any) || "Pay"}
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <div>
                  <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">{t("payments")}</div>
                  {viewLoanPays.length === 0 ? <div className="text-xs text-muted-foreground">{t("noData")}</div> : (
                    <Table>
                      <TableHeader><TableRow><TableHead>{t("date")}</TableHead><TableHead className="text-right">{t("amount")}</TableHead><TableHead>{t("note")}</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {viewLoanPays.map(p => (
                          <TableRow key={p.id}>
                            <TableCell>{fmtDate(p.paid_on)}</TableCell>
                            <TableCell className="text-right text-success font-semibold">{money(p.amount)}</TableCell>
                            <TableCell>{p.note ?? ""}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => exportLoanExcel(viewLoan)}><FileSpreadsheet className="h-4 w-4 mr-1" />{t("exportExcel")}</Button>
                  <Button variant="outline" onClick={() => printLoanFull(viewLoan)}><Printer className="h-4 w-4 mr-1" />{t("print")}</Button>
                  <Button onClick={() => nav(`/payments?farmer=${id}&loan=${viewLoan.id}`)}><Receipt className="h-4 w-4 mr-1" />{t("payments")}</Button>
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewInstDetail} onOpenChange={(o) => { if (!o) setViewInstDetail(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("installmentDetail" as any) || "Installment Detail"}</DialogTitle></DialogHeader>
          {viewInstDetail && (() => {
            const today0 = new Date(); today0.setHours(0, 0, 0, 0);
            const dueDate = new Date(viewInstDetail.due_date);
            const isOverdue = viewInstDetail.status !== "paid" && dueDate < today0;
            const daysLate = isOverdue ? Math.floor((today0.getTime() - dueDate.getTime()) / 86400000) : 0;
            const remaining = Math.max(0, Number(viewInstDetail.amount) - Number(viewInstDetail.paid_amount));
            const relPays = viewLoanPays.filter((p: any) => {
              if (!viewInstDetail.paid_on) return false;
              return new Date(p.paid_on) <= new Date(viewInstDetail.paid_on || viewInstDetail.due_date);
            });
            return (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><div className="text-xs text-muted-foreground">{t("installmentNo" as any)}</div><div className="font-semibold">#{viewInstDetail.installment_no}</div></div>
                  <div><div className="text-xs text-muted-foreground">{t("dueDate" as any)}</div><div className={isOverdue ? "due-text font-semibold" : "font-semibold"}>{fmtDate(viewInstDetail.due_date)}</div></div>
                  <div><div className="text-xs text-muted-foreground">{t("total")}</div><div>{money(viewInstDetail.amount)}</div></div>
                  <div><div className="text-xs text-muted-foreground">{t("paidAmount")}</div><div className="text-success">{money(viewInstDetail.paid_amount)}</div></div>
                  <div><div className="text-xs text-muted-foreground">{t("dueAmount")}</div><div className={remaining > 0 ? "due-text font-semibold" : ""}>{money(remaining)}</div></div>
                  <div><div className="text-xs text-muted-foreground">{t("status")}</div>
                    <div>{isOverdue
                      ? <Badge variant="destructive">{t("overdue" as any)} ({daysLate} {t("daysOverdue" as any)})</Badge>
                      : <Badge>{t(viewInstDetail.status as any) || viewInstDetail.status}</Badge>}</div></div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">{t("timeline" as any)}</div>
                  <ol className="relative border-l border-muted ml-2 space-y-3">
                    <li className="ml-4"><span className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full bg-primary"></span>
                      <div className="text-xs text-muted-foreground">{t("dueDate" as any)}</div><div>{fmtDate(viewInstDetail.due_date)} — {money(viewInstDetail.amount)}</div></li>
                    {relPays.map((p: any) => (
                      <li key={p.id} className="ml-4"><span className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full bg-success"></span>
                        <div className="text-xs text-muted-foreground">{fmtDate(p.paid_on)}</div><div className="text-success">+{money(p.amount)} {p.note ? `— ${p.note}` : ""}</div></li>
                    ))}
                    {viewInstDetail.status === "paid" && viewInstDetail.paid_on && (
                      <li className="ml-4"><span className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full bg-success"></span>
                        <div className="text-xs text-muted-foreground">{t("paid")}</div><div>{fmtDate(viewInstDetail.paid_on)}</div></li>
                    )}
                  </ol>
                </div>
                <DialogFooter>
                  {viewInstDetail.status !== "paid" && (
                    <Button onClick={() => { setViewInstDetail(null); nav(`/payments?farmer=${id}&loan=${viewLoan.id}&amount=${remaining.toFixed(2)}`); }}>
                      <Receipt className="h-4 w-4 mr-1" />{t("pay" as any) || "Pay"}
                    </Button>
                  )}
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editLoanRow} onOpenChange={(o) => { if (!o) setEditLoanRow(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("loanDetails" as any)} — {t("edit" as any) || "Edit"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("pgLoanPlan")}</Label>
              <Select value={editLoanForm.plan_id || "_none"} onValueChange={v => {
                const p = loanPlans.find(x => x.id === v);
                setEditLoanForm(f => ({ ...f, plan_id: v === "_none" ? "" : v, interest_rate: p?.interest_rate ?? f.interest_rate }));
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">{t("noPlanManual")}</SelectItem>
                  {loanPlans.map(p => <SelectItem key={p.id} value={p.id}>{p.name} — {p.duration_months}mo / {p.installment_type} @ {p.interest_rate}%</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">{t("pgPlanChangeWarn" as any)}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("principal")}</Label><Input type="number" value={editLoanForm.principal} onChange={e => setEditLoanForm({ ...editLoanForm, principal: +e.target.value })} /></div>
              <div><Label>{t("interestRate")}</Label><Input type="number" step="0.1" value={editLoanForm.interest_rate} disabled={!editLoanForm.interest_enabled || !!editLoanForm.plan_id} onChange={e => setEditLoanForm({ ...editLoanForm, interest_rate: +e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("issuedOn")}</Label><Input type="date" value={editLoanForm.issued_on} onChange={e => setEditLoanForm({ ...editLoanForm, issued_on: e.target.value })} /></div>
              <div><Label>{t("nextDue")}</Label><Input type="date" value={editLoanForm.next_due_on} onChange={e => setEditLoanForm({ ...editLoanForm, next_due_on: e.target.value })} /></div>
            </div>
            <div><Label>{t("note")}</Label><Input value={editLoanForm.note} onChange={e => setEditLoanForm({ ...editLoanForm, note: e.target.value })} /></div>
            <div className="rounded-md bg-muted p-2 text-sm">{t("totalPayable")}: <span className="font-bold">{money(editLoanForm.interest_enabled ? editLoanForm.principal * (1 + editLoanForm.interest_rate / 100) : editLoanForm.principal)}</span></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditLoanRow(null)}>{t("cancel")}</Button>
            <Button onClick={saveEditLoan}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
