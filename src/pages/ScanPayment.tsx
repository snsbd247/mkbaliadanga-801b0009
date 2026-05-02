import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { useLang } from "@/i18n/LanguageProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Camera, X, User, CheckCircle2, FileDown, Eye } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { downloadPaymentReceiptPdf, previewPaymentReceiptPdf, maskToken, type PaymentReceiptData } from "@/lib/paymentReceiptPdf";
import { useBranding } from "@/lib/branding";
import { useReceiptTemplate } from "@/lib/receiptTemplate";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

type Resolved = {
  farmer: {
    id: string; name: string; farmer_code?: string; member_no?: string;
    mobile_masked?: string | null; village?: string; photo_url?: string | null; office_id?: string | null;
  };
  summary: { loan_due: number; irrigation_due: number; savings_balance: number };
};

const PaySchema = z.object({
  amount: z.number().positive("Amount must be greater than 0").max(10_000_000, "Amount too large"),
  kind: z.enum(["loan", "savings", "irrigation", "other"]),
  note: z.string().max(500).optional(),
});

const fmt = (n: number) => new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function ScanPayment() {
  const { t } = useLang();
  const { user } = useAuth();
  const [scanning, setScanning] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [scannedToken, setScannedToken] = useState<string>("");
  const [manualToken, setManualToken] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [kind, setKind] = useState<"loan" | "savings" | "irrigation" | "other">("loan");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [done, setDone] = useState<{ paymentId: string; amount: number; kind: string; method: string; note: string | null; idemKey: string; paidAt: string } | null>(null);
  const brand = useBranding();

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = "qr-scan-payment";

  useEffect(() => { document.title = `Scan Payment — ${t("appName")}`; return () => { stop(); }; /* eslint-disable-next-line */ }, []);

  async function start() {
    setScanning(true); setErrMsg(null);
    try {
      const inst = new Html5Qrcode(containerId);
      scannerRef.current = inst;
      await inst.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 240 },
        async (decoded) => { await stop(); await resolve(decoded); },
        () => { /* frame errors ignored */ },
      );
    } catch (e: any) {
      setScanning(false);
      toast.error(e?.message ?? "Camera error");
    }
  }
  async function stop() {
    try { await scannerRef.current?.stop(); } catch { /* */ }
    try { await scannerRef.current?.clear(); } catch { /* */ }
    scannerRef.current = null;
    setScanning(false);
  }

  async function resolve(token: string) {
    setResolving(true); setErrMsg(null); setResolved(null); setDone(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setErrMsg("Please sign in."); return; }
      const res = await fetch(`${FN}/qr-resolve-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ token: token.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 410) {
          setErrMsg("This card has been revoked. Please ask the office to issue a new one.");
        } else {
          setErrMsg(j?.error || "Could not resolve token");
        }
        return;
      }
      setResolved(j);
      setScannedToken(token.trim());
      const s = j.summary || {};
      if ((s.loan_due ?? 0) > 0) setKind("loan");
      else if ((s.irrigation_due ?? 0) > 0) setKind("irrigation");
      else setKind("savings");
    } catch {
      setErrMsg("Network error");
    } finally { setResolving(false); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || !resolved) return;
    setErrMsg(null);
    const parsed = PaySchema.safeParse({ amount: Number(amount), kind, note: note || undefined });
    if (!parsed.success) { setErrMsg(parsed.error.issues[0]?.message ?? "Invalid input"); return; }

    setSubmitting(true);
    try {
      // Deterministic per-minute idempotency key – blocks accidental double-taps
      // and re-scans of the same QR for the same amount/kind within the minute.
      const windowMinute = Math.floor(Date.now() / 60_000);
      const idemRaw = `${scannedToken}|${resolved.farmer.id}|${parsed.data.kind}|${parsed.data.amount}|${windowMinute}`;
      const idemKey = await sha256Hex(idemRaw);

      const payload: any = {
        farmer_id: resolved.farmer.id,
        kind: parsed.data.kind === "other" ? "savings" : parsed.data.kind,
        amount: parsed.data.amount,
        method: "cash",
        note: parsed.data.note ?? null,
        collected_by: user?.id,
        status: "approved",
        office_id: resolved.farmer.office_id ?? null,
        idempotency_key: idemKey,
      };
      const { data: ins, error } = await supabase.from("payments").insert(payload).select("id").single();
      if (error) {
        if ((error as any).code === "23505" || /duplicate/i.test(error.message)) {
          setErrMsg(
            "Duplicate payment blocked: an identical payment was already recorded in the last minute."
          );
        } else {
          setErrMsg(error.message);
        }
        return;
      }
      setDone({
        paymentId: ins!.id,
        amount: parsed.data.amount,
        kind: parsed.data.kind,
        method: payload.method,
        note: parsed.data.note ?? null,
        idemKey,
        paidAt: new Date().toISOString(),
      });
      toast.success("Payment recorded — SMS notification queued");
    } catch (e: any) {
      setErrMsg(e?.message ?? "Network error");
    } finally { setSubmitting(false); }
  }

  function reset() {
    setResolved(null); setDone(null); setAmount(""); setNote(""); setErrMsg(null); setScannedToken("");
  }

  return (
    <>
      <PageHeader title="Scan Payment" description="Scan farmer membership-card QR to collect a payment." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2"><Camera className="h-4 w-4" /> QR Scanner</h2>
            {scanning && <Button size="sm" variant="outline" onClick={stop}><X className="h-4 w-4" />Stop</Button>}
          </div>
          <div id={containerId} className="mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-md bg-muted" />
          {!scanning && (
            <Button onClick={start} className="w-full mt-3"><Camera className="h-4 w-4" />Start Camera</Button>
          )}
          <div className="mt-4 border-t pt-3">
            <Label className="text-xs">Or enter token manually</Label>
            <div className="flex gap-2 mt-1">
              <Input value={manualToken} onChange={(e) => setManualToken(e.target.value)} placeholder="mkc_…" className="font-mono text-xs" />
              <Button onClick={() => resolve(manualToken)} disabled={resolving || !manualToken.trim()}>
                {resolving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Lookup"}
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          {errMsg && <Alert variant="destructive" className="mb-3"><AlertDescription>{errMsg}</AlertDescription></Alert>}

          {!resolved && !done && (
            <div className="text-sm text-muted-foreground py-12 text-center">
              {resolving ? <><Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Resolving…</> : "Scan a QR or enter a token to begin."}
            </div>
          )}

          {resolved && !done && (
            <>
              <div className="flex items-center gap-3 pb-3 border-b">
                <div className="h-12 w-12 rounded-full bg-muted overflow-hidden flex items-center justify-center shrink-0">
                  {resolved.farmer.photo_url ? <img src={resolved.farmer.photo_url} alt="" className="h-full w-full object-cover" /> : <User className="h-6 w-6 text-muted-foreground" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{resolved.farmer.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {resolved.farmer.farmer_code}{resolved.farmer.member_no ? ` • ${resolved.farmer.member_no}` : ""}
                  </div>
                  {resolved.farmer.mobile_masked && <div className="text-xs text-muted-foreground">📱 {resolved.farmer.mobile_masked}</div>}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center my-3 text-xs">
                <div className="rounded border p-2"><div className="text-muted-foreground">Loan due</div><div className="font-mono font-semibold">{fmt(resolved.summary.loan_due)}</div></div>
                <div className="rounded border p-2"><div className="text-muted-foreground">Irrig. due</div><div className="font-mono font-semibold">{fmt(resolved.summary.irrigation_due)}</div></div>
                <div className="rounded border p-2"><div className="text-muted-foreground">Savings</div><div className="font-mono font-semibold">{fmt(resolved.summary.savings_balance)}</div></div>
              </div>

              <form onSubmit={submit} className="space-y-3">
                <div>
                  <Label>Payment type</Label>
                  <Select value={kind} onValueChange={(v) => setKind(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="loan">Loan</SelectItem>
                      <SelectItem value="savings">Savings deposit</SelectItem>
                      <SelectItem value="irrigation">Irrigation</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Amount (BDT)</Label>
                  <Input type="number" inputMode="decimal" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required />
                </div>
                <div>
                  <Label>Note (optional)</Label>
                  <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="outline" onClick={reset} className="flex-1">Cancel</Button>
                  <Button type="submit" disabled={submitting} className="flex-1">
                    {submitting ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : "Collect Payment"}
                  </Button>
                </div>
              </form>
            </>
          )}

          {done && resolved && (
            <div className="text-center py-8 space-y-3">
              <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
              <div className="font-semibold text-lg">Payment recorded</div>
              <div className="text-sm">
                <div><span className="text-muted-foreground">Farmer:</span> {resolved.farmer.name}</div>
                <div><span className="text-muted-foreground">Type:</span> {done.kind}</div>
                <div><span className="text-muted-foreground">Amount:</span> <span className="font-mono font-semibold">৳ {fmt(done.amount)}</span></div>
                <div className="text-xs text-muted-foreground mt-2 font-mono">Ref: {done.paymentId.slice(0, 8)}…</div>
              </div>
              <div className="text-xs text-muted-foreground">SMS notification has been queued.</div>
              <div className="flex gap-2 justify-center flex-wrap">
                <Button
                  variant="outline"
                  onClick={() => downloadPaymentReceiptPdf({
                    receipt_no: done.paymentId.slice(0, 8).toUpperCase(),
                    payment_id: done.paymentId,
                    paid_at: done.paidAt,
                    farmer_name: resolved.farmer.name,
                    farmer_code: resolved.farmer.farmer_code,
                    member_no: resolved.farmer.member_no,
                    mobile_masked: resolved.farmer.mobile_masked ?? null,
                    village: resolved.farmer.village ?? null,
                    token_masked: maskToken(scannedToken),
                    token_status: "active",
                    kind: done.kind,
                    amount: done.amount,
                    method: done.method,
                    note: done.note,
                    idempotency_key: done.idemKey,
                    company_name: brand.company_name,
                    company_name_bn: brand.company_name_bn,
                  })}
                >
                  <FileDown className="h-4 w-4" />Download Receipt
                </Button>
                <Button onClick={reset}>Scan another</Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
