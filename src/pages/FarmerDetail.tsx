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
import { SavingsStatement } from "@/components/SavingsStatement";
import { downloadPaymentReceiptPdf, maskToken } from "@/lib/paymentReceiptPdf";
import { useBranding } from "@/lib/branding";
import { exportLandsPdf, exportLandsExcel, type LandExportRow } from "@/lib/landExport";
import { useAuth } from "@/auth/AuthProvider";
import { exportPaymentReceiptPDF } from "@/lib/exports";
import { FarmerSearchSelect } from "@/components/farmers/FarmerSearchSelect";

type LandRow = LandExportRow & { id: string; mouza_id?: string | null; ward_id?: string | null };

const EMPTY_LAND = { dag_no: "", land_size: 0, owner_type: "owner", field_type: "medium_land", owner_farmer_id: "" as string | "" };

export default function FarmerDetail() {
  const { id } = useParams<{ id: string }>();
  const { t, lang } = useLang();
  const { isSuper } = useAuth();
  const nav = useNavigate();
  const [farmer, setFarmer] = useState<any>(null);
  const [lands, setLands] = useState<LandRow[]>([]);
  const [savings, setSavings] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [viewLoan, setViewLoan] = useState<any | null>(null);
  const [viewLoanInst, setViewLoanInst] = useState<any[]>([]);
  const [viewLoanPays, setViewLoanPays] = useState<any[]>([]);
  const [editLoanRow, setEditLoanRow] = useState<any | null>(null);
  const [editLoanForm, setEditLoanForm] = useState<{ plan_id: string; principal: number; interest_rate: number; interest_enabled: boolean; issued_on: string; next_due_on: string; note: string }>({ plan_id: "", principal: 0, interest_rate: 0, interest_enabled: true, issued_on: "", next_due_on: "", note: "" });
  const [loanPlans, setLoanPlans] = useState<any[]>([]);
  const [irr, setIrr] = useState<any[]>([]);
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
      supabase.from("irrigation_charges").select("*, seasons(name,year,type), lands(dag_no)").eq("farmer_id", id!).is("deleted_at", null).order("entry_date", { ascending: false }),
      supabase.from("shares").select("balance").eq("farmer_id", id!).maybeSingle(),
      supabase.from("payments").select("id, kind, amount, method, note, created_at, idempotency_key, office_id, offices(name)").eq("farmer_id", id!).is("deleted_at", null).order("created_at", { ascending: false }).limit(200),
    ]);
    setFarmer(f.data); setLands((l.data as any) ?? []); setSavings(s.data ?? []);
    setLoans(ln.data ?? []); setIrr(ir.data ?? []); setShare(sh.data);
    setPayments(pm.data ?? []);

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


  function reprintReceipt(p: any) {
    if (!farmer) return;
    downloadPaymentReceiptPdf({
      receipt_no: String(p.id).slice(0, 8).toUpperCase(),
      payment_id: p.id,
      paid_at: p.created_at,
      farmer_name: farmer.name_en,
      farmer_code: farmer.account_number ?? farmer.farmer_code,
      member_no: farmer.member_no ?? null,
      mobile_masked: farmer.mobile ? farmer.mobile.replace(/^(\d{3})\d+(\d{2})$/, "$1***$2") : null,
      village: farmer.village ?? null,
      token_masked: maskToken("re-print"),
      token_status: "active",
      kind: p.kind,
      amount: Number(p.amount),
      method: p.method ?? "cash",
      note: p.note ?? null,
      idempotency_key: p.idempotency_key ?? "",
      office_name: p.offices?.name ?? null,
      company_name: brand.company_name,
      company_name_bn: brand.company_name_bn,
    });
  }

  function brandObj() {
    return { company_name: brand.company_name, address: brand.address, mobile: brand.mobile };
  }
  function farmerObj() {
    return {
      name_en: farmer?.name_en ?? "—",
      farmer_code: farmer?.farmer_code,
      member_no: farmer?.member_no,
      mobile: farmer?.mobile,
      village: farmer?.village,
    };
  }
  function printSavings(s: any) {
    exportPaymentReceiptPDF({
      brand: brandObj(),
      receipt_no: `SAV-${s.id.slice(0, 8).toUpperCase()}`,
      date: s.txn_date ?? s.created_at,
      farmer: farmerObj(),
      amount: Number(s.amount),
      method: "cash",
      note: s.note ?? `Savings ${s.type} (${s.status})`,
      allocations: [{ kind: `Savings ${s.type}`, amount: Number(s.amount) }],
    });
  }
  function printLoan(l: any) {
    exportPaymentReceiptPDF({
      brand: brandObj(),
      receipt_no: `LOAN-${l.id.slice(0, 8).toUpperCase()}`,
      date: l.issued_on,
      farmer: farmerObj(),
      amount: Number(l.principal),
      method: "cash",
      note: `Loan disbursed — Total Payable ${money(l.total_payable)}`,
      allocations: [{ kind: "Loan Disbursed (Principal)", amount: Number(l.principal) }],
    });
  }
  function printIrrigation(i: any) {
    exportPaymentReceiptPDF({
      brand: brandObj(),
      receipt_no: `IRR-${i.id.slice(0, 8).toUpperCase()}`,
      date: i.entry_date,
      farmer: farmerObj(),
      amount: Number(i.total),
      method: "cash",
      note: `Irrigation charge — ${i.seasons?.name ?? ""} ${i.seasons?.year ?? ""}`,
      allocations: [
        { kind: "Base", amount: Number(i.base_charge) },
        { kind: "Canal", amount: Number(i.canal_charge) },
        { kind: "Maintenance", amount: Number(i.maintenance_charge) },
        { kind: "Other", amount: Number(i.other_charge) },
      ].filter(a => a.amount > 0),
    });
  }
  async function deleteSavings(s: any) {
    if (!window.confirm("Delete this savings transaction?")) return;
    const { error } = await supabase.from("savings_transactions").update({ deleted_at: new Date().toISOString() } as any).eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); loadAll();
  }
  async function deleteLoan(l: any) {
    if (!window.confirm("Delete this loan?")) return;
    const { error } = await supabase.from("loans").update({ deleted_at: new Date().toISOString() } as any).eq("id", l.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); loadAll();
  }
  async function openLoanView(l: any) {
    setViewLoan(l);
    const [ins, pays] = await Promise.all([
      supabase.from("loan_installments").select("*").eq("loan_id", l.id).order("installment_no"),
      supabase.from("loan_payments").select("*").eq("loan_id", l.id).order("paid_on", { ascending: false }),
    ]);
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
      toast.success("Updated");
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
    const totalDue = Number(l.total_payable) - totalPaid;
    const paidCount = ins.filter((i: any) => i.status === "paid").length;
    const remainCount = ins.length - paidCount;

    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    doc.setFontSize(14); doc.setFont(undefined, "bold");
    doc.text(brand.company_name || "Loan Details", pageW / 2, 14, { align: "center" });
    doc.setFontSize(11);
    doc.text(t("loanDetails" as any) || "Loan Details", pageW / 2, 21, { align: "center" });
    doc.setFontSize(10); doc.setFont(undefined, "normal");
    doc.text(`${t("farmerName" as any) || "Farmer"}: ${farmer?.name_en ?? ""}  (${farmer?.farmer_code ?? ""})`, 14, 30);
    doc.text(`${t("issuedOn")}: ${fmtDate(l.issued_on)}`, 14, 36);
    doc.text(`${t("principal")}: ${money(l.principal)}    ${t("interestRate")}: ${l.interest_rate}%`, 14, 42);
    doc.text(`${t("totalPayable")}: ${money(l.total_payable)}    ${t("paidAmount")}: ${money(totalPaid)}    ${t("dueAmount")}: ${money(totalDue)}`, 14, 48);
    if (ins.length) doc.text(`${t("installmentsPaid" as any)}: ${paidCount}/${ins.length}    ${t("installmentsRemaining" as any)}: ${remainCount}`, 14, 54);

    let y = 60;
    if (ins.length) {
      autoTable(doc, {
        startY: y,
        head: [["#", t("nextDue"), t("total"), t("paidAmount"), t("status")]],
        body: ins.map((i: any) => [i.installment_no, fmtDate(i.due_date), money(i.amount), money(i.paid_amount), i.status]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [16, 122, 87] },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }
    if (pays.length) {
      doc.setFont(undefined, "bold"); doc.text(t("payments"), 14, y); y += 4;
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
      doc.text(`Page ${i}/${total}`, pageW - 14, doc.internal.pageSize.getHeight() - 6, { align: "right" });
    }
    doc.save(`loan-${l.id.slice(0, 8)}.pdf`);
  }
  async function deleteIrrigation(i: any) {
    if (!window.confirm("Delete this irrigation entry?")) return;
    const { error } = await supabase.from("irrigation_charges").update({ deleted_at: new Date().toISOString() } as any).eq("id", i.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); loadAll();
  }
  async function deletePayment(p: any) {
    if (!window.confirm("Delete this payment?")) return;
    const { error } = await supabase.from("payments").update({ deleted_at: new Date().toISOString() } as any).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); loadAll();
  }

  async function addLand() {
    setLandLocErr(null);
    // Require location chain
    const v = validateLocationChain(landLoc);
    if (!v.ok) { setLandLocErr({ level: (v as any).level, message: t("locationInvalidMissingParent" as any) || "Please complete the location" }); return; }
    if (!(landLoc as any).mouza_id) { setLandLocErr({ level: "mouza", message: t("mouzaRequired" as any) }); return; }
    if (!land.dag_no.trim()) return toast.error(t("dagRequired" as any));
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
        dag_no: land.dag_no,
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
    setEditLoc({ village: row.mouza ?? null });
  }

  async function saveEdit() {
    if (!editLand) return;
    setEditSaving(true);
    try {
      const { error } = await supabase.from("lands").update({
        mouza: (editLoc as any).mouza_name ?? (editLoc as any).village ?? "",
        dag_no: editForm.dag_no,
        land_size: editForm.land_size,
        owner_type: editForm.owner_type as any,
        field_type: editForm.field_type as any,
      } as any).eq("id", editLand.id);
      if (error) { toast.error(error.message); return; }
      toast.success(t("saved"));
      setEditLand(null);
      loadAll();
    } finally { setEditSaving(false); }
  }

  async function confirmDelete() {
    if (!delTarget) return;
    setDeleting(true);
    try {
      // Block if referenced by irrigation_charges or land_relations
      const [{ count: irrCnt }, { count: relCnt }] = await Promise.all([
        supabase.from("irrigation_charges").select("id", { count: "exact", head: true }).eq("land_id", delTarget.id),
        supabase.from("land_relations").select("id", { count: "exact", head: true }).eq("land_id", delTarget.id),
      ]);
      if ((irrCnt ?? 0) > 0 || (relCnt ?? 0) > 0) {
        toast.error(`Cannot delete: linked to ${irrCnt ?? 0} irrigation entries and ${relCnt ?? 0} relations.`);
        return;
      }
      const { error } = await supabase.from("lands").update({ deleted_at: new Date().toISOString() } as any).eq("id", delTarget.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Land deleted");
      setDelTarget(null);
      loadAll();
    } finally { setDeleting(false); }
  }

  if (!farmer) return <div className="text-muted-foreground">Loading…</div>;

  const totalDeposits = savings.filter(s => s.status === "approved" && s.type === "deposit").reduce((a, s) => a + Number(s.amount), 0);
  const totalWithdraws = savings.filter(s => s.status === "approved" && s.type === "withdraw").reduce((a, s) => a + Number(s.amount), 0);
  const savingsBal = totalDeposits - totalWithdraws;
  const loanDue = loans.filter(l => l.status === "approved").reduce((a, l) => {
    const paid = (l.loan_payments ?? []).reduce((x: number, p: any) => x + Number(p.amount), 0);
    return a + (Number(l.total_payable) - paid);
  }, 0);
  const irrDue = irr.reduce((a, i) => a + Number(i.due_amount), 0);

  const buildLocLine = (l: LandRow) => {
    const parts = [l.division_name, l.district_name, l.upazila_name, l.union_name, l.ward_name, l.village_name, l.mouza_name].filter(Boolean);
    return parts.length ? parts.join(" › ") : (l.mouza ?? "-");
  };

  return (
    <>
      <PageHeader title={lang === "bn" ? (farmer.name_bn || farmer.name_en) : farmer.name_en}
        description={`${farmer.member_no ?? farmer.farmer_code} • ${farmer.offices?.name ?? ""}`}
        actions={<>
          <Button variant="outline" onClick={() => nav(`/payments?farmer=${farmer.id}`)}><Receipt className="h-4 w-4 mr-1" />{t("payNow")}</Button>
          <Button variant="outline" onClick={() => nav(`/farmers/${farmer.id}/card`)}><IdCard className="h-4 w-4 mr-1" />Print Card</Button>
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
          <div className="grid flex-1 grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <div><div className="text-xs text-muted-foreground">Farmer ID</div><div className="font-mono font-semibold">{farmer.member_no ?? farmer.farmer_code}</div></div>
            <div><div className="text-xs text-muted-foreground">{t("nameEn")}</div><div className="font-medium">{farmer.name_en}</div></div>
            <div><div className="text-xs text-muted-foreground">{t("nameBn")}</div><div className="font-medium">{farmer.name_bn ?? "-"}</div></div>
            <div><div className="text-xs text-muted-foreground">{t("fatherName")}</div><div>{farmer.father_name ?? "-"}</div></div>
            <div><div className="text-xs text-muted-foreground">{t("motherName")}</div><div>{farmer.mother_name ?? "-"}</div></div>
            <div><div className="text-xs text-muted-foreground">{t("nid")}</div><div className="font-mono">{farmer.nid ?? "-"}</div></div>
            <div><div className="text-xs text-muted-foreground">{t("mobile")}</div><div>{farmer.mobile ?? "-"}</div></div>
            <div><div className="text-xs text-muted-foreground">Voter Number</div><div className="font-mono">{farmer.voter_number ?? "—"}</div></div>
            <div className="col-span-2 md:col-span-4"><div className="text-xs text-muted-foreground">{t("village")} / Location</div><div className="text-sm">{farmerLocationLine(farmer)}</div></div>
          </div>
          <div className="flex flex-col items-center gap-1 rounded-md border bg-card p-2">
            <QRCodeSVG value={`${window.location.origin}/scan?acc=${farmer.member_no ?? farmer.farmer_code}`} size={96} />
            <div className="text-[10px] text-muted-foreground">{t("qrCode")}</div>
            <div className="font-mono text-[10px]">{farmer.member_no ?? farmer.farmer_code}</div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-4 mb-4">
        <div className="stat-card"><div className="text-xs text-muted-foreground">{t("totalSavings")}</div><div className="text-xl font-bold mt-1">{money(savingsBal)}</div></div>
        <div className="stat-card"><div className="text-xs text-muted-foreground">{t("shareBalance")}</div><div className="text-xl font-bold mt-1">{money(share?.balance ?? 0)}</div></div>
        <div className="stat-card"><div className="text-xs text-muted-foreground">{t("totalLoan")} {t("dueAmount")}</div><div className={"text-xl font-bold mt-1 " + (loanDue > 0 ? "due-text" : "")}>{money(loanDue)}</div></div>
        <div className="stat-card"><div className="text-xs text-muted-foreground">{t("irrigation")} {t("dueAmount")}</div><div className={"text-xl font-bold mt-1 " + (irrDue > 0 ? "due-text" : "")}>{money(irrDue)}</div></div>
      </div>

      <Tabs defaultValue="lands">
        <TabsList>
          <TabsTrigger value="lands">{t("lands")}</TabsTrigger>
          
          <TabsTrigger value="savings">{t("savings")}</TabsTrigger>
          <TabsTrigger value="statement">{t("statement")}</TabsTrigger>
          <TabsTrigger value="loans">{t("loans")}</TabsTrigger>
          <TabsTrigger value="irrigation">{t("irrigation")}</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="lands">
          <Card>
            <div className="flex flex-wrap justify-end gap-2 p-3 border-b">
              <Button size="sm" variant="outline" disabled={lands.length === 0}
                onClick={() => exportLandsPdf({ name_en: farmer.name_en, account_number: farmer.account_number, farmer_code: farmer.farmer_code }, lands)}>
                <FileText className="h-4 w-4 mr-1" />Export PDF
              </Button>
              <Button size="sm" variant="outline" disabled={lands.length === 0}
                onClick={() => exportLandsExcel({ name_en: farmer.name_en, account_number: farmer.account_number, farmer_code: farmer.farmer_code }, lands)}>
                <FileSpreadsheet className="h-4 w-4 mr-1" />Export Excel
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
                    {land.owner_type === "owner" && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>{t("dagNo")} <span className="text-destructive">*</span></Label>
                          <Input disabled={savingLand} value={land.dag_no} onChange={e => setLand({ ...land, dag_no: e.target.value })} />
                        </div>
                      </div>
                    )}

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
                <TableHead>Location</TableHead>
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
                      <Button size="icon" variant="ghost" onClick={() => openEdit(l)} title="Edit"><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setDelTarget(l)} title="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {lands.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{t("noData")}</TableCell></TableRow>}
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
                    <Button size="icon" variant="ghost" onClick={() => printSavings(s)} title={t("print")}><Printer className="h-4 w-4" /></Button>
                    {isSuper && <Button size="icon" variant="ghost" onClick={() => deleteSavings(s)} title="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>}
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
                     <Button size="icon" variant="ghost" onClick={() => openLoanView(l)} title={t("view" as any)}><FileText className="h-4 w-4" /></Button>
                     <Button size="icon" variant="ghost" onClick={() => printLoanFull(l)} title={t("print")}><Printer className="h-4 w-4" /></Button>
                     {isSuper && <Button size="icon" variant="ghost" onClick={() => editLoanGoto(l)} title={t("edit" as any) || "Edit"}><Pencil className="h-4 w-4" /></Button>}
                     {isSuper && <Button size="icon" variant="ghost" onClick={() => deleteLoan(l)} title="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                   </TableCell>
                </TableRow>
              );
            })}
            {loans.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">{t("noData")}</TableCell></TableRow>}</TableBody>
          </Table></Card>
        </TabsContent>

        <TabsContent value="irrigation">
          <Card><Table>
            <TableHeader><TableRow>
              <TableHead>{t("date")}</TableHead><TableHead>{t("season")}</TableHead>
              <TableHead>{t("dagNo")}</TableHead><TableHead>{t("total")}</TableHead>
              <TableHead>{t("paidAmount")}</TableHead><TableHead>{t("dueAmount")}</TableHead>
              <TableHead className="text-right">{t("actions")}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {irr.map(i => (
                <TableRow key={i.id}>
                  <TableCell>{fmtDate(i.entry_date)}</TableCell>
                  <TableCell>{i.seasons?.name}</TableCell>
                  <TableCell>{i.lands?.dag_no}</TableCell>
                  <TableCell>{money(i.total)}</TableCell>
                  <TableCell>{money(i.paid_amount)}</TableCell>
                  <TableCell className={i.due_amount > 0 ? "due-text" : ""}>{money(i.due_amount)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => printIrrigation(i)} title={t("print")}><Printer className="h-4 w-4" /></Button>
                    {isSuper && <Button size="icon" variant="ghost" onClick={() => deleteIrrigation(i)} title="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </TableCell>
                </TableRow>
              ))}
              {irr.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">{t("noData")}</TableCell></TableRow>}
            </TableBody>
          </Table></Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card><Table>
            <TableHeader><TableRow>
              <TableHead>{t("date")}</TableHead>
              <TableHead>{t("type")}</TableHead>
              <TableHead>Method</TableHead>
              <TableHead className="text-right">{t("amount")}</TableHead>
              <TableHead>Office</TableHead>
              <TableHead className="text-right">Receipt</TableHead>
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
                    <Button size="sm" variant="outline" onClick={() => reprintReceipt(p)}>
                      <FileDown className="h-3 w-3 mr-1" />Download
                    </Button>
                    {isSuper && <Button size="icon" variant="ghost" onClick={() => deletePayment(p)} title="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </TableCell>
                </TableRow>
              ))}
              {payments.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{t("noData")}</TableCell></TableRow>
              )}
            </TableBody>
          </Table></Card>
        </TabsContent>
      </Tabs>

      {/* Edit land dialog */}
      <Dialog open={!!editLand} onOpenChange={(o) => { if (!o && !editSaving) { setEditLand(null); setEditLoc({}); setEditLocErr(null); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Land</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium mb-2 block">Location</Label>
              <LocationPicker value={editLoc} onChange={(v) => { setEditLoc(v); if (editLocErr) setEditLocErr(null); }}
                errorLevel={editLocErr?.level ?? null} errorMessage={editLocErr?.message ?? null} showVillage={false} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("dagNo")}</Label><Input disabled={editSaving} value={editForm.dag_no} onChange={e => setEditForm({ ...editForm, dag_no: e.target.value })} /></div>
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
            <AlertDialogTitle>Delete this land?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove Dag <span className="font-mono font-semibold">{delTarget?.dag_no}</span>.
              Linked irrigation entries or relations will block deletion.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmDelete(); }} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!viewLoan} onOpenChange={(o) => { if (!o) { setViewLoan(null); setViewLoanInst([]); setViewLoanPays([]); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("loanDetails" as any)}</DialogTitle></DialogHeader>
          {viewLoan && (() => {
            const totalPaid = viewLoanPays.reduce((s, p) => s + Number(p.amount), 0);
            const totalDue = Number(viewLoan.total_payable) - totalPaid;
            const paidCount = viewLoanInst.filter(i => i.status === "paid").length;
            const remainCount = viewLoanInst.filter(i => i.status !== "paid").length;
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
                </div>

                {viewLoanInst.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">{t("installments" as any)}</div>
                    <Table>
                      <TableHeader><TableRow><TableHead>#</TableHead><TableHead>{t("nextDue")}</TableHead><TableHead className="text-right">{t("total")}</TableHead><TableHead className="text-right">{t("paidAmount")}</TableHead><TableHead>{t("status")}</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {viewLoanInst.map(it => (
                          <TableRow key={it.id}>
                            <TableCell>{it.installment_no}</TableCell>
                            <TableCell>{fmtDate(it.due_date)}</TableCell>
                            <TableCell className="text-right">{money(it.amount)}</TableCell>
                            <TableCell className="text-right">{money(it.paid_amount)}</TableCell>
                            <TableCell><Badge variant={it.status === "paid" ? "secondary" : it.status === "partial" ? "default" : "outline"}>{it.status}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <div>
                  <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">{t("payments")}</div>
                  {viewLoanPays.length === 0 ? <div className="text-xs text-muted-foreground">{t("noData")}</div> : (
                    <Table>
                      <TableHeader><TableRow><TableHead>{t("date")}</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>{t("note")}</TableHead></TableRow></TableHeader>
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
                  <Button variant="outline" onClick={() => printLoanFull(viewLoan)}><Printer className="h-4 w-4 mr-1" />{t("print")}</Button>
                  <Button onClick={() => nav(`/payments?farmer=${id}&loan=${viewLoan.id}`)}><Receipt className="h-4 w-4 mr-1" />{t("payments")}</Button>
                </DialogFooter>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
}
