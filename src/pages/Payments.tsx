import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FarmerSearchSelect } from "@/components/farmers/FarmerSearchSelect";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useLang } from "@/i18n/LanguageProvider";
import { money, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { Paperclip, Check, X, FileText, Plus, Trash2, Printer } from "lucide-react";
import { exportPaymentReceiptPDF } from "@/lib/exports";
import { useBranding } from "@/lib/branding";

type Allocation = { kind: "loan" | "savings" | "irrigation"; reference_id: string; amount: number };

const newKey = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto) ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

export default function Payments() {
  const { t } = useLang();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const brand = useBranding();
  const [farmers, setFarmers] = useState<any[]>([]);
  const [list, setList] = useState<any[]>([]);
  const [farmerId, setFarmerId] = useState(params.get("farmer") ?? "");
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");
  const [allocs, setAllocs] = useState<Allocation[]>([{ kind: "irrigation", reference_id: "", amount: 0 }]);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [openLoans, setOpenLoans] = useState<any[]>([]);
  const [openIrr, setOpenIrr] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [idemKey, setIdemKey] = useState<string>(newKey());
  const [priority, setPriority] = useState<string[]>(["irrigation", "loan", "savings"]);
  const [autoAmount, setAutoAmount] = useState<number>(0);

  useEffect(() => { document.title = `${t("payments")} — ${t("appName")}`; load(); checkRole(); loadPriority(); }, []);
  useEffect(() => { if (farmerId) loadDues(); else { setOpenLoans([]); setOpenIrr([]); } }, [farmerId]);
  useEffect(() => { const f = params.get("farmer"); if (f) setFarmerId(f); }, [params]);

  async function loadPriority() {
    if (!user) return;
    const { data: prof } = await supabase.from("profiles").select("office_id").eq("id", user.id).maybeSingle();
    if (!prof?.office_id) return;
    const { data: off } = await supabase.from("offices").select("payment_priority").eq("id", prof.office_id).maybeSingle();
    if (off?.payment_priority?.length) setPriority(off.payment_priority as string[]);
  }

  async function checkRole() {
    if (!user) return;
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    setIsAdmin((data ?? []).some((r: any) => r.role === "committee" || r.role === "super_admin"));
  }

  async function load() {
    const [f, p] = await Promise.all([
      supabase.from("farmers").select("id,name_en,farmer_code").order("name_en"),
      supabase.from("payments").select("*, farmers(name_en,farmer_code), payment_allocations(*)").is("deleted_at", null).order("created_at", { ascending: false }).limit(100),
    ]);
    setFarmers(f.data ?? []); setList(p.data ?? []);
  }
  async function loadDues() {
    const [l, i] = await Promise.all([
      supabase.from("loans").select("id,principal,total_payable,issued_on,loan_payments(amount)").eq("farmer_id", farmerId).eq("status", "approved"),
      supabase.from("irrigation_charges").select("id,total,paid_amount,due_amount,entry_date").eq("farmer_id", farmerId).is("deleted_at", null).gt("due_amount", 0),
    ]);
    setOpenLoans(l.data ?? []); setOpenIrr(i.data ?? []);
  }

  const totalAmount = useMemo(() => allocs.reduce((s, a) => s + Number(a.amount || 0), 0), [allocs]);

  async function uploadReceipt(paymentId: string): Promise<string | null> {
    if (!receiptFile) return null;
    const ext = receiptFile.name.split(".").pop();
    const path = `${user?.id}/${paymentId}.${ext}`;
    const { error } = await supabase.storage.from("payment-receipts").upload(path, receiptFile, { upsert: true });
    if (error) { toast.error("Receipt upload failed: " + error.message); return null; }
    const { data } = await supabase.storage.from("payment-receipts").createSignedUrl(path, 60 * 60 * 24 * 365);
    return data?.signedUrl ?? path;
  }

  function resetForm() {
    setAllocs([{ kind: "irrigation", reference_id: "", amount: 0 }]);
    setNote(""); setReceiptFile(null); setIdemKey(newKey());
  }

  async function pay() {
    if (submitting) return;
    if (!farmerId) return toast.error("Pick a farmer");
    if (totalAmount <= 0) return toast.error("Total must be > 0");
    for (const a of allocs) {
      if (Number(a.amount) <= 0) return toast.error("Each allocation must be > 0");
      if ((a.kind === "loan" || a.kind === "irrigation") && !a.reference_id) return toast.error(`Pick target for ${a.kind}`);
    }

    setSubmitting(true);
    try {
      const status = receiptFile ? "pending" : "approved";
      // Primary kind = first allocation kind (kept for backward compat)
      const primary = allocs[0];
      const payload: any = {
        farmer_id: farmerId,
        kind: primary.kind,
        amount: totalAmount,
        method, note,
        reference_id: primary.reference_id || null,
        collected_by: user?.id,
        status,
        idempotency_key: idemKey,
      };

      const { data: inserted, error } = await supabase.from("payments").insert(payload).select("id").single();
      if (error) {
        if ((error as any).code === "23505" || /duplicate/i.test(error.message)) {
          toast.error("Duplicate submission detected — this payment was already recorded.");
          return;
        }
        return toast.error(error.message);
      }

      // Insert allocations
      const allocRows = allocs.map(a => ({ payment_id: inserted!.id, kind: a.kind, reference_id: a.reference_id || null, amount: Number(a.amount) }));
      const { error: aErr } = await supabase.from("payment_allocations").insert(allocRows);
      if (aErr) toast.error("Allocations: " + aErr.message);

      if (receiptFile) {
        const url = await uploadReceipt(inserted.id);
        if (url) await supabase.from("payments").update({ receipt_url: url }).eq("id", inserted.id);
      }

      if (status === "approved") await applyAllocationsToLedgers(inserted.id, farmerId, allocs, note);

      toast.success(status === "pending" ? "Submitted for approval" : t("paymentSuccess"));
      resetForm();
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function applyAllocationsToLedgers(_paymentId: string, fId: string, list: Allocation[], desc?: string) {
    const noteText = desc?.trim() || undefined;
    for (const a of list) {
      if (a.kind === "loan" && a.reference_id) {
        await supabase.from("loan_payments").insert({ loan_id: a.reference_id, amount: Number(a.amount), collected_by: user?.id, note: noteText });
      } else if (a.kind === "irrigation" && a.reference_id) {
        const { data: irr } = await supabase.from("irrigation_charges").select("paid_amount").eq("id", a.reference_id).single();
        if (irr) await supabase.from("irrigation_charges").update({ paid_amount: Number(irr.paid_amount) + Number(a.amount) }).eq("id", a.reference_id);
      } else if (a.kind === "savings") {
        await supabase.from("savings_transactions").insert({ farmer_id: fId, type: "deposit", amount: Number(a.amount), status: "approved", created_by: user?.id, note: noteText });
      }
    }
  }

  async function approvePayment(p: any) {
    const { error } = await supabase.from("payments").update({ status: "approved", approved_by: user?.id, approved_at: new Date().toISOString() }).eq("id", p.id);
    if (error) return toast.error(error.message);

    const allocList: Allocation[] = (p.payment_allocations ?? []).length > 0
      ? p.payment_allocations.map((x: any) => ({ kind: x.kind, reference_id: x.reference_id ?? "", amount: Number(x.amount) }))
      : [{ kind: p.kind, reference_id: p.reference_id ?? "", amount: Number(p.amount) }];

    await applyAllocationsToLedgers(p.id, p.farmer_id, allocList, p.note);
    toast.success("Approved");
    load();
  }

  async function rejectPayment(p: any) {
    const { error } = await supabase.from("payments").update({ status: "rejected", approved_by: user?.id, approved_at: new Date().toISOString() }).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Rejected");
    load();
  }

  function updateAlloc(i: number, patch: Partial<Allocation>) {
    setAllocs(prev => prev.map((a, idx) => idx === i ? { ...a, ...patch } : a));
  }

  function autoAllocate() {
    const amt = Number(autoAmount);
    if (!farmerId) return toast.error("Pick a farmer");
    if (!(amt > 0)) return toast.error("Enter amount to auto-allocate");

    // Build queue per priority with oldest-first dues
    const queues: Record<string, { reference_id: string; due: number }[]> = {
      irrigation: [...openIrr]
        .sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime())
        .map(i => ({ reference_id: i.id, due: Number(i.due_amount || 0) }))
        .filter(x => x.due > 0),
      loan: [...openLoans]
        .map(l => {
          const paid = (l.loan_payments ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0);
          return { reference_id: l.id, due: Math.max(0, Number(l.total_payable || 0) - paid), issued_on: l.issued_on };
        })
        .filter(x => x.due > 0)
        .sort((a, b) => new Date(a.issued_on).getTime() - new Date(b.issued_on).getTime()),
      savings: [], // savings = deposit, no "due"; consumes remainder
    };

    let remaining = amt;
    const out: Allocation[] = [];
    for (const kind of priority) {
      if (remaining <= 0) break;
      if (kind === "savings") {
        out.push({ kind: "savings", reference_id: "", amount: +remaining.toFixed(2) });
        remaining = 0;
        break;
      }
      const q = queues[kind] ?? [];
      for (const item of q) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, item.due);
        if (take > 0) {
          out.push({ kind: kind as any, reference_id: item.reference_id, amount: +take.toFixed(2) });
          remaining -= take;
        }
      }
    }
    if (remaining > 0) {
      // Surplus → savings deposit
      out.push({ kind: "savings", reference_id: "", amount: +remaining.toFixed(2) });
    }
    if (!out.length) return toast.error("No outstanding dues to allocate");
    setAllocs(out);
    toast.success(`Allocated to ${out.length} target(s) using office priority: ${priority.join(" → ")}`);
  }

  return (
    <>
      <PageHeader title={t("payments")} description="Unified payment — splits across loan, savings & irrigation in one entry" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-1">
          <h2 className="font-semibold mb-1">{t("payNow")}</h2>
          <p className="text-xs text-muted-foreground mb-3">Approved payments automatically update loan, savings &amp; irrigation ledgers.</p>
          <div className="space-y-3">
            <div><Label>{t("selectFarmer")}</Label>
              <FarmerSearchSelect value={farmerId || null}
                onChange={(id) => { setFarmerId(id ?? ""); setAllocs([{ kind: "irrigation", reference_id: "", amount: 0 }]); }} />

            </div>

            {farmerId && (
              <div className="rounded-md bg-muted/40 p-2 text-xs space-y-0.5">
                <div className="font-semibold uppercase text-[10px] text-muted-foreground">{t("outstandingDues")}</div>
                <div className="flex justify-between"><span>{t("irrigation")}</span><span className="font-mono">{money(openIrr.reduce((s, x) => s + Number(x.due_amount || 0), 0))}</span></div>
                <div className="flex justify-between"><span>{t("loans")}</span><span className="font-mono">{money(openLoans.reduce((s, l) => s + (Number(l.total_payable) - (l.loan_payments ?? []).reduce((a: number, p: any) => a + Number(p.amount), 0)), 0))}</span></div>
              </div>
            )}

            {farmerId && (
              <div className="rounded-md border border-dashed p-2 space-y-2">
                <div className="text-[10px] uppercase font-semibold text-muted-foreground">Auto-allocate (priority: {priority.join(" → ")})</div>
                <div className="flex gap-2">
                  <Input type="number" min="0" placeholder="Total amount" value={autoAmount || ""} onChange={(e) => setAutoAmount(+e.target.value)} />
                  <Button type="button" variant="secondary" onClick={autoAllocate}>{t("apply")}</Button>
                </div>
                <p className="text-[10px] text-muted-foreground">Configurable per office in Settings → Offices.</p>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t("allocations")}</Label>
                <Button type="button" size="sm" variant="ghost" onClick={() => setAllocs([...allocs, { kind: "irrigation", reference_id: "", amount: 0 }])}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Add
                </Button>
              </div>
              {allocs.map((a, i) => (
                <div key={i} className="rounded-md border p-2 space-y-2">
                  <div className="flex gap-2">
                    <Select value={a.kind} onValueChange={(v: any) => updateAlloc(i, { kind: v, reference_id: "" })}>
                      <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="irrigation">{t("irrigation")}</SelectItem>
                        <SelectItem value="loan">{t("loans")}</SelectItem>
                        <SelectItem value="savings">{t("savings")}</SelectItem>
                      </SelectContent>
                    </Select>
                    {allocs.length > 1 && (
                      <Button type="button" size="icon" variant="ghost" onClick={() => setAllocs(allocs.filter((_, idx) => idx !== i))}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                  {a.kind === "loan" && (
                    <Select value={a.reference_id} onValueChange={(v) => updateAlloc(i, { reference_id: v })}>
                      <SelectTrigger><SelectValue placeholder={openLoans.length ? "Pick loan" : "No open loans"} /></SelectTrigger>
                      <SelectContent>{openLoans.map(l => {
                        const paid = (l.loan_payments ?? []).reduce((x: number, p: any) => x + Number(p.amount), 0);
                        return <SelectItem key={l.id} value={l.id}>{fmtDate(l.issued_on)} — Due {money(Number(l.total_payable) - paid)}</SelectItem>;
                      })}</SelectContent>
                    </Select>
                  )}
                  {a.kind === "irrigation" && (
                    <Select value={a.reference_id} onValueChange={(v) => updateAlloc(i, { reference_id: v })}>
                      <SelectTrigger><SelectValue placeholder={openIrr.length ? "Pick charge" : "No open charges"} /></SelectTrigger>
                      <SelectContent>{openIrr.map(ic => <SelectItem key={ic.id} value={ic.id}>{fmtDate(ic.entry_date)} — Due {money(ic.due_amount)}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                  <Input type="number" placeholder="Amount" value={a.amount || ""} onChange={(e) => updateAlloc(i, { amount: +e.target.value })} />
                </div>
              ))}
              <div className="text-right text-sm font-semibold">Total: {money(totalAmount)}</div>
            </div>

            <div><Label>{t("method")}</Label><Input value={method} onChange={e => setMethod(e.target.value)} /></div>
            <div><Label>{t("note")}</Label><Input value={note} onChange={e => setNote(e.target.value)} /></div>
            <div>
              <Label className="flex items-center gap-1"><Paperclip className="h-3.5 w-3.5" /> Receipt (optional, requires approval)</Label>
              <Input type="file" accept="image/*,application/pdf" onChange={e => setReceiptFile(e.target.files?.[0] ?? null)} />
              {receiptFile && <p className="text-xs text-muted-foreground mt-1">{receiptFile.name}</p>}
            </div>
            <Button className="w-full" onClick={pay} disabled={submitting}>
              {submitting ? "Processing…" : t("payNow")}
            </Button>
            <p className="text-[10px] text-muted-foreground">Idempotency key: <span className="font-mono">{idemKey.slice(0, 8)}…</span></p>
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h2 className="font-semibold mb-3">{t("recentTransactions")}</h2>
          <Table>
            <TableHeader><TableRow><TableHead>{t("date")}</TableHead><TableHead>{t("farmerName")}</TableHead><TableHead>{t("allocations")}</TableHead><TableHead>{t("amount")}</TableHead><TableHead>{t("status")}</TableHead><TableHead>{t("receipt")}</TableHead><TableHead>{t("action")}</TableHead></TableRow></TableHeader>
            <TableBody>
              {list.map(p => (
                <TableRow key={p.id}>
                  <TableCell>{fmtDate(p.created_at)}</TableCell>
                  <TableCell>{p.farmers?.name_en} <span className="text-xs text-muted-foreground">({p.farmers?.farmer_code})</span></TableCell>
                  <TableCell className="space-x-1">
                    {(p.payment_allocations ?? []).length > 0
                      ? p.payment_allocations.map((a: any) => <Badge key={a.id} variant="outline">{a.kind} {money(a.amount)}</Badge>)
                      : <Badge variant="outline">{p.kind}</Badge>}
                  </TableCell>
                  <TableCell className="font-semibold text-success">{money(p.amount)}</TableCell>
                  <TableCell>
                    <Badge variant={p.status === "approved" ? "default" : p.status === "rejected" ? "destructive" : "secondary"}>
                      {p.status ?? "approved"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {p.receipt_url ? (
                      <a href={p.receipt_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline text-xs">
                        <FileText className="h-3.5 w-3.5" /> View
                      </a>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {isAdmin && p.status === "pending" && (<>
                        <Button size="icon" variant="ghost" onClick={() => approvePayment(p)} title="Approve"><Check className="h-4 w-4 text-success" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => rejectPayment(p)} title="Reject"><X className="h-4 w-4 text-destructive" /></Button>
                      </>)}
                      <Button size="icon" variant="ghost" title="Print Receipt" onClick={() => exportPaymentReceiptPDF({
                        brand: { company_name: brand.company_name, address: brand.address, mobile: brand.mobile },
                        receipt_no: p.id.slice(0, 8).toUpperCase(),
                        date: p.created_at,
                        farmer: { name_en: p.farmers?.name_en ?? "—", farmer_code: p.farmers?.farmer_code, mobile: p.farmers?.mobile },
                        amount: Number(p.amount),
                        method: p.method ?? "cash",
                        note: p.note ?? "",
                        allocations: (p.payment_allocations?.length ? p.payment_allocations : [{ kind: p.kind, amount: Number(p.amount) }])
                          .map((a: any) => ({ kind: a.kind, amount: Number(a.amount) })),
                      })}><Printer className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {list.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">{t("noData")}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Card>
      </div>
    </>
  );
}
