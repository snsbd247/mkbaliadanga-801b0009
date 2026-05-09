/**
 * Irrigation Invoice Collection — single source of payment for irrigation invoices.
 *
 * Flow:
 *   1. Search farmer
 *   2. Load all unpaid invoices (overdue separated, sorted by due_date)
 *   3. Per-invoice: editable delay/maintenance/canal/other (override → audit log)
 *   4. Enter received amount → preview total → submit
 *   5. Inserts payments row + irrigation_invoice_payments link rows
 *   6. Updates each invoice's paid_amount (DB trigger recomputes status + due)
 *   7. Generates Bengali receipt
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FarmerSearchSelect } from "@/components/farmers/FarmerSearchSelect";
import { useAuth } from "@/auth/AuthProvider";
import { useLang } from "@/i18n/LanguageProvider";
import { toast } from "sonner";
import { money, fmtDate } from "@/lib/format";
import { formatLandSize } from "@/lib/irrigationCalc";
import { autoReceiptNo } from "@/lib/receiptNo";
import { Printer, Pencil } from "lucide-react";
import { downloadBnReceiptPdf } from "@/lib/bnReceipts";
import { useReceiptRenderArgs } from "@/lib/receiptOptions";
import { useBranding } from "@/lib/branding";

type Invoice = {
  id: string;
  invoice_no: string;
  season_id: string;
  land_id: string;
  farmer_id: string;
  is_borga: boolean;
  irrigation_amount: number;
  maintenance_amount: number;
  canal_amount: number;
  delay_fee: number;
  other_charge: number;
  payable_amount: number;
  paid_amount: number;
  due_amount: number;
  due_date: string;
  invoice_status: string;
  office_id: string | null;
  // joins
  lands?: any;
  seasons?: any;
};

type Override = {
  // collected per component
  irrigation: number;
  maintenance: number;
  canal: number;
  delay: number;
  other: number;
  // optional charge edits applied to the invoice itself
  edit_maintenance?: number | null;
  edit_canal?: number | null;
  edit_delay?: number | null;
  edit_other?: number | null;
  selected: boolean;
};

const blankOverride = (inv: Invoice): Override => ({
  irrigation: 0, maintenance: 0, canal: 0, delay: 0, other: 0,
  edit_maintenance: null, edit_canal: null, edit_delay: null, edit_other: null,
  selected: false,
});

export default function IrrigationInvoicePayment() {
  const { t } = useLang();
  const { user } = useAuth();
  const brand = useBranding();
  const receiptArgs = useReceiptRenderArgs();

  const [farmerId, setFarmerId] = useState<string | null>(null);
  const [farmer, setFarmer] = useState<any>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");

  useEffect(() => { document.title = `সেচ ইনভয়েস কালেকশন — ${t("appName")}`; }, []);

  useEffect(() => {
    if (!farmerId) { setFarmer(null); setInvoices([]); setOverrides({}); return; }
    (async () => {
      const [{ data: f }, { data: inv }] = await Promise.all([
        supabase.from("farmers").select("*").eq("id", farmerId).maybeSingle(),
        supabase.from("irrigation_invoices" as any)
          .select("*, lands(dag_no,land_size,mouza,field_type), seasons(name,year,type)")
          .eq("farmer_id", farmerId)
          .is("deleted_at", null)
          .neq("invoice_status", "cancelled")
          .neq("invoice_status", "paid")
          .order("due_date", { ascending: true }),
      ]);
      setFarmer(f);
      const list = (inv as any[] | null) ?? [];
      setInvoices(list);
      const ov: Record<string, Override> = {};
      list.forEach((i: any) => { ov[i.id] = blankOverride(i); });
      setOverrides(ov);
    })();
  }, [farmerId]);

  const today = new Date().toISOString().slice(0, 10);
  const overdue = useMemo(() => invoices.filter((i) => i.due_date < today || i.invoice_status === "overdue"), [invoices, today]);
  const current = useMemo(() => invoices.filter((i) => !(i.due_date < today || i.invoice_status === "overdue")), [invoices, today]);

  const totalCollected = useMemo(() => {
    return Object.values(overrides).reduce((sum, o) => {
      if (!o.selected) return sum;
      return sum + (Number(o.irrigation) || 0) + (Number(o.maintenance) || 0)
        + (Number(o.canal) || 0) + (Number(o.delay) || 0) + (Number(o.other) || 0);
    }, 0);
  }, [overrides]);

  function setOv(id: string, patch: Partial<Override>) {
    setOverrides((p) => ({ ...p, [id]: { ...p[id], ...patch } }));
  }

  function payFull(inv: Invoice) {
    const ov = overrides[inv.id];
    setOv(inv.id, {
      ...ov, selected: true,
      irrigation: Math.max(inv.irrigation_amount - 0, 0),
      maintenance: Math.max((ov.edit_maintenance ?? inv.maintenance_amount) - 0, 0),
      canal: Math.max((ov.edit_canal ?? inv.canal_amount) - 0, 0),
      delay: Math.max((ov.edit_delay ?? inv.delay_fee) - 0, 0),
      other: Math.max((ov.edit_other ?? inv.other_charge) - 0, 0),
    });
    // Subtract already paid distribution proportionally for safety
    const due = inv.due_amount;
    if (due < inv.payable_amount) {
      // partial-paid: just allocate due fully to irrigation first
      setOv(inv.id, { selected: true, irrigation: due, maintenance: 0, canal: 0, delay: 0, other: 0 });
    }
  }

  async function submit() {
    if (!farmerId || !farmer) return toast.error("কৃষক নির্বাচন করুন");
    const selected = invoices.filter((i) => overrides[i.id]?.selected);
    if (!selected.length) return toast.error("কমপক্ষে একটি ইনভয়েস নির্বাচন করুন");
    if (totalCollected <= 0) return toast.error("পরিমাণ দিন");

    setBusy(true);
    try {
      // 1. Apply any charge edits to invoices first (audit logged)
      for (const inv of selected) {
        const o = overrides[inv.id];
        const patch: any = {};
        if (o.edit_maintenance != null && Number(o.edit_maintenance) !== Number(inv.maintenance_amount)) patch.maintenance_amount = o.edit_maintenance;
        if (o.edit_canal != null && Number(o.edit_canal) !== Number(inv.canal_amount)) patch.canal_amount = o.edit_canal;
        if (o.edit_delay != null && Number(o.edit_delay) !== Number(inv.delay_fee)) patch.delay_fee = o.edit_delay;
        if (o.edit_other != null && Number(o.edit_other) !== Number(inv.other_charge)) patch.other_charge = o.edit_other;
        if (Object.keys(patch).length) {
          const { error: uerr } = await supabase.from("irrigation_invoices" as any).update(patch).eq("id", inv.id);
          if (uerr) throw uerr;
          await supabase.from("irrigation_invoice_audit" as any).insert({
            invoice_id: inv.id, action: "override", old_values: { maintenance_amount: inv.maintenance_amount, canal_amount: inv.canal_amount, delay_fee: inv.delay_fee, other_charge: inv.other_charge },
            new_values: patch, user_id: user?.id, office_id: inv.office_id, note: "Edited during payment",
          } as any);
        }
      }

      // 2. Generate receipt no
      const receipt_no = autoReceiptNo("irrigation", farmerId);

      // 3. Create payments row
      const { data: pay, error: payErr } = await supabase.from("payments").insert({
        farmer_id: farmerId,
        kind: "irrigation",
        amount: totalCollected,
        method,
        note,
        receipt_no,
        collected_by: user?.id,
        office_id: farmer?.office_id,
      } as any).select("*").single();
      if (payErr) throw payErr;

      // 4. Per-invoice link + bump paid_amount (trigger updates status)
      for (const inv of selected) {
        const o = overrides[inv.id];
        const collected = (o.irrigation || 0) + (o.maintenance || 0) + (o.canal || 0) + (o.delay || 0) + (o.other || 0);
        if (collected <= 0) continue;
        await supabase.from("irrigation_invoice_payments" as any).insert({
          invoice_id: inv.id, payment_id: pay?.id, collected_amount: collected,
          irrigation_collected: o.irrigation || 0,
          maintenance_collected: o.maintenance || 0,
          canal_collected: o.canal || 0,
          delay_fee_collected: o.delay || 0,
          office_id: inv.office_id, created_by: user?.id,
        } as any);
        // bump paid_amount on invoice
        const newPaid = Number(inv.paid_amount || 0) + collected;
        await supabase.from("irrigation_invoices" as any).update({ paid_amount: newPaid } as any).eq("id", inv.id);
        await supabase.from("irrigation_invoice_audit" as any).insert({
          invoice_id: inv.id, action: "payment_applied",
          new_values: { collected, payment_id: pay?.id, receipt_no },
          user_id: user?.id, office_id: inv.office_id,
        } as any);
      }

      toast.success(`${money(totalCollected)} টাকা সংগৃহীত — রসিদ ${receipt_no}`);

      // 5. Receipt
      try {
        await printReceipt(selected, receipt_no);
      } catch (e: any) {
        console.error("Receipt error:", e);
      }

      // Reset
      const ov: Record<string, Override> = {};
      for (const i of invoices) ov[i.id] = blankOverride(i);
      setOverrides(ov);
      // reload invoices
      const fid = farmerId; setFarmerId(null); setTimeout(() => setFarmerId(fid), 50);
    } catch (e: any) {
      toast.error(e.message || "ত্রুটি");
    } finally { setBusy(false); }
  }

  async function printReceipt(selected: Invoice[], receipt_no: string) {
    if (!farmer) return;
    const totMaintenance = selected.reduce((s, i) => s + Number(overrides[i.id]?.maintenance || 0), 0);
    const totCanal = selected.reduce((s, i) => s + Number(overrides[i.id]?.canal || 0), 0);
    const totDelay = selected.reduce((s, i) => s + Number(overrides[i.id]?.delay || 0), 0);
    const totIrr = selected.reduce((s, i) => s + Number(overrides[i.id]?.irrigation || 0), 0);
    const firstLand = selected[0]?.lands;
    const description = `Invoice: ${selected.map((i) => i.invoice_no).join(", ")}`;
    await downloadBnReceiptPdf({
      kind: "irrigation",
      receipt_no,
      date: new Date(),
      bill_info: description,
      org: { name: brand?.name, name_bn: brand?.name_bn, address: brand?.address, mobile: brand?.mobile },
      farmer: {
        name: farmer.name_bn ?? farmer.name_en ?? "",
        member_no: farmer.farmer_code,
        father_or_husband: farmer.father_name,
        village: farmer.village,
        mobile: farmer.mobile,
        mouza: firstLand?.mouza,
        dag_no: firstLand?.dag_no,
        land_size: firstLand?.land_size,
        owner_type_bn: selected[0]?.is_borga ? "বর্গাদার" : "নিজ",
      },
      current_season_charge: totIrr,
      maintenance_charge: totMaintenance,
      canal_charge: totCanal,
      penalty_amount: totDelay,
      total_outstanding: invoices.reduce((s, i) => s + Number(i.due_amount || 0), 0),
      collected_from_outstanding: totalCollected,
      collected_amount: totalCollected,
      description,
    } as any, "both", receiptArgs as any);
  }

  return (
    <>
      <PageHeader title="সেচ ইনভয়েস কালেকশন" description="ইনভয়েস ভিত্তিক সেচ চার্জ সংগ্রহ — সম্পূর্ণ বা আংশিক পরিশোধ গ্রহণ করুন।" />
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <Label>কৃষক</Label>
              <FarmerSearchSelect value={farmerId} onChange={setFarmerId} placeholder="কৃষক খুঁজুন" />
            </div>
            <div>
              <Label>পেমেন্ট পদ্ধতি</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">নগদ</SelectItem>
                  <SelectItem value="bank">ব্যাংক</SelectItem>
                  <SelectItem value="mobile">মোবাইল ব্যাংকিং</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>নোট</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ঐচ্ছিক" />
            </div>
          </div>
        </CardContent>
      </Card>

      {farmer && (
        <Card className="mt-4">
          <CardContent className="pt-6">
            <p className="text-sm">
              <strong>{farmer.name_bn ?? farmer.name_en}</strong> ({farmer.farmer_code}) — {farmer.mobile}
            </p>
          </CardContent>
        </Card>
      )}

      {overdue.length > 0 && (
        <Card className="mt-4 border-destructive/50">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-2 text-destructive">⚠️ মেয়াদোত্তীর্ণ ({overdue.length})</h3>
            <InvoiceTable invoices={overdue} overrides={overrides} setOv={setOv} payFull={payFull} editId={editId} setEditId={setEditId} />
          </CardContent>
        </Card>
      )}

      {current.length > 0 && (
        <Card className="mt-4">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-2">বর্তমান বকেয়া ({current.length})</h3>
            <InvoiceTable invoices={current} overrides={overrides} setOv={setOv} payFull={payFull} editId={editId} setEditId={setEditId} />
          </CardContent>
        </Card>
      )}

      {farmerId && !invoices.length && (
        <Card className="mt-4"><CardContent className="pt-6 text-center text-muted-foreground">কোন বকেয়া ইনভয়েস নেই</CardContent></Card>
      )}

      {invoices.length > 0 && (
        <Card className="mt-4 sticky bottom-4 shadow-lg">
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">মোট সংগ্রহ</p>
              <p className="text-2xl font-bold">{money(totalCollected)}</p>
            </div>
            <Button size="lg" onClick={submit} disabled={busy || totalCollected <= 0}>
              <Printer className="h-4 w-4 mr-2" /> {busy ? "প্রক্রিয়াকরণ…" : "পেমেন্ট নিন এবং রসিদ"}
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function InvoiceTable({ invoices, overrides, setOv, payFull, editId, setEditId }: any) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10"></TableHead>
            <TableHead>ইনভয়েস</TableHead>
            <TableHead>জমি</TableHead>
            <TableHead>মেয়াদ</TableHead>
            <TableHead className="text-right">প্রদেয়</TableHead>
            <TableHead className="text-right">বকেয়া</TableHead>
            <TableHead className="text-right">গ্রহণযোগ্য</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((inv: Invoice) => {
            const o = overrides[inv.id] || blankOverride(inv);
            const collected = (o.irrigation || 0) + (o.maintenance || 0) + (o.canal || 0) + (o.delay || 0) + (o.other || 0);
            return (
              <>
                <TableRow key={inv.id} className={o.selected ? "bg-muted/40" : ""}>
                  <TableCell>
                    <input type="checkbox" checked={o.selected} onChange={(e) => setOv(inv.id, { selected: e.target.checked })} />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{inv.invoice_no}{inv.is_borga && <Badge variant="outline" className="ml-1">বর্গা</Badge>}</TableCell>
                  <TableCell className="text-xs">{inv.lands?.mouza} • Dag {inv.lands?.dag_no}<br />{formatLandSize(inv.lands?.land_size, "short")}</TableCell>
                  <TableCell className="text-xs">{fmtDate(inv.due_date)}</TableCell>
                  <TableCell className="text-right">{money(inv.payable_amount)}</TableCell>
                  <TableCell className="text-right text-destructive font-semibold">{money(inv.due_amount)}</TableCell>
                  <TableCell className="text-right">
                    <Input type="number" className="w-28 text-right ml-auto" value={collected || ""}
                      onChange={(e) => setOv(inv.id, { selected: Number(e.target.value) > 0, irrigation: Number(e.target.value), maintenance: 0, canal: 0, delay: 0, other: 0 })} />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => payFull(inv)}>পূর্ণ</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditId(editId === inv.id ? null : inv.id)}><Pencil className="h-3 w-3" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
                {editId === inv.id && (
                  <TableRow>
                    <TableCell colSpan={8} className="bg-muted/20">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-2 text-xs">
                        <div><Label className="text-xs">সেচ গ্রহণ</Label><Input type="number" value={o.irrigation || ""} onChange={(e) => setOv(inv.id, { irrigation: Number(e.target.value), selected: true })} /></div>
                        <div><Label className="text-xs">রক্ষণাবেক্ষণ গ্রহণ</Label><Input type="number" value={o.maintenance || ""} onChange={(e) => setOv(inv.id, { maintenance: Number(e.target.value), selected: true })} /></div>
                        <div><Label className="text-xs">খাল চার্জ গ্রহণ</Label><Input type="number" value={o.canal || ""} onChange={(e) => setOv(inv.id, { canal: Number(e.target.value), selected: true })} /></div>
                        <div><Label className="text-xs">বিলম্ব ফি গ্রহণ</Label><Input type="number" value={o.delay || ""} onChange={(e) => setOv(inv.id, { delay: Number(e.target.value), selected: true })} /></div>
                        <div className="col-span-full text-muted-foreground pt-2">চার্জ পরিবর্তন (ইনভয়েসে আপডেট হবে — অডিট লগ):</div>
                        <div><Label className="text-xs">নতুন রক্ষণা.</Label><Input type="number" placeholder={String(inv.maintenance_amount)} value={o.edit_maintenance ?? ""} onChange={(e) => setOv(inv.id, { edit_maintenance: e.target.value === "" ? null : Number(e.target.value) })} /></div>
                        <div><Label className="text-xs">নতুন খাল</Label><Input type="number" placeholder={String(inv.canal_amount)} value={o.edit_canal ?? ""} onChange={(e) => setOv(inv.id, { edit_canal: e.target.value === "" ? null : Number(e.target.value) })} /></div>
                        <div><Label className="text-xs">নতুন বিলম্ব</Label><Input type="number" placeholder={String(inv.delay_fee)} value={o.edit_delay ?? ""} onChange={(e) => setOv(inv.id, { edit_delay: e.target.value === "" ? null : Number(e.target.value) })} /></div>
                        <div><Label className="text-xs">নতুন অন্যান্য</Label><Input type="number" placeholder={String(inv.other_charge)} value={o.edit_other ?? ""} onChange={(e) => setOv(inv.id, { edit_other: e.target.value === "" ? null : Number(e.target.value) })} /></div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
