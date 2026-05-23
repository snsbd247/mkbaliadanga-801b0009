import { useEffect, useState } from "react";
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
import { validateLocationChain } from "@/lib/locationValidation";
import { validateDagNumbers } from "@/lib/dagNumbers";
import { SavingsStatement } from "@/components/SavingsStatement";
import { EditButton, DeleteButton } from "@/components/ui/action-icon-button";
import { downloadBnReceiptPdf, type BnReceiptData } from "@/lib/bnReceipts";
import { autoReceiptNo } from "@/lib/receiptNo";
import { ReceiptCopyMenu } from "@/components/receipts/ReceiptCopyMenu";
import { ReceiptSettingsButton } from "@/components/receipts/ReceiptSettingsButton";
import IrrigationInvoicesTab from "@/components/farmers/IrrigationInvoicesTab";
import FarmerLandHistoryTab from "@/components/farmers/FarmerLandHistoryTab";
import { useReceiptRenderArgs } from "@/lib/receiptOptions";
import { useBranding } from "@/lib/branding";
import { exportLandsPdf, exportLandsExcel, type LandExportRow } from "@/lib/landExport";
import { useAuth } from "@/auth/AuthProvider";
import { exportPaymentReceiptPDF } from "@/lib/exports";
import { FarmerSearchSelect } from "@/components/farmers/FarmerSearchSelect";
import { formatId5 } from "@/lib/idFormat";

type LandRow = LandExportRow & { id: string; mouza_id?: string | null; ward_id?: string | null };

const EMPTY_LAND = { dag_no: "", land_size: 0, owner_type: "owner", field_type: "medium_land", owner_farmer_id: "" as string | "" };

