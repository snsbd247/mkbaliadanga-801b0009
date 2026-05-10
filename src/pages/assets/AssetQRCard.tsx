import { useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer, Download } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";

interface Props {
  assetId: string;
  assetCode: string;
  name: string;
  serialNo?: string | null;
}

export function AssetQRCard({ assetId, assetCode, name, serialNo }: Props) {
  const { tx } = useLang();
  const ref = useRef<HTMLDivElement>(null);
  const url = `${window.location.origin}/assets/items/${assetId}`;

  function handlePrint() {
    const svg = ref.current?.querySelector("svg")?.outerHTML ?? "";
    const w = window.open("", "_blank", "width=400,height=500");
    if (!w) return;
    w.document.write(`
      <html><head><title>${assetCode} QR</title>
      <style>body{font-family:system-ui;text-align:center;padding:24px}
      .code{font-size:18px;font-weight:600;margin-top:12px}
      .name{font-size:14px;color:#555;margin-top:4px}
      .sn{font-size:12px;color:#777;margin-top:2px}
      @media print{@page{margin:8mm}}
      </style></head><body>
      ${svg}
      <div class="code">${assetCode}</div>
      <div class="name">${name}</div>
      ${serialNo ? `<div class="sn">SN: ${serialNo}</div>` : ""}
      <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500);}</script>
      </body></html>`);
    w.document.close();
  }

  function handleDownload() {
    const svg = ref.current?.querySelector("svg");
    if (!svg) return;
    const blob = new Blob([svg.outerHTML], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${assetCode}-qr.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <Card className="p-4 flex flex-col items-center gap-3">
      <div ref={ref} className="bg-background p-2 rounded">
        <QRCodeSVG value={url} size={160} level="M" includeMargin />
      </div>
      <div className="text-center">
        <div className="font-semibold">{assetCode}</div>
        <div className="text-xs text-muted-foreground">{name}</div>
        {serialNo && <div className="text-xs text-muted-foreground">SN: {serialNo}</div>}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-1" />{tx("Print", "প্রিন্ট")}
        </Button>
        <Button size="sm" variant="outline" onClick={handleDownload}>
          <Download className="h-4 w-4 mr-1" />SVG
        </Button>
      </div>
    </Card>
  );
}
