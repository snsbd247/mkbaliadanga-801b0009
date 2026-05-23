import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FarmerSearchSelect } from "@/components/farmers/FarmerSearchSelect";
import { FileText, FileSpreadsheet, RefreshCw, Search, Inbox, FileDown } from "lucide-react";
import { money, fmtDate } from "@/lib/format";
import { exportExcel, exportFarmerCombinedStatementPDF } from "@/lib/exports";
import { useBranding } from "@/lib/branding";
import { useLang } from "@/i18n/LanguageProvider";
import { toast } from "sonner";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

type Row = {
  id: string;
  entry_date: string;
  description: string | null;
  debit: number;
  credit: number;
  balance: number;
  reference_type: string | null;
  reference_id: string | null;
};

type Kind = "savings" | "loan";

export default function FarmerStatement() {
  const brand = useBranding();
  const { t, lang } = useLang();
  const [kind, setKind] = useState<Kind>("savings");
  const [farmerId, setFarmerId] = useState<string | null>(null);
  const [farmer, setFarmer] = useState<any>(null);
  const [accountInput, setAccountInput] = useState("");
  const [accountLookupLoading, setAccountLookupLoading] = useState(false);
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => { document.title = t("farmerStatement"); }, [t]);

  useEffect(() => {
    if (!farmerId) { setFarmer(null); return; }
    supabase.from("farmers")
      .select("id, name_en, name_bn, account_number, farmer_code, mobile, village")
      .eq("id", farmerId).maybeSingle()
      .then(r => {
        setFarmer(r.data);
        if (r.data?.account_number) setAccountInput(r.data.account_number);
      });
  }, [farmerId]);

  async function lookupByAccount() {
    const ac = accountInput.trim();
    if (!ac) return;
    setAccountLookupLoading(true);
    try {
      const { data, error } = await supabase
        .from("farmers")
        .select("id")
        .eq("account_number", ac)
        .maybeSingle();
      if (error) throw error;
      if (!data) { toast.error(t("accountNotFound")); return; }
      setFarmerId(data.id);
    } catch (e: any) {
      toast.error(e.message ?? t("accountNotFound"));
    } finally {
      setAccountLookupLoading(false);
    }
  }

  async function load() {
    if (!farmerId) { toast.error(t("selectFarmerFirst")); return; }
    setLoading(true);
    try {
      const fn = kind === "savings" ? "farmer_savings_statement" : "farmer_loan_statement";
      const { data, error } = await supabase.rpc(fn, {
        _farmer_id: farmerId,
        _from: from || null,
        _to: to || null,
      });
      if (error) throw error;
      setRows((data as Row[]) ?? []);
      setHasLoaded(true);
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      // RLS / SECURITY DEFINER block → friendly message
      if (/access denied|permission|row-level security|rls/i.test(msg)) {
        toast.error(t("accessDeniedStatement"));
      } else {
        toast.error(t("failedLoadStatement"));
      }
      setRows([]);
      setHasLoaded(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (farmerId) load(); /* eslint-disable-next-line */ }, [kind, farmerId]);

  const totals = useMemo(() => {
    const debit = rows.reduce((s, r) => s + Number(r.debit || 0), 0);
    const credit = rows.reduce((s, r) => s + Number(r.credit || 0), 0);
    const closing = rows.length ? Number(rows[rows.length - 1].balance) : 0;
    return { debit, credit, closing };
  }, [rows]);

  // Bengali-aware PDF export — captures the styled DOM block so Unicode (Bangla)
  // renders via the page's webfont instead of jsPDF's built-in latin font.
  async function pdf() {
    if (!farmer) { toast.error(t("selectFarmerFirst")); return; }
    if (!rows.length) { toast.error(t("noTransactionsFound")); return; }
    const node = printRef.current;
    if (!node) return;
    try {
      const canvas = await html2canvas(node, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      });
      const img = canvas.toDataURL("image/png");
      const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 8;
      const imgW = pageW - margin * 2;
      const imgH = (canvas.height * imgW) / canvas.width;
      let y = margin;
      let remaining = imgH;
      // simple multi-page: re-add same image with y offset using clipping via addImage on each page
      if (imgH <= pageH - margin * 2) {
        doc.addImage(img, "PNG", margin, y, imgW, imgH);
      } else {
        // paginate by slicing the canvas
        const pageContentH = pageH - margin * 2;
        const pxPerMm = canvas.width / imgW;
        const sliceHpx = pageContentH * pxPerMm;
        let offsetPx = 0;
        while (offsetPx < canvas.height) {
          const sliceH = Math.min(sliceHpx, canvas.height - offsetPx);
          const tmp = document.createElement("canvas");
          tmp.width = canvas.width; tmp.height = sliceH;
          const ctx = tmp.getContext("2d")!;
          ctx.drawImage(canvas, 0, offsetPx, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
          const sImg = tmp.toDataURL("image/png");
          const sH = (sliceH / pxPerMm);
          if (offsetPx > 0) doc.addPage();
          doc.addImage(sImg, "PNG", margin, margin, imgW, sH);
          offsetPx += sliceH;
        }
      }
      const ac = farmer.account_number || farmer.farmer_code || "member";
      doc.save(`${kind}-statement-${ac}.pdf`);
    } catch (e: any) {
      toast.error(t("failedLoadStatement"));
    }
  }

  function xlsx() {
    if (!farmer) { toast.error(t("selectFarmerFirst")); return; }
    if (!rows.length) { toast.error(t("noTransactionsFound")); return; }
    exportExcel(
      `${kind}-statement-${farmer.account_number ?? farmer.farmer_code}`,
      kind === "savings" ? t("savingsStatement") : t("loanStatement"),
      rows.map(r => ({
        [t("dateCol")]: r.entry_date,
        [t("descriptionCol")]: r.description ?? "",
        [t("debitCol")]: Number(r.debit) || 0,
        [t("creditCol")]: Number(r.credit) || 0,
        [t("balanceCol")]: Number(r.balance) || 0,
      })),
      { from, to }
    );
  }

  const titleLabel = kind === "savings" ? t("savingsStatement") : t("loanStatement");
  const farmerName = farmer ? (lang === "bn" && farmer.name_bn ? farmer.name_bn : farmer.name_en) : "";

  return (
    <div className="p-4 space-y-4">
      <PageHeader title={t("farmerStatement")} />
      <p className="text-sm text-muted-foreground -mt-2">{t("farmerStatementDesc")}</p>

      <Card className="p-4 space-y-4">
        <Tabs value={kind} onValueChange={(v) => setKind(v as Kind)}>
          <TabsList>
            <TabsTrigger value="savings">{t("savings")}</TabsTrigger>
            <TabsTrigger value="loan">{t("loans")}</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
          <div className="md:col-span-2">
            <Label>{t("farmer")}</Label>
            <FarmerSearchSelect value={farmerId ?? ""} onChange={(v) => setFarmerId(v || null)} />
          </div>
          <div className="md:col-span-2">
            <Label>{t("accountNumber")}</Label>
            <div className="flex gap-2">
              <Input
                value={accountInput}
                placeholder={t("accountNumberPlaceholder")}
                onChange={e => setAccountInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); lookupByAccount(); } }}
              />
              <Button type="button" variant="secondary" onClick={lookupByAccount} disabled={!accountInput.trim() || accountLookupLoading}>
                {accountLookupLoading ? <Loader /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div>
            <Label>{t("fromDate")}</Label>
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>{t("toDate")}</Label>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={load} disabled={!farmerId || loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            {t("load")}
          </Button>
          <Button variant="outline" onClick={pdf} disabled={!rows.length}>
            <FileText className="h-4 w-4 mr-2" /> {t("exportPdf")}
          </Button>
          <Button variant="outline" onClick={xlsx} disabled={!rows.length}>
            <FileSpreadsheet className="h-4 w-4 mr-2" /> {t("exportExcel")}
          </Button>
        </div>
      </Card>

      {/* Printable area — also rendered on screen */}
      <div ref={printRef} className="bg-background">
        <Card className="p-4 space-y-3">
          <div className="text-center">
            <div className="text-lg font-bold">{brand.company_name}</div>
            {brand.address && <div className="text-xs text-muted-foreground">{brand.address}</div>}
            <div className="text-base font-semibold mt-1">{titleLabel}</div>
            <div className="text-xs text-muted-foreground">
              {t("period")}: {from || "—"} → {to || "—"}
            </div>
          </div>

          {farmer && (
            <div className="rounded border p-3 text-sm bg-muted/30 grid grid-cols-1 md:grid-cols-4 gap-2">
              <div><span className="text-muted-foreground">{t("nameLabel")}:</span> <span className="font-medium">{farmerName}</span></div>
              <div><span className="text-muted-foreground">{t("acLabel")}:</span> {farmer.account_number ?? farmer.farmer_code ?? "—"}</div>
              <div><span className="text-muted-foreground">{t("mobileLabel")}:</span> {farmer.mobile ?? "—"}</div>
              <div><span className="text-muted-foreground">{t("villageLabel")}:</span> {farmer.village ?? "—"}</div>
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">{t("dateCol")}</TableHead>
                <TableHead>{t("descriptionCol")}</TableHead>
                <TableHead className="text-right w-32">{t("debitCol")}</TableHead>
                <TableHead className="text-right w-32">{t("creditCol")}</TableHead>
                <TableHead className="text-right w-32">{t("balanceCol")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Inbox className="h-8 w-8 opacity-60" />
                      <div className="text-sm">
                        {!farmerId
                          ? t("selectFarmerToView")
                          : (hasLoaded ? t("noTransactionsFound") : t("selectFarmerToView"))}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell>{fmtDate(r.entry_date)}</TableCell>
                  <TableCell>{r.description ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono">{Number(r.debit) ? money(r.debit) : "—"}</TableCell>
                  <TableCell className="text-right font-mono">{Number(r.credit) ? money(r.credit) : "—"}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">{money(r.balance)}</TableCell>
                </TableRow>
              ))}
              {rows.length > 0 && (
                <TableRow className="bg-muted/40 font-semibold">
                  <TableCell colSpan={2}>{t("totals")}</TableCell>
                  <TableCell className="text-right font-mono">{money(totals.debit)}</TableCell>
                  <TableCell className="text-right font-mono">{money(totals.credit)}</TableCell>
                  <TableCell className="text-right font-mono">{money(totals.closing)}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}

function Loader() {
  return <RefreshCw className="h-4 w-4 animate-spin" />;
}
