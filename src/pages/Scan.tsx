import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLang } from "@/i18n/LanguageProvider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Camera, RefreshCcw, AlertCircle } from "lucide-react";

type CamError =
  | { kind: "permission"; msg: string }
  | { kind: "no-device"; msg: string }
  | { kind: "insecure"; msg: string }
  | { kind: "other"; msg: string }
  | null;

function classifyCameraError(e: any): CamError {
  const name = String(e?.name || "");
  const raw = String(e?.message || e || "");
  if (typeof window !== "undefined" && window.isSecureContext === false) {
    return { kind: "insecure", msg: "Camera requires HTTPS. Open this page over a secure (https://) connection." };
  }
  if (name === "NotAllowedError" || /permission|denied|NotAllowed/i.test(raw)) {
    return { kind: "permission", msg: "Camera permission was denied. Allow camera access in your browser settings and try again." };
  }
  if (name === "NotFoundError" || /no.*camera|NotFound|Requested device not found/i.test(raw)) {
    return { kind: "no-device", msg: "No camera was found on this device. Use manual lookup below." };
  }
  return { kind: "other", msg: raw || "Could not start camera." };
}

export default function Scan() {
  const { t } = useLang();
  const nav = useNavigate();
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState("");
  const [camError, setCamError] = useState<CamError>(null);
  const ref = useRef<Html5Qrcode | null>(null);
  const containerId = "qr-reader";

  useEffect(() => { document.title = `${t("scanQr")} — ${t("appName")}`; }, [t]);

  useEffect(() => {
    const acc = new URLSearchParams(window.location.search).get("acc");
    if (acc) onDecoded(`acc:${acc}`);
    return () => { stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    setCamError(null);
    setScanning(true);
    try {
      const inst = new Html5Qrcode(containerId);
      ref.current = inst;
      await inst.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        async (decoded) => {
          await stop();
          await onDecoded(decoded);
        },
        () => { /* ignore frame errors */ },
      );
    } catch (e: any) {
      setScanning(false);
      const err = classifyCameraError(e);
      setCamError(err);
      // Don't shout permission errors via toast — the inline panel is clearer.
      if (err && err.kind === "other") toast.error(err.msg);
    }
  }

  async function stop() {
    try { await ref.current?.stop(); } catch { /* */ }
    try { await ref.current?.clear(); } catch { /* */ }
    ref.current = null;
    setScanning(false);
  }

  async function retry() {
    await stop();
    setCamError(null);
    await start();
  }

  async function onDecoded(text: string) {
    const raw = text.trim();
    let key: string | null = null;
    let kind: "account" | "id" | "code" = "account";

    try {
      const u = new URL(raw, window.location.origin);
      const acc = u.searchParams.get("acc");
      if (acc) { key = acc; kind = "account"; }
    } catch { /* not a URL */ }

    if (!key) {
      if (raw.startsWith("acc:")) { key = raw.slice(4); kind = "account"; }
      else if (raw.startsWith("farmer:")) { key = raw.slice(7); kind = "id"; }
      else key = raw;
    }

    if (!key) return toast.error("Invalid QR");

    // Active-only lookup helper (RLS already scopes to current office)
    const activeFarmer = (q: any) =>
      q.eq("status", "active").is("deleted_at", null).maybeSingle();

    if (kind !== "id" && /^[0-9]{8,18}$/.test(key)) {
      const byAcc = await activeFarmer(
        supabase.from("farmers").select("id").eq("account_number", key),
      );
      if (byAcc.data?.id) return nav(`/payments?farmer=${byAcc.data.id}`);
    }
    if (kind === "id" || /^[0-9a-f-]{36}$/i.test(key)) {
      const byId = await activeFarmer(
        supabase.from("farmers").select("id").eq("id", key),
      );
      if (byId.data?.id) return nav(`/payments?farmer=${byId.data.id}`);
    }
    const byCode = await activeFarmer(
      supabase.from("farmers").select("id").eq("farmer_code", key),
    );
    if (byCode.data?.id) return nav(`/payments?farmer=${byCode.data.id}`);

    // Legacy token QR fallback (mkc_...) — resolve via edge function then redirect.
    if (/^mkc_[0-9a-f]{16,}$/i.test(key)) {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qr-resolve-token`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: key }),
          },
        );
        const j = await res.json().catch(() => ({}));
        if (res.ok && j?.farmer_id) return nav(`/payments?farmer=${j.farmer_id}`);
      } catch { /* ignore */ }
    }

    toast.error("Account number not found in your office");
  }

  async function lookupManual() {
    const v = manual.trim();
    if (!v) return;
    await onDecoded(v);
  }

  return (
    <>
      <PageHeader title={t("scanQr")} description="Scan farmer QR (account number) to open payment screen" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4 sm:p-5">
          <div
            id={containerId}
            className="mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-md bg-muted"
            data-testid="qr-reader"
          />

          {camError && (
            <div
              role="alert"
              className="mt-3 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
              data-testid="cam-error"
            >
              <AlertCircle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />
              <div className="flex-1">
                <div className="font-medium text-destructive">
                  {camError.kind === "permission" && "Camera blocked"}
                  {camError.kind === "no-device" && "No camera found"}
                  {camError.kind === "insecure" && "Insecure connection"}
                  {camError.kind === "other" && "Camera error"}
                </div>
                <div className="text-muted-foreground">{camError.msg}</div>
              </div>
            </div>
          )}

          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {!scanning ? (
              <>
                <Button onClick={start} className="min-w-[10rem]" size="lg">
                  <Camera className="h-4 w-4 mr-1" />Start Camera
                </Button>
                {camError && (
                  <Button variant="outline" size="lg" onClick={retry} data-testid="retry-camera">
                    <RefreshCcw className="h-4 w-4 mr-1" />Retry
                  </Button>
                )}
              </>
            ) : (
              <Button variant="outline" size="lg" onClick={stop}>{t("stop")}</Button>
            )}
          </div>
        </Card>
        <Card className="p-4 sm:p-5">
          <h2 className="font-semibold mb-3">Manual lookup</h2>
          <div className="space-y-3">
            <div>
              <Label>Account Number / Mobile / Code</Label>
              <Input value={manual} onChange={e => setManual(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") lookupManual(); }}
                placeholder="2401510064476" inputMode="numeric" />
            </div>
            <Button onClick={lookupManual} className="w-full" size="lg">Open Payment Screen</Button>
          </div>
        </Card>
      </div>
    </>
  );
}
