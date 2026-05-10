import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { renderToStaticMarkup } from "react-dom/server";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Printer, Download, Upload, Search } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageProvider";

type Asset = { id: string; asset_code: string; name_en: string; name_bn: string | null; serial_no: string | null };

export default function AssetBulkQR() {
  const { tx } = useLang();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = tx("Bulk QR print", "বাল্ক QR প্রিন্ট");
    (async () => {
      const r = await supabase.from("assets" as any)
        .select("id,asset_code,name_en,name_bn,serial_no")
        .is("deleted_at", null).order("asset_code");
      if (!r.error) setAssets((r.data as any) || []);
    })();
  }, [tx]);

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return assets;
    return assets.filter(a => (a.asset_code + " " + (a.serial_no ?? "") + " " + a.name_en + " " + (a.name_bn ?? "")).toLowerCase().includes(s));
  }, [assets, q]);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }
  function toggleAllVisible() {
    const allOn = visible.every(a => selected.has(a.id));
    const next = new Set(selected);
    visible.forEach(a => allOn ? next.delete(a.id) : next.add(a.id));
    setSelected(next);
  }

  function selectedAssets() {
    return assets.filter(a => selected.has(a.id));
  }

  function buildQrSvg(a: Asset) {
    const url = `${window.location.origin}/assets/items/${a.id}`;
    return renderToStaticMarkup(
      <QRCodeSVG value={url} size={160} level="M" includeMargin />
    );
  }

  function printSelected() {
    const list = selectedAssets();
    if (!list.length) { toast.info(tx("Select at least one asset", "অন্তত একটি এসেট নির্বাচন করুন")); return; }
    const w = window.open("", "_blank", "width=900,height=900");
    if (!w) return;
    const cards = list.map(a => `
      <div class="card">
        ${buildQrSvg(a)}
        <div class="code">${a.asset_code}</div>
        <div class="name">${a.name_bn || a.name_en}</div>
        ${a.serial_no ? `<div class="sn">SN: ${a.serial_no}</div>` : ""}
      </div>
    `).join("");
    w.document.write(`
      <html><head><title>Bulk QR (${list.length})</title>
      <style>
        body{font-family:system-ui;margin:0;padding:12px}
        .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
        .card{border:1px solid #ddd;border-radius:6px;padding:10px;text-align:center;break-inside:avoid}
        .code{font-weight:600;margin-top:8px}
        .name{font-size:13px;color:#555}
        .sn{font-size:11px;color:#777}
        @media print{@page{margin:8mm} .grid{grid-template-columns:repeat(3,1fr)}}
      </style></head><body>
      <div class="grid">${cards}</div>
      <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),800);}</script>
      </body></html>`);
    w.document.close();
  }

  function downloadSelected() {
    const list = selectedAssets();
    if (!list.length) { toast.info(tx("Select at least one asset", "অন্তত একটি এসেট নির্বাচন করুন")); return; }
    list.forEach((a) => {
      const svg = buildQrSvg(a);
      const blob = new Blob([svg], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = `${a.asset_code}-qr.svg`;
      document.body.appendChild(link); link.click(); link.remove();
      URL.revokeObjectURL(url);
    });
    toast.success(tx(`Downloaded ${list.length} files`, `${list.length} ফাইল ডাউনলোড হয়েছে`));
  }

  async function importCsv(file: File) {
    const text = await file.text();
    // CSV: first column = asset_code (header optional)
    const codes = text.split(/\r?\n/).map(l => l.split(",")[0].trim().replace(/^"|"$/g, "")).filter(Boolean);
    const lower = new Set(codes.map(c => c.toLowerCase()));
    let matched = 0;
    const next = new Set(selected);
    assets.forEach(a => { if (lower.has(a.asset_code.toLowerCase())) { next.add(a.id); matched++; } });
    setSelected(next);
    toast.success(tx(`Matched ${matched} assets from file`, `ফাইল থেকে ${matched}টি মিলেছে`));
  }

  return (
    <>
      <PageHeader
        title={tx("Bulk QR print", "বাল্ক QR প্রিন্ট")}
        description={tx(
          "Select multiple assets to print all QR codes on a single sheet, or download SVG per code. Import CSV with asset codes in the first column to auto-select.",
          "একসাথে একাধিক এসেট নির্বাচন করে এক পৃষ্ঠায় সব QR প্রিন্ট করুন বা SVG ডাউনলোড করুন। প্রথম কলামে এসেট কোডসহ CSV আপলোড করে স্বয়ংক্রিয়ভাবে সিলেক্ট করুন।"
        )}
        actions={
          <div className="flex gap-2">
            <input ref={fileRef} type="file" accept=".csv,.txt,text/csv" hidden onChange={e => { const f = e.target.files?.[0]; if (f) importCsv(f); e.target.value = ""; }} />
            <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4 mr-1" />{tx("Import CSV", "CSV আপলোড")}</Button>
            <Button variant="outline" onClick={downloadSelected}><Download className="h-4 w-4 mr-1" />SVG</Button>
            <Button onClick={printSelected}><Printer className="h-4 w-4 mr-1" />{tx("Print selected", "প্রিন্ট")}</Button>
          </div>
        }
      />

      <Card className="p-3 mb-3">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" value={q} onChange={e => setQ(e.target.value)} placeholder={tx("Search code, serial, name…", "কোড, সিরিয়াল, নাম খুঁজুন…")} />
        </div>
        <div className="text-xs text-muted-foreground mt-2">
          {tx(`${selected.size} selected`, `${selected.size} নির্বাচিত`)} · {visible.length} / {assets.length}
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={visible.length > 0 && visible.every(a => selected.has(a.id))} onCheckedChange={toggleAllVisible} />
              </TableHead>
              <TableHead>{tx("Code", "কোড")}</TableHead>
              <TableHead>{tx("Name", "নাম")}</TableHead>
              <TableHead>{tx("Serial", "সিরিয়াল")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map(a => (
              <TableRow key={a.id}>
                <TableCell><Checkbox checked={selected.has(a.id)} onCheckedChange={() => toggle(a.id)} /></TableCell>
                <TableCell className="font-mono text-xs">{a.asset_code}</TableCell>
                <TableCell>{a.name_bn || a.name_en}</TableCell>
                <TableCell className="font-mono text-xs">{a.serial_no || "—"}</TableCell>
              </TableRow>
            ))}
            {!visible.length && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">{tx("No assets", "কোনো এসেট নেই")}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
