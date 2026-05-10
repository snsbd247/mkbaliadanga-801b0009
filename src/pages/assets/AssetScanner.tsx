import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, CameraOff, Search } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const REGION_ID = "asset-qr-region";

export default function AssetScanner() {
  const { tx } = useLang();
  const navigate = useNavigate();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");

  useEffect(() => {
    document.title = tx("Scan asset", "এসেট স্ক্যান");
    return () => {
      const s = scannerRef.current;
      if (s && s.isScanning) {
        s.stop().catch(() => {}).finally(() => s.clear());
      }
    };
  }, [tx]);

  async function handleResult(text: string) {
    try {
      // Deep-link form: <origin>/assets/items/<uuid>
      const m = text.match(/\/assets\/items\/([0-9a-f-]{36})/i);
      if (m) {
        await stop();
        navigate(`/assets/items/${m[1]}`);
        return;
      }
      // Otherwise treat as asset_code
      await lookupByCode(text.trim());
    } catch (e: any) {
      toast.error(e.message ?? "Scan error");
    }
  }

  async function lookupByCode(code: string) {
    if (!code) return;
    const { data, error } = await supabase
      .from("assets" as any)
      .select("id")
      .eq("asset_code", code)
      .maybeSingle();
    if (error) { toast.error(error.message); return; }
    if (!data) { toast.error(tx("No asset found for this code", "এই কোডের কোনো এসেট নেই")); return; }
    await stop();
    navigate(`/assets/items/${(data as any).id}`);
  }

  async function start() {
    try {
      const inst = new Html5Qrcode(REGION_ID);
      scannerRef.current = inst;
      await inst.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (txt) => { handleResult(txt); },
        () => {}
      );
      setScanning(true);
    } catch (e: any) {
      toast.error(e.message ?? "Camera error");
    }
  }

  async function stop() {
    const s = scannerRef.current;
    if (s && s.isScanning) {
      await s.stop();
      s.clear();
    }
    setScanning(false);
  }

  return (
    <>
      <PageHeader
        title={tx("Scan asset QR", "এসেট QR স্ক্যান")}
        description={tx("Point camera at an asset QR or enter the asset code", "ক্যামেরা QR-এ ধরুন বা এসেট কোড লিখুন")}
      />
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4">
          <div id={REGION_ID} className="w-full aspect-square bg-muted rounded overflow-hidden" />
          <div className="flex gap-2 mt-3">
            {!scanning ? (
              <Button onClick={start}><Camera className="h-4 w-4 mr-1" />{tx("Start camera", "ক্যামেরা চালু")}</Button>
            ) : (
              <Button variant="outline" onClick={stop}><CameraOff className="h-4 w-4 mr-1" />{tx("Stop", "বন্ধ")}</Button>
            )}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-medium mb-2">{tx("Manual lookup", "ম্যানুয়াল খোঁজ")}</div>
          <div className="flex gap-2">
            <Input
              placeholder={tx("Asset code, e.g. PUMP-001", "এসেট কোড")}
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") lookupByCode(manualCode.trim()); }}
            />
            <Button onClick={() => lookupByCode(manualCode.trim())}>
              <Search className="h-4 w-4 mr-1" />{tx("Find", "খুঁজুন")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            {tx(
              "QR codes printed from an asset detail page contain a direct link and will open instantly.",
              "এসেট ডিটেইল পেইজ থেকে প্রিন্ট করা QR-এ সরাসরি লিঙ্ক থাকে, স্ক্যান করলেই খুলে যাবে।"
            )}
          </p>
        </Card>
      </div>
    </>
  );
}
