import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { useBranding } from "@/lib/branding";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Download, Search, ArrowLeft } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { toast } from "sonner";
import { TEMPLATE_LIST, type TemplateId } from "@/components/card/templates";
import { downloadBulkCardsPdf } from "@/components/card/cardPdf";
import { useCardSettings } from "@/lib/cardSettings";
import { MembershipCard, type CardData } from "@/components/card/MembershipCard";

const FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

interface FarmerRow {
  id: string; name_en: string; name_bn: string | null;
  farmer_code: string; member_no: string | null;
  mobile: string | null; village: string | null; address: string | null;
  photo_url: string | null; status: string; office_id: string | null;
  offices?: { name: string } | null;
}

export default function BulkCards() {
  const { isAdmin } = useAuth();
  const { t } = useLang();
  const brand = useBranding();
  const cardCfg = useCardSettings();
  const [list, setList] = useState<FarmerRow[]>([]);
  const [q, setQ] = useState("");
  const [officeId, setOfficeId] = useState<string>("all");
  const [offices, setOffices] = useState<{ id: string; name: string }[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [templateId, setTemplateId] = useState<TemplateId>("classic");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  // Hidden container that mounts a real MembershipCard per selected farmer so
  // the PDF generator can capture each card's DOM (matches preview exactly).
  const cardHostRef = useRef<HTMLDivElement>(null);
  const [bulkCards, setBulkCards] = useState<{ farmer_id: string; data: CardData }[]>([]);

  useEffect(() => {
    document.title = t("pgBulkCardsDocTitle" as any) as string;
    supabase.from("offices").select("id,name").order("name").then(({ data }) => setOffices((data ?? []) as any[]));
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    let qy = supabase.from("farmers")
      .select("id,name_en,name_bn,farmer_code,member_no,mobile,village,address,photo_url,status,office_id,offices(name)")
      .eq("status", "active")
      .order("name_en")
      .limit(200);
    if (officeId !== "all") qy = qy.eq("office_id", officeId);
    if (q) qy = qy.or(`name_en.ilike.%${q}%,name_bn.ilike.%${q}%,farmer_code.ilike.%${q}%,member_no.ilike.%${q}%,mobile.ilike.%${q}%`);
    qy.then(({ data }) => {
      if (!active) return;
      setList((data ?? []) as any[]);
      setLoading(false);
    });
    return () => { active = false; };
  }, [q, officeId]);

  const selectedIds = useMemo(() => Object.entries(selected).filter(([, v]) => v).map(([k]) => k), [selected]);
  const allOnPageSelected = list.length > 0 && list.every((f) => selected[f.id]);

  function toggleAll(v: boolean) {
    const next = { ...selected };
    for (const f of list) next[f.id] = v;
    setSelected(next);
  }

  async function generate() {
    if (selectedIds.length === 0) { toast.error(t("pgBulkSelectAtLeastOne" as any)); return; }
    if (selectedIds.length > 100) { toast.error(t("pgBulkMaxLimit" as any)); return; }
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error(t("pgBulkSignInRequired" as any)); return; }
      const res = await fetch(`${FN}/farmer-cards-bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ farmer_ids: selectedIds }),
      });
      const j = await res.json();
      if (!res.ok) { toast.error(j?.error || t("pgBulkFetchFailed" as any)); return; }
      const items: any[] = j.items ?? [];
      const ok = items.filter((i) => !i.error);

      const cardData = ok.map((it) => {
        const acc = it.farmer.account_number ?? null;
        const qrValue = acc ? `${window.location.origin}/scan?acc=${acc}` : it.token;
        const data: CardData = {
          company_name: brand.company_name,
          company_name_bn: brand.company_name_bn,
          logo_url: brand.logo_url,
          farmer: {
            name: it.farmer.name_bn || it.farmer.name_en || it.farmer.name,
            name_en: it.farmer.name_en,
            farmer_code: it.farmer.farmer_code,
            member_no: it.farmer.member_no ?? undefined,
            account_number: acc,
            voter_number: it.farmer.voter_number ?? null,
            mobile: it.farmer.mobile ?? undefined,
            village: it.farmer.village ?? undefined,
            address: it.farmer.address ?? undefined,
            photo_url: it.farmer.photo_url,
          },
          token: it.token,
          qr_value: qrValue,
          issued_at: it.issued_at,
        };
        return { farmer_id: it.farmer_id, data };
      });
      setBulkCards(cardData);

      // Wait two frames so the hidden MembershipCard nodes are fully laid out.
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);

      const roots: HTMLElement[] = cardData
        .map((c) => cardHostRef.current?.querySelector(`[data-fid="${c.farmer_id}"]`) as HTMLElement | null)
        .filter((n): n is HTMLElement => !!n);

      await downloadBulkCardsPdf(roots, `farmer-cards-${ok.length}-${templateId}.pdf`);
      const skipped = items.length - ok.length;
      const skippedTxt = skipped ? (t("pgBulkSkippedMsg" as any) as string).replace("{n}", String(skipped)) : "";
      toast.success((t("pgBulkGeneratedMsg" as any) as string).replace("{ok}", String(ok.length)).replace("{skipped}", skippedTxt));
    } catch (e: any) {
      toast.error(e?.message ?? t("pgBulkPdfFailed" as any));
    } finally { setBusy(false); setBulkCards([]); }
  }

  if (!isAdmin) {
    return (
      <>
        <PageHeader title={t("pgBulkCardsTitle")} />
        <Alert variant="destructive"><AlertDescription>{t("accessDenied" as any)}</AlertDescription></Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t("pgBulkCardsTitle")}
        description={t("pgBulkCardsDesc")}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm"><Link to="/farmers"><ArrowLeft className="h-4 w-4" />{t("farmers")}</Link></Button>
            <Button size="sm" onClick={generate} disabled={busy || selectedIds.length === 0}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {t("pgGeneratePdf")} ({selectedIds.length})
            </Button>
          </div>
        }
      />

      <Card className="p-4 mb-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Label className="text-xs">{t("search")}</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder={`${t("pgName")}, ${t("pgCode")}, ${t("pgMobile")}…`} value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
            </div>
          </div>
          <div>
            <Label className="text-xs">{t("pgOffice")}</Label>
            <Select value={officeId} onValueChange={setOfficeId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("pgAllOffices")}</SelectItem>
                {offices.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{t("pgCardTemplate")}</Label>
            <Select value={templateId} onValueChange={(v) => setTemplateId(v as TemplateId)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TEMPLATE_LIST.map((tpl) => <SelectItem key={tpl.id} value={tpl.id}>{tpl.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={allOnPageSelected} onCheckedChange={(v) => toggleAll(!!v)} aria-label={t("search")} />
              </TableHead>
              <TableHead>{t("pgCode")}</TableHead>
              <TableHead>{t("pgName")}</TableHead>
              <TableHead>{t("pgMobile")}</TableHead>
              <TableHead>{t("pgVillage")}</TableHead>
              <TableHead>{t("pgOffice")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-4 w-4 animate-spin inline" /></TableCell></TableRow>}
            {!loading && list.map((f) => (
              <TableRow key={f.id} className="cursor-pointer" onClick={() => setSelected({ ...selected, [f.id]: !selected[f.id] })}>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox checked={!!selected[f.id]} onCheckedChange={(v) => setSelected({ ...selected, [f.id]: !!v })} />
                </TableCell>
                <TableCell className="font-mono text-xs">{f.farmer_code}</TableCell>
                <TableCell>
                  <div className="font-medium">{f.name_en}</div>
                  {f.name_bn && <div className="text-xs text-muted-foreground">{f.name_bn}</div>}
                </TableCell>
                <TableCell>{f.mobile ?? "—"}</TableCell>
                <TableCell>{f.village ?? "—"}</TableCell>
                <TableCell className="text-xs">{f.offices?.name ?? "—"}</TableCell>
              </TableRow>
            ))}
            {!loading && list.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">{t("pgNoMatching")}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
        <div className="px-4 py-2 text-xs text-muted-foreground border-t">
          {t("pgBulkShowingHint" as any)}
        </div>
      </Card>

      {/* Hidden host that renders real MembershipCard components so the PDF
          generator can capture them via html2canvas (matches preview exactly). */}
      <div
        ref={cardHostRef}
        style={{ position: "fixed", left: -10000, top: 0, opacity: 0, pointerEvents: "none" }}
        aria-hidden
      >
        {bulkCards.map((c) => (
          <div key={c.farmer_id} data-fid={c.farmer_id} style={{ marginBottom: 8 }}>
            <MembershipCard data={c.data} templateId={templateId} display={cardCfg} />
          </div>
        ))}
      </div>
    </>
  );
}
