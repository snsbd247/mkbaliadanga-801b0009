import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
import { useAuth } from "@/auth/AuthProvider";
import { useLang } from "@/i18n/LanguageProvider";
import { usePermission } from "@/hooks/usePermission";
import { money, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TruncateText } from "@/components/ui/truncate-text";
import { FarmerSearchSelect } from "@/components/farmers/FarmerSearchSelect";
import { MouzaSelect } from "@/components/locations/MouzaSelect";
import { ReceiptCopyMenu } from "@/components/receipts/ReceiptCopyMenu";
import { IrrigationReceiptPreviewDialog } from "@/components/receipts/IrrigationReceiptPreviewDialog";
import { EditReceiptDialog } from "@/components/receipts/EditReceiptDialog";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { downloadBnReceiptPdf, type ReceiptCopy, type BnReceiptData } from "@/lib/bnReceipts";
import { buildPaymentReceiptData } from "@/lib/buildPaymentReceiptData";
import { useReceiptRenderArgs } from "@/lib/receiptOptions";
import { useBranding } from "@/lib/branding";
import { logAudit } from "@/lib/audit";
import { Pencil, Trash2 } from "lucide-react";

const PAY_SELECT =
  "*, farmers(name_en,name_bn,farmer_code,member_no,mobile,village,father_name,voter_number,account_number,is_voter,union_id), payment_allocations(*)";

