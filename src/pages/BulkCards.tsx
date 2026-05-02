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
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { TEMPLATE_LIST, type TemplateId } from "@/components/card/templates";
import { downloadBulkCardsPdf } from "@/components/card/cardPdf";
import type { CardData } from "@/components/card/MembershipCard";

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
  const brand = useBranding();
  const [list, setList] = useState<FarmerRow[]>([]);
  const [q, setQ] = useState("");
  const [officeId, setOfficeId] = useState<string>("all");
  const [offices, setOffices] = useState<{ id: string; name: string }[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [templateId, setTemplateId] = useState<TemplateId>("classic");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  // Hidden container holds QR SVGs we need to feed into the PDF generator.
  const qrHostRef = useRef<HTMLDivElement>(null);
  const [tokens, setTokens] = useState<Record<string, { token: string; issued_at: string }>>({});

  useEffect(() => {
    document.title = "Bulk Membership Cards";
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
    if (selectedIds.length === 0) { toast.error("Select at least one farmer"); return; }
    if (selectedIds.length > 100) { toast.error("Please select no more than 100 farmers per batch"); return; }
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Please sign in"); return; }
      const res = await fetch(`${FN}/farmer-cards-bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ farmer_ids: selectedIds }),
      });
      const j = await res.json();
      if (!res.ok) { toast.error(j?.error || "Bulk fetch failed"); return; }
      const items: any[] = j.items ?? [];
      const ok = items.filter((i) => !i.error);
      const tokMap: typeof tokens = {};
      ok.forEach((i) => { tokMap[i.farmer_id] = { token: i.token, issued_at: i.issued_at }; });
      setTokens(tokMap);

      // Wait one render so QR SVGs are mounted in the hidden host.
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);

      const cards = ok.map((it) => {
        const data: CardData = {
          company_name: brand.company_name,
          company_name_bn: brand.company_name_bn,
          logo_url: brand.logo_url,
          farmer: {
            name: it.farmer.name,
            name_en: it.farmer.name_en,
            farmer_code: it.farmer.farmer_code,
            member_no: it.farmer.member_no ?? undefined,
            mobile: it.farmer.mobile ?? undefined,
            village: it.farmer.village ?? undefined,
            address: it.farmer.address ?? undefined,
            photo_url: it.farmer.photo_url,
          },
          token: it.token,
          issued_at: it.issued_at,
        };
        const wrap = qrHostRef.current?.querySelector(`[data-token-id="${it.farmer_id}"]`) as HTMLElement | null;
        const svg = wrap?.querySelector("svg") as SVGElement | null;
        return { data, qrSvg: svg };
      });
      // (closing brace replaced below)
      await downloadBulkCardsPdf(cards, templateId, `farmer-cards-${ok.length}-${templateId}.pdf`);
      const skipped = items.length - ok.length;
      toast.success(`Generated ${ok.length} card(s)${skipped ? `, skipped ${skipped}` : ""}.`);
    } catch (e: any) {
      toast.error(e?.message ?? "PDF export failed");
    } finally { setBusy(false); }
  }

  if (!isAdmin) {
    return (
      <>
        <PageHeader title="Bulk Membership Cards" />
        <Alert variant="destructive"><AlertDescription>This page is restricted to administrators.</AlertDescription></Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Bulk Membership Cards"
        description="Select multiple farmers and download all their cards as a single PDF."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm"><Link to="/farmers"><ArrowLeft className="h-4 w-4" />Farmers</Link></Button>
            <Button size="sm" onClick={generate} disabled={busy || selectedIds.length === 0}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Generate PDF ({selectedIds.length})
            </Button>
          </div>
        }
      />

      <Card className="p-4 mb-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Label className="text-xs">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Name, code, mobile…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Office</Label>
            <Select value={officeId} onValueChange={setOfficeId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All offices</SelectItem>
                {offices.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Card template</Label>
            <Select value={templateId} onValueChange={(v) => setTemplateId(v as TemplateId)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TEMPLATE_LIST.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
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
                <Checkbox checked={allOnPageSelected} onCheckedChange={(v) => toggleAll(!!v)} aria-label="Select all" />
              </TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>Village</TableHead>
              <TableHead>Office</TableHead>
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
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No matching farmers</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
        <div className="px-4 py-2 text-xs text-muted-foreground border-t">
          Showing first 200 results. Refine search to narrow down. Max 100 cards per PDF.
        </div>
      </Card>

      {/* Hidden container that mounts QR SVGs for the selected farmers so the PDF generator can serialize them. */}
      <div ref={qrHostRef} className="absolute -left-[9999px] top-0" aria-hidden>
        {Object.entries(tokens).map(([fid, t]) => (
          <QRCodeSVG key={fid} value={t.token} size={128} level="M" includeMargin={false}
            // QRCodeSVG doesn't forward unknown props; render in an svg wrapper with marker
          />
        ))}
        {/* Markers for cardPdf to find each QR by farmer id */}
        {Object.entries(tokens).map(([fid, t]) => (
          <svg key={`m-${fid}`} data-token-id={fid} width="128" height="128" xmlns="http://www.w3.org/2000/svg">
            <foreignObject width="128" height="128">
              <div xmlns="http://www.w3.org/1999/xhtml">
                <QRCodeSVG value={t.token} size={128} level="M" includeMargin={false} />
              </div>
            </foreignObject>
          </svg>
        ))}
      </div>
    </>
  );
}
