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

export default function Scan() {
  const { t } = useLang();
  const nav = useNavigate();
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState("");
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
      toast.error(e?.message ?? "Camera error");
    }
  }

  async function stop() {
    try { await ref.current?.stop(); } catch { /* */ }
    try { await ref.current?.clear(); } catch { /* */ }
    ref.current = null;
    setScanning(false);
  }

  async function onDecoded(text: string) {
    const raw = text.trim();
    let key: string | null = null;
    let kind: "account" | "id" | "code" = "account";

    // 1) URL form: /scan?acc=XXXXXXXXXXXXX  (or any URL with ?acc=)
    try {
      const u = new URL(raw, window.location.origin);
      const acc = u.searchParams.get("acc");
      if (acc) { key = acc; kind = "account"; }
    } catch { /* not a URL */ }

    // 2) Prefixed forms
    if (!key) {
      if (raw.startsWith("acc:")) { key = raw.slice(4); kind = "account"; }
      else if (raw.startsWith("farmer:")) { key = raw.slice(7); kind = "id"; }
      else key = raw;
    }

    if (!key) return toast.error("Invalid QR");

    // Prefer account_number lookup (numeric, business identifier)
    if (kind !== "id" && /^[0-9]{8,18}$/.test(key)) {
      const byAcc = await supabase.from("farmers").select("id").eq("account_number", key).maybeSingle();
      if (byAcc.data?.id) return nav(`/payments?farmer=${byAcc.data.id}`);
    }
    // Legacy: UUID id
    if (kind === "id" || /^[0-9a-f-]{36}$/i.test(key)) {
      const byId = await supabase.from("farmers").select("id").eq("id", key).maybeSingle();
      if (byId.data?.id) return nav(`/payments?farmer=${byId.data.id}`);
    }
    // Legacy: farmer_code
    const byCode = await supabase.from("farmers").select("id").eq("farmer_code", key).maybeSingle();
    if (byCode.data?.id) return nav(`/payments?farmer=${byCode.data.id}`);

    toast.error("Farmer not found");
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
        <Card className="p-5">
          <div id={containerId} className="mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-md bg-muted" />
          <div className="mt-3 flex justify-center gap-2">
            {!scanning ? <Button onClick={start}>Start Camera</Button>
              : <Button variant="outline" onClick={stop}>Stop</Button>}
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="font-semibold mb-3">Manual lookup</h2>
          <div className="space-y-3">
            <div>
              <Label>Account Number / Mobile / Code</Label>
              <Input value={manual} onChange={e => setManual(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") lookupManual(); }}
                placeholder="2401510064476" inputMode="numeric" />
            </div>
            <Button onClick={lookupManual} className="w-full">Open Payment Screen</Button>
          </div>
        </Card>
      </div>
    </>
  );
}