export default function FarmerDetail() {
  const { id } = useParams<{ id: string }>();
  const { t, lang, tx } = useLang();
  const { isSuper } = useAuth();
  const nav = useNavigate();
  const [farmer, setFarmer] = useState<any>(null);
  const [lands, setLands] = useState<LandRow[]>([]);
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
  const [share, setShare] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  

  // Add land dialog
  const [openLand, setOpenLand] = useState(false);
  const [land, setLand] = useState({ ...EMPTY_LAND });
  const [landLoc, setLandLoc] = useState<LocationValue>({});
  const [landLocErr, setLandLocErr] = useState<{ level: any; message: string } | null>(null);
  const [savingLand, setSavingLand] = useState(false);
  const [ownerLands, setOwnerLands] = useState<any[]>([]);
  const [ownerLandsLoading, setOwnerLandsLoading] = useState(false);

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

    // Outstanding from new irrigation_invoices (replaces legacy irrigation_charges total)
    const inv = await supabase
      .from("irrigation_invoices")
      .select("due_amount")
      .eq("farmer_id", id!)
      .is("deleted_at", null);
    setInvDue((inv.data ?? []).reduce((a: number, r: any) => a + Number(r.due_amount || 0), 0));
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
    downloadBnReceiptPdf({
      kind: "savings",
      ...commonReceipt(),
      receipt_no: s.receipt_no || autoReceiptNo("SAV", s.id, new Date(s.txn_date ?? s.created_at)),
      date: s.txn_date ?? s.created_at,
      farmer: farmerForReceipt(),
      description: s.note ?? `${tx("Savings", "সঞ্চয়")} ${s.type} (${s.status})`,
      collected_amount: Number(s.amount),
    }, copy, receiptArgs.options);
  }
  function printLoan(l: any, copy: import("@/lib/bnReceipts").ReceiptCopy = "both") {
    downloadBnReceiptPdf({
      kind: "loan",
      ...commonReceipt(),
      receipt_no: l.receipt_no || autoReceiptNo("LOAN", l.id, new Date(l.issued_on)),
      date: l.issued_on,
      farmer: farmerForReceipt(),
      description: `${tx("Loan disbursed — total payable", "ঋণ বিতরণ — মোট পরিশোধ্য")} ${money(l.total_payable)}`,
      outstanding: Number(l.total_payable),
      collected_amount: Number(l.principal),
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
  async function deleteLoan(l: any) {
    if (!window.confirm("Delete this loan?")) return;
    const { error } = await supabase.from("loans").update({ deleted_at: new Date().toISOString() } as any).eq("id", l.id);
    if (error) return toast.error(error.message);
    toast.success(t("pgDeleted" as any)); loadAll();
  }
  async function openLoanView(l: any) {
    const [ins, pays, planRes] = await Promise.all([
      supabase.from("loan_installments").select("*").eq("loan_id", l.id).order("installment_no"),
      supabase.from("loan_payments").select("*").eq("loan_id", l.id).order("paid_on", { ascending: false }),
      l.plan_id ? supabase.from("loan_plans").select("*").eq("id", l.plan_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    setViewLoan({ ...l, loan_plans: planRes.data });
    setViewLoanInst(ins.data ?? []);
     setViewLoanPays(pays.data ?? []);
  }
  function editLoanGoto(l: any) {
    setEditLoanRow(l);
    setEditLoanForm({
      plan_id: l.plan_id ?? "",
      principal: Number(l.principal),
      interest_rate: Number(l.interest_rate),
      interest_enabled: !!l.interest_enabled,
      issued_on: l.issued_on?.slice(0, 10) ?? "",
      next_due_on: l.next_due_on?.slice(0, 10) ?? "",
      note: l.note ?? "",
    });
  }
  async function saveEditLoan() {
    if (!editLoanRow) return;
    const planChanged = (editLoanRow.plan_id ?? "") !== editLoanForm.plan_id;
    const total_payable = editLoanForm.principal * (1 + (editLoanForm.interest_enabled ? editLoanForm.interest_rate : 0) / 100);
    const { error } = await supabase.from("loans").update({
      plan_id: editLoanForm.plan_id || null,
      principal: editLoanForm.principal,
      interest_rate: editLoanForm.interest_enabled ? editLoanForm.interest_rate : 0,
      interest_enabled: editLoanForm.interest_enabled,
      total_payable,
      issued_on: editLoanForm.issued_on,
      next_due_on: editLoanForm.next_due_on || null,
      note: editLoanForm.note,
    }).eq("id", editLoanRow.id);
    if (error) return toast.error(error.message);
    if (planChanged && editLoanForm.plan_id) {
      await supabase.from("loan_installments").delete().eq("loan_id", editLoanRow.id);
      const { error: gErr } = await supabase.rpc("generate_loan_installments", { _loan_id: editLoanRow.id });
      if (gErr) toast.error(`Schedule: ${gErr.message}`);
      else toast.success("Updated & schedule regenerated");
    } else {
      toast.success(t("pgUpdated" as any));
    }
    setEditLoanRow(null); loadAll();
  }
  async function printLoanFull(l: any) {
    const [insRes, payRes] = await Promise.all([
      supabase.from("loan_installments").select("*").eq("loan_id", l.id).order("installment_no"),
      supabase.from("loan_payments").select("*").eq("loan_id", l.id).order("paid_on"),
    ]);
    const ins = insRes.data ?? [];
    const pays = payRes.data ?? [];
    const totalPaid = pays.reduce((s, p) => s + Number(p.amount), 0);
    const totalDue = Math.max(0, Number(l.total_payable) - totalPaid);
    const paidCount = ins.filter((i: any) => i.status === "paid").length;
    const remainCount = ins.length - paidCount;

    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const { validateLoanTotals, formatLoanReceiptNo } = await import("@/lib/loanReceiptFormat");
    const validation = validateLoanTotals(l, ins, pays);
    const receiptNo = formatLoanReceiptNo((brand as any).loan_receipt_no_format, l.id, new Date());
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const headerExtra = (lang === "bn" ? (brand as any).loan_receipt_header_bn : (brand as any).loan_receipt_header_en) || "";
    const footerExtra = (lang === "bn" ? (brand as any).loan_receipt_footer_bn : (brand as any).loan_receipt_footer_en) || "";
    let yTop = 14;
    doc.setFontSize(14); doc.setFont(undefined, "bold");
    doc.text(brand.company_name || "Loan Details", pageW / 2, yTop, { align: "center" }); yTop += 7;
    doc.setFontSize(11);
    doc.text(t("loanDetails") || "Loan Details", pageW / 2, yTop, { align: "center" }); yTop += 6;
    if (headerExtra) { doc.setFontSize(9); doc.setFont(undefined, "normal"); doc.text(headerExtra, pageW / 2, yTop, { align: "center" }); yTop += 5; }
    doc.setFontSize(9); doc.setFont(undefined, "normal");
    doc.text(`${t("receiptNo")}: ${receiptNo}`, pageW - 14, yTop, { align: "right" });
    doc.setFontSize(10);
    doc.text(`${t("farmerName") || "Farmer"}: ${farmer?.name_en ?? ""}  (${farmer?.farmer_code ?? ""})`, 14, yTop); yTop += 6;
    doc.text(`${t("issuedOn")}: ${fmtDate(l.issued_on)}`, 14, yTop); yTop += 6;
    doc.text(`${t("principal")}: ${money(l.principal)}    ${t("interestRate")}: ${l.interest_rate}%`, 14, yTop); yTop += 6;
    doc.text(`${t("totalPayable")}: ${money(l.total_payable)}    ${t("paidAmount")}: ${money(totalPaid)}    ${t("dueAmount")}: ${money(totalDue)}`, 14, yTop); yTop += 6;
    if (ins.length) { doc.text(`${t("installmentsPaid")}: ${paidCount}/${ins.length}    ${t("installmentsRemaining")}: ${remainCount}`, 14, yTop); yTop += 6; }
    if (ins.length) {
      const type = l.loan_plans?.installment_type
        || (ins[1]?.due_date
          ? (() => { const d = (new Date(ins[1].due_date).getTime() - new Date(ins[0].due_date).getTime()) / 86400000; return d >= 25 ? "monthly" : d >= 6 ? "weekly" : "daily"; })()
          : "monthly");
      const lbl = type === "monthly" ? t("perMonth") : type === "weekly" ? t("perWeek") : t("perDay");
      const amounts = ins.map((i: any) => Number(i.amount));
      const minA = Math.min(...amounts), maxA = Math.max(...amounts);
      const disp = minA === maxA ? money(minA) : `${money(minA)} - ${money(maxA)}`;
      doc.text(`${lbl}: ${disp}`, 14, yTop); yTop += 6;
      const nd = ins.find((i: any) => i.status !== "paid");
      if (nd) { doc.text(`${t("nextDue") || "Next Due"}: ${fmtDate(nd.due_date)} — ${money(Math.max(0, Number(nd.amount) - Number(nd.paid_amount)))}`, 14, yTop); yTop += 6; }
    }
    if (!validation.ok) {
      doc.setTextColor(200, 30, 30); doc.setFont(undefined, "bold");
      doc.text(`⚠ ${t("totalsMismatch")}: ${validation.mismatch}`, 14, yTop); yTop += 6;
      doc.setTextColor(0, 0, 0); doc.setFont(undefined, "normal");
    }

    let y = yTop + 2;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (ins.length) {
      autoTable(doc, {
        startY: y,
        head: [[t("installmentRefId"), t("installmentNo") || "#", t("dueDate") || t("nextDue"), t("total"), t("paidAmount"), t("status")]],
        body: ins.map((i: any) => {
          const isOverdue = i.status !== "paid" && new Date(i.due_date) < today;
          const statusLbl = isOverdue ? t("overdue") : (t(i.status as any) || i.status);
          return [String(i.id).slice(0, 8), i.installment_no, fmtDate(i.due_date), money(i.amount), money(i.paid_amount), statusLbl];
        }),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [16, 122, 87] },
        didParseCell: (data: any) => {
          if (data.section === "body") {
            const row = ins[data.row.index];
            if (row && row.status !== "paid" && new Date(row.due_date) < today) {
              data.cell.styles.textColor = [200, 30, 30];
            }
          }
        },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }
    if (pays.length) {
      doc.setFont(undefined, "bold"); doc.text(t("paymentHistory") || t("payments"), 14, y); y += 4;
      autoTable(doc, {
        startY: y,
        head: [[t("date"), t("paidAmount"), t("note")]],
        body: pays.map((p: any) => [fmtDate(p.paid_on), money(p.amount), p.note ?? ""]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [16, 122, 87] },
      });
    }
    const total = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i); doc.setFontSize(8);
      const pageH = doc.internal.pageSize.getHeight();
      if (footerExtra) doc.text(footerExtra, pageW / 2, pageH - 10, { align: "center" });
      doc.text(`Page ${i}/${total}`, pageW - 14, pageH - 6, { align: "right" });
    }
    doc.save(`loan-${l.id.slice(0, 8)}.pdf`);
  }
  async function exportLoanExcel(l: any) {
    const XLSX = await import("xlsx");
    const [insRes, payRes] = await Promise.all([
      supabase.from("loan_installments").select("*").eq("loan_id", l.id).order("installment_no"),
      supabase.from("loan_payments").select("*").eq("loan_id", l.id).order("paid_on"),
    ]);
    const ins = insRes.data ?? [];
    const pays = payRes.data ?? [];
    const totalPaid = pays.reduce((s, p) => s + Number(p.amount), 0);
    const totalDue = Math.max(0, Number(l.total_payable) - totalPaid);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const type = l.loan_plans?.installment_type
      || (ins[1]?.due_date ? (() => { const d = (new Date(ins[1].due_date).getTime() - new Date(ins[0].due_date).getTime()) / 86400000; return d >= 25 ? "monthly" : d >= 6 ? "weekly" : "daily"; })() : "monthly");
    const periodLbl = type === "monthly" ? "Per Month" : type === "weekly" ? "Per Week" : "Per Day";
    const nd = ins.find((i: any) => i.status !== "paid");
    const { validateLoanTotals } = await import("@/lib/loanReceiptFormat");
    const v = validateLoanTotals(l, ins, pays);
    const summary = [
      ["Farmer", `${farmer?.name_en ?? ""} (${farmer?.farmer_code ?? ""})`],
      ["Loan ID", l.id],
      ["Issued On", fmtDate(l.issued_on)],
      ["Principal", Number(l.principal)],
      ["Interest %", Number(l.interest_rate)],
      ["Total Payable", Number(l.total_payable)],
      ["Paid", totalPaid],
      ["Due", totalDue],
      ["Period Type", periodLbl],
      ["Next Due Date", nd ? fmtDate(nd.due_date) : "—"],
      ["Next Due Amount", nd ? Math.max(0, Number(nd.amount) - Number(nd.paid_amount)) : 0],
      ["Validation", v.ok ? "OK" : `MISMATCH: ${v.mismatch}`],
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Loan Summary"], ...summary]), "Summary");
    const insRows = [["Installment Ref ID", "#", "Due Date", "Amount", "Paid", "Status", "Overdue"], ...ins.map((i: any) => [
      i.id, i.installment_no, fmtDate(i.due_date), Number(i.amount), Number(i.paid_amount), i.status,
      i.status !== "paid" && new Date(i.due_date) < today ? "YES" : "",
    ])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(insRows), "Installments");
    const payRows = [["Payment ID", "Date", "Amount", "Note"], ...pays.map((p: any) => [p.id, fmtDate(p.paid_on), Number(p.amount), p.note ?? ""])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(payRows), "Payments");
    XLSX.writeFile(wb, `loan-${l.id.slice(0, 8)}.xlsx`);
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
    // Require location chain
    const v = validateLocationChain(landLoc);
    if (!v.ok) { setLandLocErr({ level: (v as any).level, message: t("locationInvalidMissingParent" as any) || "Please complete the location" }); return; }
    if (!(landLoc as any).mouza_id) { setLandLocErr({ level: "mouza", message: t("mouzaRequired" as any) }); return; }
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
      const v = validateLocationChain(editLoc);
      if (!v.ok) { setEditLocErr({ level: (v as any).level, message: t("locationInvalidMissingParent" as any) || "Please complete the location" }); return; }
      if (!(editLoc as any).mouza_id) { setEditLocErr({ level: "mouza", message: t("mouzaRequired" as any) || "Mouza required" }); return; }
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

  return (
    <>
      <PageHeader title={lang === "bn" ? (farmer.name_bn || farmer.name_en) : farmer.name_en}
        description={`${farmer.member_no ?? farmer.farmer_code} • ${farmer.offices?.name ?? ""}`}
        actions={<>
          <ReceiptSettingsButton />
          <Button variant="outline" onClick={() => nav(`/farmers?edit=${farmer.id}`)}><Pencil className="h-4 w-4 mr-1" />{t("edit")}</Button>
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
        {farmer.is_voter && <div className="stat-card"><div className="text-xs text-muted-foreground">{t("totalLoan")} {t("dueAmount")}</div><div className={"text-xl font-bold mt-1 " + (loanDue > 0 ? "due-text" : "")}>{money(loanDue)}</div></div>}
        <div className="stat-card"><div className="text-xs text-muted-foreground">{t("irrigation")} {t("dueAmount")}</div><div className={"text-xl font-bold mt-1 " + (irrDue > 0 ? "due-text" : "")}>{money(irrDue)}</div></div>
      </div>

      <Tabs defaultValue="lands">
        <TabsList>
          <TabsTrigger value="lands">{t("lands")}</TabsTrigger>
          <TabsTrigger value="land_history">Land History</TabsTrigger>
          {farmer.is_voter && <TabsTrigger value="savings">{t("savings")}</TabsTrigger>}
          <TabsTrigger value="statement">{t("statement")}</TabsTrigger>
          {farmer.is_voter && <TabsTrigger value="loans">{t("loans")}</TabsTrigger>}
          <TabsTrigger value="irr_invoices">{t("irrigation")}</TabsTrigger>
          <TabsTrigger value="payments">{t("pgPaymentsTab")}</TabsTrigger>
          {farmer.is_voter && <TabsTrigger value="shares">{t("shareBalance")}</TabsTrigger>}
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
                  </div>
                  <DialogFooter><Button variant="outline" disabled={savingLand} onClick={() => setOpenLand(false)}>{t("cancel")}</Button><Button onClick={addLand} disabled={savingLand}>{savingLand ? "…" : t("save")}</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>{t("pgLocation")}</TableHead>
                <TableHead>{t("dagNo")}</TableHead>
                <TableHead>{t("landSize")}</TableHead>
                <TableHead>{t("ownerType")}</TableHead>
                <TableHead>{t("fieldType")}</TableHead>
                <TableHead className="text-right">{t("actions")}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {lands.map(l => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs max-w-md whitespace-normal">{buildLocLine(l)}</TableCell>
                    <TableCell><Link to={`/lands/${l.id}`} className="underline">{l.dag_no}</Link></TableCell>
                    <TableCell>{l.land_size}</TableCell>
                    <TableCell>{t((l.owner_type as any) ?? "")}</TableCell>
                    <TableCell>{t((l.field_type as any) ?? "")}</TableCell>
                    <TableCell className="text-right">
                      <EditButton onClick={() => openEdit(l)} title={t("edit")} />
                      <DeleteButton onClick={() => setDelTarget(l)} title={t("delete")} />
                    </TableCell>
                  </TableRow>
                ))}
                {lands.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{t("noData")}</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>

        </TabsContent>

        <TabsContent value="land_history">
          <FarmerLandHistoryTab farmerId={id!} />
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
              <TableHead>{t("nextDue")}</TableHead><TableHead>{t("status")}</TableHead>
              <TableHead className="text-right">{t("actions")}</TableHead>
            </TableRow></TableHeader>
            <TableBody>{loans.map(l => {
              const paid = (l.loan_payments ?? []).reduce((a: number, p: any) => a + Number(p.amount), 0);
              const due = Number(l.total_payable) - paid;
              return (
                <TableRow key={l.id}>
                  <TableCell>{fmtDate(l.issued_on)}</TableCell>
                  <TableCell>{money(l.principal)}</TableCell>
                  <TableCell>{l.interest_rate}%</TableCell>
                  <TableCell>{money(l.total_payable)}</TableCell>
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
            {loans.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">{t("noData")}</TableCell></TableRow>}</TableBody>
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
      </Tabs>

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
