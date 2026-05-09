import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDate } from "@/lib/format";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";

export default function LandDetail() {
  const { id } = useParams();
  const { t } = useLang();
  const [loading, setLoading] = useState(true);
  const [land, setLand] = useState<any>(null);
  const [loc, setLoc] = useState<any>(null);
  const [owner, setOwner] = useState<any>(null);
  const [relations, setRelations] = useState<any[]>([]);
  const [charges, setCharges] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const [{ data: l }, { data: lc }] = await Promise.all([
        supabase.from("lands").select("*").eq("id", id).maybeSingle(),
        (supabase.from as any)("lands_with_location")
          .select("division_name,district_name,upazila_name,union_name,ward_name,village_name,mouza_name")
          .eq("id", id).maybeSingle(),
      ]);
      setLand(l);
      setLoc(lc);
      if (l?.farmer_id) {
        const { data: f } = await supabase.from("farmers")
          .select("id,name_en,name_bn,member_no,farmer_code,mobile").eq("id", l.farmer_id).maybeSingle();
        setOwner(f);
      }
      const [{ data: rels }, { data: ch }] = await Promise.all([
        supabase.from("land_relations")
          .select("*, owner:farmers!land_relations_owner_farmer_id_fkey(name_en,member_no,farmer_code), sc:farmers!land_relations_sharecropper_farmer_id_fkey(name_en,member_no,farmer_code)")
          .eq("land_id", id).order("valid_from", { ascending: false }),
        supabase.from("irrigation_invoices")
          .select("id,generated_at,payable_amount,paid_amount,due_amount,seasons(year,type)")
          .eq("land_id", id).is("deleted_at", null).order("generated_at", { ascending: false }).limit(50),
      ]);
      setRelations(rels ?? []);
      setCharges(ch ?? []);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="p-8 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> {t("ld_loading" as any)}</div>;
  if (!land) return <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>{t("ld_landNotFound" as any)}</AlertTitle><AlertDescription>{t("ld_landNotFoundDesc" as any)}</AlertDescription></Alert>;

  const activeRels = relations.filter((r) => !r.valid_to);
  const totalActiveShare = activeRels.reduce((s, r) => s + Number(r.share_percentage || 0), 0);
  const overShare = totalActiveShare > 100;

  return (
    <>
      <PageHeader title={`${t("ld_titlePrefix" as any)} ${land.dag_no ?? "—"}`} />

      <Card className="p-4 mt-2 grid gap-2 md:grid-cols-3 text-sm">
        <div><span className="text-muted-foreground">{t("ld_dag" as any)}:</span> <strong>{land.dag_no ?? "—"}</strong></div>
        <div><span className="text-muted-foreground">{t("ld_size" as any)}:</span> <strong>{land.land_size}</strong></div>
        <div><span className="text-muted-foreground">{t("ld_type" as any)}:</span> {land.field_type} / {land.owner_type}</div>
        <div><span className="text-muted-foreground">{t("ld_mouza" as any)}:</span> {loc?.mouza_name ?? land.mouza ?? "—"}</div>
        <div><span className="text-muted-foreground">{t("ld_village" as any)}:</span> {loc?.village_name ?? "—"}</div>
        <div><span className="text-muted-foreground">{t("ld_ward" as any)}:</span> {loc?.ward_name ?? "—"}</div>
        <div><span className="text-muted-foreground">{t("ld_union" as any)}:</span> {loc?.union_name ?? "—"}</div>
        <div><span className="text-muted-foreground">{t("ld_upazila" as any)}:</span> {loc?.upazila_name ?? "—"}</div>
        <div><span className="text-muted-foreground">{t("ld_district" as any)}:</span> {loc?.district_name ?? "—"}</div>
        <div className="md:col-span-3 pt-2 border-t mt-2">
          <span className="text-muted-foreground">{t("ld_registeredOwner" as any)}:</span>{" "}
          {owner ? (
            <Link to={`/farmers/${owner.id}`} className="font-medium underline">
              {owner.name_en} <span className="text-xs text-muted-foreground">({owner.member_no ?? owner.farmer_code})</span>
            </Link>
          ) : "—"}
        </div>
      </Card>

      <Card className="mt-4">
        <div className="p-3 border-b flex items-center justify-between">
          <div className="font-medium">{t("ld_relationsTitle" as any)}</div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{t("ld_activeTotal" as any)}</span>
            <Badge variant={overShare ? "destructive" : "default"}>{totalActiveShare}%</Badge>
          </div>
        </div>
        {overShare && (
          <Alert variant="destructive" className="m-3">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{t("ld_shareExceeds" as any)}</AlertTitle>
            <AlertDescription>{t("ld_shareExceedsDesc" as any)}</AlertDescription>
          </Alert>
        )}
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t("ld_owner" as any)}</TableHead><TableHead>{t("ld_tenant" as any)}</TableHead><TableHead>{t("ld_sharePct" as any)}</TableHead>
            <TableHead>{t("ld_validFrom" as any)}</TableHead><TableHead>{t("ld_validTo" as any)}</TableHead><TableHead>{t("ld_status" as any)}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {relations.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.owner?.name_en} <span className="text-xs text-muted-foreground">({r.owner?.member_no ?? r.owner?.farmer_code})</span></TableCell>
                <TableCell>{r.sc?.name_en ? <>{r.sc.name_en} <span className="text-xs text-muted-foreground">({r.sc.member_no ?? r.sc.farmer_code})</span></> : <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>{r.share_percentage}%</TableCell>
                <TableCell>{fmtDate(r.valid_from)}</TableCell>
                <TableCell>{r.valid_to ? fmtDate(r.valid_to) : "—"}</TableCell>
                <TableCell><Badge variant={r.valid_to ? "secondary" : "default"}>{r.valid_to ? t("ld_historic" as any) : t("ld_active" as any)}</Badge></TableCell>
              </TableRow>
            ))}
            {relations.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">{t("ld_noRelations" as any)}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <Card className="mt-4">
        <div className="p-3 border-b font-medium">{t("ld_recentCharges" as any)}</div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t("date")}</TableHead><TableHead>{t("season")}</TableHead><TableHead>{t("ld_total" as any)}</TableHead>
            <TableHead>{t("ld_paid" as any)}</TableHead><TableHead>{t("ld_due" as any)}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {charges.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{fmtDate(c.entry_date)}</TableCell>
                <TableCell>{c.seasons ? `${c.seasons.year} · ${c.seasons.type}` : "—"}</TableCell>
                <TableCell>{c.total}</TableCell>
                <TableCell>{c.paid_amount}</TableCell>
                <TableCell>{c.due_amount}</TableCell>
              </TableRow>
            ))}
            {charges.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">{t("ld_noCharges" as any)}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
