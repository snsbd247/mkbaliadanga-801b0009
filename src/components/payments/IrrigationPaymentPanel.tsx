import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { useLang } from "@/i18n/LanguageProvider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FarmerSearchSelect } from "@/components/farmers/FarmerSearchSelect";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, AlertTriangle, ChevronDown, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { money, fmtDate } from "@/lib/format";
import { downloadBnReceiptPdf } from "@/lib/bnReceipts";
import { autoReceiptNo } from "@/lib/receiptNo";

type Invoice = {
  id: string;
  invoice_no: string;
  season_id: string;
  office_id: string | null;
  due_date: string;
  due_amount: number;
  paid_amount: number;
  payable_amount: number;
  irrigation_amount: number;
  delay_fee: number;
  maintenance_amount: number;
  canal_amount: number;
  other_charge: number;
  seasons?: { name: string | null; year: number | null; status: string | null } | null;
};

export function IrrigationPaymentPanel({ initialFarmerId, onPaid }: { initialFarmerId?: string; onPaid?: () => void }) {
  const { t, tx, lang } = useLang();
  const { user } = useAuth();
  const [farmerId, setFarmerId] = useState(initialFarmerId ?? "");
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // editable delay fees per invoice
  const [delayFee, setDelayFee] = useState<Record<string, number>>({});
  const [delayFeeReason, setDelayFeeReason] = useState<Record<string, string>>({});

  const [currentCollected, setCurrentCollected] = useState<number>(0);
  const [previousCollected, setPreviousCollected] = useState<number>(0);

  const [specialPermission, setSpecialPermission] = useState(false);
  const [promiseDate, setPromiseDate] = useState("");
  const [promiseRemarks, setPromiseRemarks] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");

  useEffect(() => { if (initialFarmerId) setFarmerId(initialFarmerId); }, [initialFarmerId]);

  useEffect(() => {
    if (!farmerId) { setInvoices([]); return; }
    setLoading(true);
    (async () => {
      const [{ data: act }, { data: invs }] = await Promise.all([
        supabase.from("seasons").select("id").eq("status", "active").order("year", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("irrigation_invoices")
          .select("id,invoice_no,season_id,office_id,due_date,due_amount,paid_amount,payable_amount,irrigation_amount,delay_fee,maintenance_amount,canal_amount,other_charge,seasons(name,year,status)")
          .eq("farmer_id", farmerId)
          .is("deleted_at", null)
          .neq("invoice_status", "cancelled")
          .gt("due_amount", 0)
          .order("due_date", { ascending: true }),
      ]);
      setActiveSeasonId(act?.id ?? null);
      setInvoices((invs ?? []) as any);
      setSelectedIds(new Set());
      setDelayFee({});
      setDelayFeeReason({});
      setCurrentCollected(0);
      setPreviousCollected(0);
      setSpecialPermission(false);
      setPromiseDate("");
      setPromiseRemarks("");
      setLoading(false);
    })();
  }, [farmerId]);

  const currentInvoices = useMemo(
    () => invoices.filter(i => activeSeasonId && i.season_id === activeSeasonId),
    [invoices, activeSeasonId],
  );
  const previousInvoices = useMemo(
    () => invoices.filter(i => !activeSeasonId || i.season_id !== activeSeasonId),
    [invoices, activeSeasonId],
  );

  const previousDueTotal = useMemo(
    () => previousInvoices.reduce((s, i) => s + Number(i.due_amount || 0), 0),
    [previousInvoices],
  );

  const selectedCurrentInvoices = useMemo(
    () => currentInvoices.filter(i => selectedIds.has(i.id)),
    [currentInvoices, selectedIds],
  );

  const currentPayable = useMemo(() => {
    return selectedCurrentInvoices.reduce((s, inv) => {
      const fee = delayFee[inv.id] ?? Number(inv.delay_fee || 0);
      const adjusted = Number(inv.due_amount) + (fee - Number(inv.delay_fee || 0));
      return s + Math.max(0, adjusted);
    }, 0);
  }, [selectedCurrentInvoices, delayFee]);

  const previousRemainingAfter = previousDueTotal - Number(previousCollected || 0);
  const blockedByPreviousDue = previousDueTotal > 0 && previousRemainingAfter > 0 && !specialPermission;

  const grandTotal = Number(currentCollected || 0) + Number(previousCollected || 0);

  function toggleInvoice(id: string) {
    setSelectedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  async function submit() {
    if (submitting) return;
    if (!farmerId) return toast.error(t("pickFarmer") || "Pick a farmer");
    if (grandTotal <= 0) return toast.error(tx("Enter an amount", "একটি পরিমাণ লিখুন"));
    if (Number(currentCollected) > 0 && selectedCurrentInvoices.length === 0) {
      return toast.error(tx("Select at least one current invoice", "অন্তত একটি বর্তমান ইনভয়েস বাছাই করুন"));
    }
    if (Number(previousCollected) > previousDueTotal) {
      return toast.error(tx("Previous due collected exceeds previous due", "পূর্বের বকেয়া থেকে সংগৃহীত পূর্বের মোট বকেয়ার চেয়ে বেশি"));
    }
    if (blockedByPreviousDue) {
      return toast.error(tx("Previous irrigation due must be cleared first", "আগের সেচ বকেয়া সম্পূর্ণ পরিশোধ করতে হবে"));
    }
    if (specialPermission) {
      if (!promiseDate) return toast.error(tx("Promise date required", "প্রতিশ্রুতির তারিখ আবশ্যক"));
      if (!promiseRemarks.trim()) return toast.error(tx("Remarks required for special permission", "বিশেষ অনুমতির জন্য মন্তব্য আবশ্যক"));
    }

    setSubmitting(true);
    try {
      const officeId = (selectedCurrentInvoices[0]?.office_id ?? previousInvoices[0]?.office_id) ?? null;

      // 1) Insert payment row
      const { data: ins, error: payErr } = await supabase.from("payments").insert({
        farmer_id: farmerId,
        kind: "irrigation",
        amount: grandTotal,
        method,
        note: note || null,
        collected_by: user?.id,
        status: "approved",
        office_id: officeId,
      }).select("id").single();
      if (payErr) throw payErr;
      const paymentId = ins!.id as string;

      // 2) Allocate currentCollected across selected current invoices (oldest first)
      let remainingCurrent = Number(currentCollected || 0);
      const sorted = [...selectedCurrentInvoices].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
      for (const inv of sorted) {
        if (remainingCurrent <= 0) break;
        const originalFee = Number(inv.delay_fee || 0);
        const newFee = delayFee[inv.id] ?? originalFee;
        const adjustedDue = Math.max(0, Number(inv.due_amount) + (newFee - originalFee));
        const take = Math.min(remainingCurrent, adjustedDue);
        if (take <= 0) continue;

        // delay-fee override audit
        if (newFee !== originalFee) {
          await supabase.from("irrigation_delay_fee_audit").insert({
            invoice_id: inv.id, payment_id: paymentId,
            original_amount: originalFee, modified_amount: newFee,
            reason: delayFeeReason[inv.id] || null,
            changed_by: user?.id, office_id: inv.office_id,
          });
          // also update the invoice's delay_fee snapshot
          await supabase.from("irrigation_invoices")
            .update({ delay_fee: newFee, payable_amount: Number(inv.payable_amount) + (newFee - originalFee), due_amount: Number(inv.due_amount) + (newFee - originalFee) })
            .eq("id", inv.id);
        }

        // update paid amount
        await supabase.from("irrigation_invoices")
          .update({ paid_amount: Number(inv.paid_amount) + take })
          .eq("id", inv.id);

        // split allocation row
        await supabase.from("irrigation_invoice_payments").insert({
          invoice_id: inv.id,
          payment_id: paymentId,
          office_id: inv.office_id,
          collected_amount: take,
          irrigation_collected: take,
          current_invoice_collected: take,
          previous_due_collected: 0,
          delay_fee_original: newFee !== originalFee ? originalFee : null,
          delay_fee_override_reason: newFee !== originalFee ? (delayFeeReason[inv.id] || null) : null,
          created_by: user?.id,
        });
        remainingCurrent -= take;
      }

      // 3) Allocate previousCollected across previous invoices (oldest first)
      let remainingPrev = Number(previousCollected || 0);
      const sortedPrev = [...previousInvoices].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
      for (const inv of sortedPrev) {
        if (remainingPrev <= 0) break;
        const take = Math.min(remainingPrev, Number(inv.due_amount));
        if (take <= 0) continue;
        await supabase.from("irrigation_invoices")
          .update({ paid_amount: Number(inv.paid_amount) + take })
          .eq("id", inv.id);
        await supabase.from("irrigation_invoice_payments").insert({
          invoice_id: inv.id,
          payment_id: paymentId,
          office_id: inv.office_id,
          collected_amount: take,
          irrigation_collected: take,
          current_invoice_collected: 0,
          previous_due_collected: take,
          created_by: user?.id,
        });
        remainingPrev -= take;
      }

      // 4) Promise record
      if (specialPermission) {
        await supabase.from("irrigation_due_promises").insert({
          office_id: officeId,
          farmer_id: farmerId,
          payment_id: paymentId,
          previous_due_amount: previousRemainingAfter,
          promise_date: promiseDate,
          remarks: promiseRemarks,
          approved_by: user?.id,
          status: "pending",
        });
      }

      // 4b) Split-ledger journal posting (Dr Cash / Cr 5 income heads)
      try {
        const totalDelayCollected = sorted.reduce((s, inv) => {
          const fee = delayFee[inv.id] ?? Number(inv.delay_fee || 0);
          return s + fee;
        }, 0);
        const totalMaintCollected = sorted.reduce((s, inv) => s + Number(inv.maintenance_amount || 0), 0);
        const totalCanalCollected = sorted.reduce((s, inv) => s + Number(inv.canal_amount || 0), 0);
        // Irrigation portion = current_collected − (delay+maint+canal portions, capped)
        const cur = Number(currentCollected || 0);
        const overhead = Math.min(cur, totalDelayCollected + totalMaintCollected + totalCanalCollected);
        const scale = overhead > 0 ? Math.min(1, cur / (totalDelayCollected + totalMaintCollected + totalCanalCollected)) : 0;
        const delayPart = +(totalDelayCollected * scale).toFixed(2);
        const maintPart = +(totalMaintCollected * scale).toFixed(2);
        const canalPart = +(totalCanalCollected * scale).toFixed(2);
        const irrPart = +(cur - delayPart - maintPart - canalPart).toFixed(2);
        const prevPart = +Number(previousCollected || 0).toFixed(2);

        const codes = ["1010", "IRR-INCOME", "IRR-PREV-DUE", "IRR-DELAY", "IRR-MAINT", "IRR-CANAL"];
        const { data: accs } = await supabase.from("accounts").select("id,code").in("code", codes);
        const byCode = Object.fromEntries((accs ?? []).map((a: any) => [a.code, a.id]));

        if (byCode["1010"]) {
          const { data: je, error: jeErr } = await supabase.from("journal_entries").insert({
            entry_date: new Date().toISOString().slice(0, 10),
            reference: receiptNoForJournal(paymentId),
            description: `Irrigation payment ${paymentId.slice(0, 8)}`,
            office_id: officeId,
            posted: true,
            posted_at: new Date().toISOString(),
            created_by: user?.id,
          }).select("id").single();
          if (!jeErr && je) {
            const lines: any[] = [
              { journal_id: je.id, account_id: byCode["1010"], debit: grandTotal, credit: 0, position: 0, description: "Cash received" },
            ];
            let pos = 1;
            const credits: Array<[string, number]> = [
              ["IRR-INCOME", irrPart],
              ["IRR-DELAY", delayPart],
              ["IRR-MAINT", maintPart],
              ["IRR-CANAL", canalPart],
              ["IRR-PREV-DUE", prevPart],
            ];
            for (const [code, amt] of credits) {
              if (amt > 0 && byCode[code]) {
                lines.push({ journal_id: je.id, account_id: byCode[code], debit: 0, credit: amt, position: pos++, description: code });
              }
            }
            await supabase.from("journal_entry_lines").insert(lines);
          }
        }
      } catch (jErr) {
        console.warn("[irrigation-pay] journal posting failed", jErr);
      }

      const receiptNo = autoReceiptNo("IRR", paymentId);
      try {
        const [{ data: farmer }, { data: company }] = await Promise.all([
          supabase.from("farmers").select("name_bn,name_en,member_no,village,mobile").eq("id", farmerId).maybeSingle(),
          supabase.from("company_settings").select("company_name,company_name_bn,address,mobile,email,registration_no,logo_url").eq("id", 1).maybeSingle(),
        ]);
        const farmerName = (farmer?.name_bn || farmer?.name_en || "").trim();
        const totalDelay = sorted.reduce((s, inv) => s + (delayFee[inv.id] ?? Number(inv.delay_fee || 0)), 0);
        const totalMaint = sorted.reduce((s, inv) => s + Number(inv.maintenance_amount || 0), 0);
        const totalCanal = sorted.reduce((s, inv) => s + Number(inv.canal_amount || 0), 0);
        await downloadBnReceiptPdf({
          kind: "irrigation",
          receipt_no: receiptNo,
          date: new Date(),
          company_name: company?.company_name ?? undefined,
          company_name_bn: company?.company_name_bn ?? undefined,
          logo_url: company?.logo_url ?? null,
          org: company ?? null,
          farmer: { name: farmerName, member_no: farmer?.member_no ?? null, village: farmer?.village ?? null, mobile: farmer?.mobile ?? null },
          current_season_charge: Number(currentCollected || 0),
          collected_from_outstanding: Number(previousCollected || 0),
          total_outstanding: previousDueTotal,
          penalty_amount: totalDelay,
          maintenance_charge: totalMaint,
          canal_charge: totalCanal,
          collected_amount: grandTotal,
          remark: specialPermission ? `${tx("Special permission until", "বিশেষ অনুমতি — পরিশোধের তারিখ")}: ${promiseDate}${promiseRemarks ? " — " + promiseRemarks : ""}` : (note || null),
        }, "both");

        if (farmer?.mobile) {
          const remaining = Math.max(0, previousDueTotal - Number(previousCollected || 0));
          const promiseLine = specialPermission && promiseDate
            ? `\n${tx("Promise date", "প্রতিশ্রুতির তারিখ")}: ${promiseDate}` : "";
          const message = tx(
            `Irrigation payment received.\nCurrent: BDT ${Number(currentCollected || 0).toLocaleString()}\nPrevious due: BDT ${Number(previousCollected || 0).toLocaleString()}\nRemaining previous due: BDT ${remaining.toLocaleString()}${promiseLine}\nReceipt: ${receiptNo}`,
            `সেচের পেমেন্ট গ্রহণ করা হয়েছে।\nবর্তমান: ৳${Number(currentCollected || 0).toLocaleString()}\nপূর্বের বকেয়া: ৳${Number(previousCollected || 0).toLocaleString()}\nঅবশিষ্ট পূর্বের বকেয়া: ৳${remaining.toLocaleString()}${promiseLine}\nরসিদ: ${receiptNo}`,
          );
          await supabase.functions.invoke("send-sms", { body: { mobile: farmer.mobile, message, event_type: "irrigation_payment", farmer_id: farmerId } });
        }
      } catch (rcptErr) {
        console.warn("[irrigation-pay] receipt/SMS failed", rcptErr);
      }

      toast.success(tx("Payment recorded", "পেমেন্ট সংরক্ষিত হয়েছে"));
      // refresh
      setFarmerId(farmerId);
      setCurrentCollected(0);
      setPreviousCollected(0);
      setSelectedIds(new Set());
      setSpecialPermission(false);
      setPromiseDate("");
      setPromiseRemarks("");
      setNote("");
      onPaid?.();
      // re-trigger load
      const { data: invs } = await supabase.from("irrigation_invoices")
        .select("id,invoice_no,season_id,office_id,due_date,due_amount,paid_amount,payable_amount,irrigation_amount,delay_fee,maintenance_amount,canal_amount,other_charge,seasons(name,year,status)")
        .eq("farmer_id", farmerId).is("deleted_at", null).neq("invoice_status", "cancelled").gt("due_amount", 0)
        .order("due_date", { ascending: true });
      setInvoices((invs ?? []) as any);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <Label>{tx("Select farmer", "ফার্মার বাছাই")}</Label>
        <FarmerSearchSelect value={farmerId || null} onChange={(id) => setFarmerId(id ?? "")} />
      </Card>

      {farmerId && loading && (
        <div className="text-center py-6 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" /> {tx("Loading…", "লোড হচ্ছে…")}</div>
      )}

      {farmerId && !loading && invoices.length === 0 && (
        <Alert><AlertDescription>{tx("No outstanding irrigation invoices for this farmer.", "এই ফার্মারের কোনো বকেয়া সেচ ইনভয়েস নেই।")}</AlertDescription></Alert>
      )}

      {farmerId && !loading && currentInvoices.length > 0 && (
        <Card className="p-4 space-y-3">
          <h3 className="font-semibold">{tx("Current Invoice (বর্তমান বকেয়া)", "বর্তমান বকেয়া")}</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>{tx("Invoice", "ইনভয়েস")}</TableHead>
                <TableHead>{tx("Season", "সিজন")}</TableHead>
                <TableHead className="text-right">{tx("Irrigation", "সেচ")}</TableHead>
                <TableHead className="text-right">{tx("Delay Fee", "বিলম্ব ফি")}</TableHead>
                <TableHead className="text-right">{tx("Maintenance", "রক্ষণাবেক্ষণ")}</TableHead>
                <TableHead className="text-right">{tx("Canal", "ক্যানেল")}</TableHead>
                <TableHead className="text-right">{tx("Due", "বকেয়া")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentInvoices.map(inv => {
                const checked = selectedIds.has(inv.id);
                const fee = delayFee[inv.id] ?? Number(inv.delay_fee || 0);
                const original = Number(inv.delay_fee || 0);
                const overridden = fee !== original;
                return (
                  <>
                    <TableRow key={inv.id} className={checked ? "bg-muted/30" : ""}>
                      <TableCell><input type="checkbox" checked={checked} onChange={() => toggleInvoice(inv.id)} /></TableCell>
                      <TableCell className="font-mono text-xs">{inv.invoice_no}</TableCell>
                      <TableCell className="text-xs">{inv.seasons?.name} {inv.seasons?.year}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{money(inv.irrigation_amount)}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number" className="h-7 text-xs text-right w-24 ml-auto font-mono"
                          value={fee}
                          onChange={(e) => setDelayFee(p => ({ ...p, [inv.id]: Number(e.target.value || 0) }))}
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">{money(inv.maintenance_amount)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{money(inv.canal_amount)}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">{money(Number(inv.due_amount) + (fee - original))}</TableCell>
                    </TableRow>
                    {overridden && (
                      <TableRow key={inv.id + "-r"}>
                        <TableCell colSpan={8} className="bg-amber-50/40 dark:bg-amber-950/20">
                          <div className="flex items-center gap-2 text-xs">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                            <span>{tx("Delay fee overridden — reason required", "বিলম্ব ফি পরিবর্তিত — কারণ আবশ্যক")}:</span>
                            <Input
                              className="h-7 text-xs flex-1"
                              value={delayFeeReason[inv.id] ?? ""}
                              onChange={(e) => setDelayFeeReason(p => ({ ...p, [inv.id]: e.target.value }))}
                              placeholder={tx("Reason for override", "পরিবর্তনের কারণ")}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between border-t pt-3">
            <div className="text-sm">
              {tx("Selected payable", "বাছাইকৃত পরিশোধযোগ্য")}: <span className="font-mono font-semibold">{money(currentPayable)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm">{tx("Current invoice received (বকেয়া)", "বকেয়া হতে গৃহীত")}</Label>
              <Input
                type="number" className="w-32 font-mono"
                value={currentCollected || ""}
                onChange={(e) => setCurrentCollected(Number(e.target.value || 0))}
              />
            </div>
          </div>
        </Card>
      )}

      {farmerId && !loading && previousInvoices.length > 0 && (
        <Card className="p-4 space-y-3 border-amber-300 dark:border-amber-800">
          <Alert variant="destructive" className="border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {tx("This farmer has previous-season unpaid irrigation invoices.", "এই কৃষকের পূর্বের বকেয়া ইনভয়েস রয়েছে")}
            </AlertDescription>
          </Alert>
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex items-center gap-1 text-sm font-medium">
              <ChevronDown className="h-4 w-4" /> {tx("Previous unpaid invoices", "পূর্বের অপরিশোধিত ইনভয়েস")} ({previousInvoices.length})
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>{tx("Season", "সিজন")}</TableHead>
                  <TableHead>{tx("Invoice", "ইনভয়েস")}</TableHead>
                  <TableHead>{tx("Due Date", "নির্ধারিত তারিখ")}</TableHead>
                  <TableHead className="text-right">{tx("Due", "বকেয়া")}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {previousInvoices.map(inv => (
                    <TableRow key={inv.id}>
                      <TableCell className="text-xs">{inv.seasons?.name} {inv.seasons?.year}</TableCell>
                      <TableCell className="font-mono text-xs">{inv.invoice_no}</TableCell>
                      <TableCell className="text-xs">{fmtDate(inv.due_date)}</TableCell>
                      <TableCell className="text-right font-mono">{money(inv.due_amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CollapsibleContent>
          </Collapsible>
          <div className="flex items-center justify-between border-t pt-3">
            <div className="text-sm">
              {tx("Previous due total", "মোট পূর্বের বকেয়া")}: <span className="font-mono font-semibold">{money(previousDueTotal)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm">{tx("Previous due received (পূর্বের বকেয়া হতে)", "পূর্বের বকেয়া হতে গৃহীত")}</Label>
              <Input
                type="number" className="w-32 font-mono"
                value={previousCollected || ""}
                onChange={(e) => setPreviousCollected(Number(e.target.value || 0))}
              />
            </div>
          </div>

          {previousDueTotal > 0 && previousRemainingAfter > 0 && (
            <div className="rounded-md border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2 cursor-pointer">
                  <Switch checked={specialPermission} onCheckedChange={setSpecialPermission} />
                  <span>{tx("Accept under special permission (বিশেষ অনুমতিতে গ্রহণ)", "বিশেষ অনুমতিতে গ্রহণ করুন")}</span>
                </Label>
                <Badge variant="outline">{tx("Remaining after this payment", "বাকি থাকবে")}: {money(previousRemainingAfter)}</Badge>
              </div>
              {specialPermission && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">{tx("Promise date", "প্রতিশ্রুতির তারিখ")} *</Label>
                    <Input type="date" value={promiseDate} onChange={(e) => setPromiseDate(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">{tx("Remarks", "মন্তব্য")} *</Label>
                    <Input value={promiseRemarks} onChange={(e) => setPromiseRemarks(e.target.value)} placeholder={tx("e.g. will clear by Jul 31", "যেমন: ৩১ জুলাইয়ের মধ্যে পরিশোধ করবে")} />
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {farmerId && !loading && invoices.length > 0 && (
        <Card className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>{tx("Method", "পেমেন্ট মাধ্যম")}</Label>
              <Input value={method} onChange={(e) => setMethod(e.target.value)} />
            </div>
            <div>
              <Label>{tx("Note", "নোট")}</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-between border-t pt-3">
            <div className="text-base">
              <div className="text-xs text-muted-foreground">{tx("Grand total received", "মোট গ্রহণ")}</div>
              <div className="text-2xl font-mono font-bold">{money(grandTotal)}</div>
            </div>
            <Button size="lg" onClick={submit} disabled={submitting || grandTotal <= 0 || blockedByPreviousDue}>
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />{tx("Saving…", "সংরক্ষণ…")}</> : <><CheckCircle2 className="h-4 w-4 mr-2" />{tx("Receive Payment", "পেমেন্ট গ্রহণ")}</>}
            </Button>
          </div>
          {blockedByPreviousDue && (
            <p className="text-xs text-destructive">{tx("Submit blocked: previous irrigation due not fully cleared. Enable special permission to bypass.", "জমা করা যাবে না: আগের সেচ বকেয়া পরিশোধ হয়নি। অনুমতি দিতে চাইলে বিশেষ অনুমতি চালু করুন।")}</p>
          )}
        </Card>
      )}
    </div>
  );
}
