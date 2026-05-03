import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, Printer, Download, RefreshCw, ArrowLeft, ShieldOff } from "lucide-react";
import { useBranding } from "@/lib/branding";
import { MembershipCard, CardData } from "@/components/card/MembershipCard";
import { downloadCardPdf } from "@/components/card/cardPdf";
import { TEMPLATE_LIST, type TemplateId } from "@/components/card/templates";
import { useCardSettings } from "@/lib/cardSettings";
import { toast } from "sonner";

const FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const TEMPLATE_KEY = "mk_card_template";

export default function FarmerCard() {
  const { id = "" } = useParams();
  const brand = useBranding();
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [data, setData] = useState<CardData | null>(null);
  const [templateId, setTemplateId] = useState<TemplateId>(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem(TEMPLATE_KEY)) as TemplateId | null;
    return saved && ["classic", "minimal", "bilingual"].includes(saved) ? saved : "classic";
  });
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => { document.title = "Membership Card"; load(false); /* eslint-disable-next-line */ }, [id]);
  useEffect(() => { try { localStorage.setItem(TEMPLATE_KEY, templateId); } catch {} }, [templateId]);

  async function load(rotate: boolean) {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Please sign in"); return; }
      const { data: f, error } = await supabase
        .from("farmers")
        .select("id, name_en, name_bn, farmer_code, member_no, mobile, village, address, photo_url")
        .eq("id", id).maybeSingle();
      if (error || !f) { toast.error("Farmer not found"); return; }

      let j: any = {};
      try {
        const res = await fetch(`${FN}/farmer-card-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ farmer_id: id, rotate }),
        });
        j = await res.json().catch(() => ({}));
        if (!res.ok || j?.fallback || j?.ok === false) {
          toast.error(j?.error || j?.message || "Could not get token");
          if (!j?.token) return;
        }
      } catch (e: any) {
        toast.error(e?.message || "Network error");
        return;
      }

      setData({
        company_name: brand.company_name,
        company_name_bn: brand.company_name_bn,
        logo_url: brand.logo_url,
        farmer: {
          name: f.name_bn || f.name_en,
          name_en: f.name_en,
          farmer_code: f.farmer_code,
          member_no: f.member_no ?? undefined,
          mobile: f.mobile ?? undefined,
          village: f.village ?? undefined,
          address: f.address ?? undefined,
          photo_url: f.photo_url,
        },
        token: j.token,
        issued_at: j.issued_at,
      });
      if (rotate) toast.success("New QR token issued");
    } finally { setLoading(false); }
  }

  async function onRevoke() {
    setRevoking(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Please sign in"); return; }
      const res = await fetch(`${FN}/farmer-card-revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ farmer_id: id }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(j?.error || "Revoke failed"); return; }
      toast.success(`Revoked ${j.revoked} active token(s). Future scans will be blocked.`);
      setData(null);
    } finally { setRevoking(false); }
  }

  async function onPdf() {
    if (!data) return;
    setBusy(true);
    try {
      const svg = cardRef.current?.querySelector("svg") as SVGElement | null;
      await downloadCardPdf(data, svg, templateId);
    } catch (e: any) {
      toast.error(e?.message ?? "PDF export failed");
    } finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader
        title="Membership Card"
        description="Printable ID card with QR for payment"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm"><Link to={`/farmers/${id}`}><ArrowLeft className="h-4 w-4" />Back</Link></Button>
            <Button variant="outline" size="sm" onClick={() => load(true)} disabled={loading || busy}>
              <RefreshCw className="h-4 w-4" />Rotate QR
            </Button>
            {isAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={loading || revoking || busy}>
                    {revoking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}Revoke
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Revoke this farmer's QR token?</AlertDialogTitle>
                    <AlertDialogDescription>
                      All active QR tokens will be revoked immediately. Future scans of any printed
                      card will be blocked until you issue a new one. This action is logged.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onRevoke}>Revoke</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button variant="outline" size="sm" onClick={() => window.print()} disabled={loading || !data}>
              <Printer className="h-4 w-4" />Print
            </Button>
            <Button size="sm" onClick={onPdf} disabled={loading || busy || !data}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}PDF
            </Button>
          </div>
        }
      />

      <Card className="p-4 sm:p-6 print:shadow-none print:border-0 print:p-0 space-y-4">
        <div className="flex items-center gap-3 print:hidden">
          <Label className="text-xs whitespace-nowrap">Card template</Label>
          <Select value={templateId} onValueChange={(v) => setTemplateId(v as TemplateId)}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TEMPLATE_LIST.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">PDF download uses the selected template.</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
          </div>
        ) : data ? (
          <div ref={cardRef} className="flex justify-center">
            <MembershipCard data={data} templateId={templateId} />
          </div>
        ) : (
          <div className="text-sm text-muted-foreground py-6 text-center">
            No active card. Click <strong>Rotate QR</strong> to issue a new token.
          </div>
        )}
      </Card>

      <p className="mt-3 text-xs text-muted-foreground text-center print:hidden">
        QR token is opaque. Rotating revokes the previous QR; reprint cards after rotation.
      </p>
    </>
  );
}
