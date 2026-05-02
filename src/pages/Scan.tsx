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
    let farmerId: string | null = null;
    if (text.startsWith("farmer:")) farmerId = text.slice(7);
    else farmerId = text.trim();

    // Try direct id
    const byId = await supabase.from("farmers").select("id").eq("id", farmerId).maybeSingle();
    if (byId.data?.id) return nav(`/payments?farmer=${byId.data.id}`);
    // Try farmer_code fallback
    const byCode = await supabase.from("farmers").select("id").eq("farmer_code", farmerId).maybeSingle();
    if (byCode.data?.id) return nav(`/payments?farmer=${byCode.data.id}`);
    toast.error("Farmer not found");
  }

  async function lookupManual() {
    if (!manual.trim()) return;
    await onDecoded(manual.trim());
  }

  return (
    <>
      <PageHeader title={t("scanQr")} description="Scan farmer QR to open payment screen" />
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
              <Label>Farmer ID or Code</Label>
              <Input value={manual} onChange={e => setManual(e.target.value)} placeholder="2026-00000001 or UUID" />
            </div>
            <Button onClick={lookupManual} className="w-full">Open Payment Screen</Button>
          </div>
        </Card>
      </div>
    </>
  );
}