export default function Receipts() {
  const { t, tx } = useLang();
  const { user } = useAuth();
  const brand = useBranding();
  const receiptArgs = useReceiptRenderArgs();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const isAdmin = usePermission("payments", "can_delete");
  const canEdit = usePermission("payments", "can_edit");

  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<any[]>([]);
  const [mouzaByPayment, setMouzaByPayment] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<{ data: BnReceiptData; copy: ReceiptCopy } | null>(null);
  const [editPayment, setEditPayment] = useState<any | null>(null);

  // Filters
  const [receiptNo, setReceiptNo] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [farmerId, setFarmerId] = useState<string | null>(null);
  const [farmerCode, setFarmerCode] = useState("");
  const [mouza, setMouza] = useState("");

  useEffect(() => { document.title = `${tx("Receipts", "রশিদ তালিকা")} — ${t("appName")}`; }, [t, tx]);
  useEffect(() => {
    const id = setTimeout(load, 300); // debounce receipt-no typing
    return () => clearTimeout(id);
    /* eslint-disable-next-line */
  }, [from, to, farmerId, receiptNo]);

  async function load() {
    setLoading(true);
    let q = db.from("payments").select(PAY_SELECT).is("deleted_at", null).order("created_at", { ascending: false }).limit(500);
    if (receiptNo.trim()) q = q.ilike("receipt_no", `%${receiptNo.trim()}%`);
    if (from) q = q.gte("created_at", new Date(from).toISOString());
    if (to) { const end = new Date(to); end.setHours(23, 59, 59, 999); q = q.lte("created_at", end.toISOString()); }
    if (farmerId) q = q.eq("farmer_id", farmerId);
    const { data, error } = await q;
    if (error) { toast.error(error.message); setLoading(false); return; }
    const rows = data ?? [];
    setList(rows);
    await resolveMouzas(rows);
    setLoading(false);
  }

  // Resolve each payment's mouza via its irrigation invoice → land relation.
  async function resolveMouzas(rows: any[]) {
    const refIds = new Set<string>();
    for (const p of rows) {
      for (const a of p.payment_allocations ?? []) {
        if (a.kind === "irrigation" && a.reference_id) refIds.add(a.reference_id);
      }
    }
    if (refIds.size === 0) { setMouzaByPayment({}); return; }
    const { data: invs } = await db
      .from("irrigation_invoices")
      .select("id, lands(mouza)")
      .in("id", Array.from(refIds));
    const invMouza: Record<string, string> = {};
    for (const inv of invs ?? []) {
      const m = (inv as any).lands?.mouza;
      if (m) invMouza[(inv as any).id] = m;
    }
    const map: Record<string, string> = {};
    for (const p of rows) {
      for (const a of p.payment_allocations ?? []) {
        if (a.kind === "irrigation" && a.reference_id && invMouza[a.reference_id]) {
          map[p.id] = invMouza[a.reference_id];
          break;
        }
      }
    }
    setMouzaByPayment(map);
  }

  const displayList = useMemo(() => {
    const code = farmerCode.trim().toLowerCase();
    const m = mouza.trim().toLowerCase();
    return list.filter((p) => {
      if (code && !String(p.farmers?.farmer_code ?? "").toLowerCase().includes(code)) return false;
      if (m && !String(mouzaByPayment[p.id] ?? "").toLowerCase().includes(m)) return false;
      return true;
    });
  }, [list, farmerCode, mouza, mouzaByPayment]);

  function clearFilters() {
    setReceiptNo(""); setFrom(""); setTo(""); setFarmerId(null); setFarmerCode(""); setMouza("");
  }

  async function deleteReceipt(p: any) {
    const ok = await confirm({
      title: tx("Delete receipt?", "রশিদ ডিলিট করবেন?"),
      description: tx(
        `Receipt ${p.receipt_no ?? p.id} will be archived (soft delete).`,
        `রশিদ ${p.receipt_no ?? p.id} আর্কাইভ করা হবে (সফট ডিলিট)।`,
      ),
      confirmText: tx("Delete", "ডিলিট"),
      cancelText: tx("Cancel", "বাতিল"),
      destructive: true,
    });
    if (!ok) return;
    const { error } = await db.from("payments").update({ deleted_at: new Date().toISOString() } as any).eq("id", p.id);
    if (error) return toast.error(error.message);
    await logAudit({
      module: "payments",
      action_type: "delete",
      reference_id: p.id,
      old_data: { receipt_no: p.receipt_no, farmer_id: p.farmer_id, amount: p.amount },
    }).catch(() => {});
    toast.success(tx("Receipt deleted", "রশিদ ডিলিট হয়েছে"));
    load();
  }

  const kindOf = (p: any) => {
    const k = (p.kind as string) || "savings";
    return (k === "loan" ? "loan" : k === "irrigation" ? "irrigation" : "savings") as "loan" | "irrigation" | "savings";
  };

  function exportRows() {
    return displayList.map((p) => ({
      [tx("Receipt #", "রশিদ নং")]: p.receipt_no ?? "",
      [tx("Date", "তারিখ")]: fmtDate(p.created_at),
      [tx("Farmer", "কৃষক")]: p.farmers?.name_bn || p.farmers?.name_en || "",
      [tx("Farmer Code", "কৃষক কোড")]: p.farmers?.farmer_code ?? "",
      [tx("Mouza", "মৌজা")]: mouzaByPayment[p.id] ?? "",
      [tx("Type", "ধরন")]: kindOf(p),
      [tx("Amount", "পরিমাণ")]: Number(p.amount ?? 0),
      [tx("Method", "মাধ্যম")]: p.method ?? "",
      [tx("Status", "স্ট্যাটাস")]: p.status ?? "approved",
    }));
  }

  async function exportExcel() {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(exportRows());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Receipts");
    XLSX.writeFile(wb, `receipts-${Date.now()}.xlsx`);
  }

  async function exportCsv() {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(exportRows());
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `receipts-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        title={tx("Receipts", "রশিদ তালিকা")}
        description={tx("All payment & irrigation receipts — filter, edit, delete, print", "সকল পেমেন্ট ও সেচ রশিদ — ফিল্টার, এডিট, ডিলিট, প্রিন্ট")}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportExcel} disabled={!displayList.length}>Excel</Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!displayList.length}>CSV</Button>
          </div>
        }
      />
      <div className="p-4 space-y-4">
        <Card className="p-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6 items-end">
            <div className="space-y-1 lg:col-span-2">
              <Label className="text-xs">{tx("Receipt #", "রশিদ নং")}</Label>
              <Input value={receiptNo} onChange={(e) => setReceiptNo(e.target.value)} placeholder={tx("Search receipt no", "রশিদ নং খুঁজুন")} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{tx("From", "শুরু")}</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{tx("To", "শেষ")}</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="space-y-1 lg:col-span-2">
              <Label className="text-xs">{tx("Farmer", "কৃষক")}</Label>
              <FarmerSearchSelect value={farmerId} onChange={(id) => setFarmerId(id)} placeholder={tx("Select farmer", "কৃষক নির্বাচন")} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{tx("Farmer code / ID", "কৃষক কোড / আইডি")}</Label>
              <Input value={farmerCode} onChange={(e) => setFarmerCode(e.target.value)} placeholder={tx("Code", "কোড")} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{tx("Mouza", "মৌজা")}</Label>
              <MouzaSelect value={mouza} onChange={setMouza} placeholder={tx("Any mouza", "যেকোনো মৌজা")} />
            </div>
          </div>
          <div className="mt-3">
            <Button variant="ghost" size="sm" onClick={clearFilters}>{tx("Clear filters", "ফিল্টার মুছুন")}</Button>
          </div>
        </Card>

        <Card>
          <div className="[&_table]:min-w-[860px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tx("Receipt #", "রশিদ নং")}</TableHead>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("farmerName")}</TableHead>
                  <TableHead>{tx("Mouza", "মৌজা")}</TableHead>
                  <TableHead>{tx("Type", "ধরন")}</TableHead>
                  <TableHead>{t("amount")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("action")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                  ))
                ) : displayList.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">{t("noData")}</TableCell></TableRow>
                ) : (
                  displayList.map((p) => {
                    const kind = kindOf(p);
                    const buildReceiptData = () => buildPaymentReceiptData(p, { brand, receiptArgs, tx });
                    const doDownload = async (copy: ReceiptCopy) => downloadBnReceiptPdf(await buildReceiptData(), copy, receiptArgs.options);
                    const doPreview = async () => setPreview({ data: await buildReceiptData(), copy: kind === "irrigation" ? "farmer" : "both" });
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs">{p.receipt_no ?? "—"}</TableCell>
                        <TableCell>{fmtDate(p.created_at)}</TableCell>
                        <TableCell className="max-w-[220px]">
                          <TruncateText>{p.farmers?.name_bn || p.farmers?.name_en}</TruncateText>{" "}
                          <span className="text-xs text-muted-foreground">({p.farmers?.farmer_code})</span>
                        </TableCell>
                        <TableCell>{mouzaByPayment[p.id] ?? <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell><Badge variant="outline">{kind}</Badge></TableCell>
                        <TableCell className="font-semibold text-success">{money(p.amount)}</TableCell>
                        <TableCell>
                          <Badge variant={p.status === "voided" ? "destructive" : p.status === "approved" ? "default" : p.status === "rejected" ? "destructive" : "secondary"}>
                            {p.status ?? "approved"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {(isAdmin || canEdit) && p.status === "approved" && !p.voided_at && (
                              <Button size="icon" variant="ghost" title={tx("Edit receipt", "রসিদ এডিট")} onClick={() => setEditPayment(p)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {isAdmin && (
                              <Button size="icon" variant="ghost" title={tx("Delete", "ডিলিট")} className="text-destructive" onClick={() => deleteReceipt(p)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                            <span data-receipt-menu>
                              <ReceiptCopyMenu
                                singleCopy={kind === "irrigation"}
                                onSelect={doDownload}
                                onPreview={kind === "irrigation" ? doPreview : undefined}
                                title={t("printReceipt") || "Print Receipt"}
                              />
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      <IrrigationReceiptPreviewDialog
        open={!!preview}
        onOpenChange={(o) => { if (!o) setPreview(null); }}
        data={preview?.data ?? null}
        copy={preview?.copy ?? "both"}
      />
      <EditReceiptDialog
        payment={editPayment}
        open={!!editPayment}
        onOpenChange={(o) => { if (!o) setEditPayment(null); }}
        onSaved={() => { setEditPayment(null); load(); }}
      />
      {confirmDialog}
    </>
  );
}
