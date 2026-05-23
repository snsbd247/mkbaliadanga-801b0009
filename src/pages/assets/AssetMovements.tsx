import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Download, Search, Eye, ArrowRightLeft, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { useLang } from "@/i18n/LanguageProvider";
import { downloadCsv } from "@/lib/csvExport";
import { recordAssetMovement, approveAssetMovement, rejectAssetMovement } from "@/lib/assetStock";
import { logAssetAudit } from "@/lib/assetAudit";

type Office = { id: string; name: string };
type AssetLite = { id: string; asset_code: string; name_en: string; name_bn: string | null; office_id: string | null };
type Movement = {
  id: string; asset_id: string; office_id: string | null;
  from_location_id: string | null; to_location_id: string | null;
  quantity: number; movement_date: string; remarks: string | null;
  created_at: string; deleted_at: string | null; moved_by: string | null;
  approval_status: "pending" | "approved" | "rejected";
  applied: boolean;
  requested_by: string | null; approved_by: string | null;
  approved_at: string | null; rejection_reason: string | null;
};

const today = () => new Date().toISOString().slice(0, 10);
const monthAgo = () => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); };

export default function AssetMovements() {
  const { tx } = useLang();
  const { user, officeId, isAdmin } = useAuth();
  const [rows, setRows] = useState<Movement[]>([]);
  const [assets, setAssets] = useState<AssetLite[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [from, setFrom] = useState(monthAgo());
  const [to, setTo] = useState(today());
  const [open, setOpen] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    asset_id: "", from_location_id: "", to_location_id: "",
    quantity: 1, movement_date: today(), remarks: "",
  });

  useEffect(() => { document.title = tx("Asset Movements", "এসেট স্থানান্তর"); load(); }, []);
  useEffect(() => { load(); /* refetch on date range change */ }, [from, to]);

  async function load() {
    const [m, a, o] = await Promise.all([
      supabase.from("asset_movements" as any).select("*")
        .is("deleted_at", null)
        .gte("movement_date", from).lte("movement_date", to)
        .order("movement_date", { ascending: false }).order("created_at", { ascending: false })
        .limit(1000),
      supabase.from("assets" as any).select("id,asset_code,name_en,name_bn,office_id").is("deleted_at", null),
      supabase.from("offices").select("id,name").order("name"),
    ]);
    if (m.error) toast.error(m.error.message); else setRows((m.data as any) ?? []);
    if (a.error) toast.error(a.error.message); else setAssets((a.data as any) ?? []);
    if (o.error) toast.error(o.error.message); else setOffices((o.data as any) ?? []);
  }

  const assetById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  const officeById = useMemo(() => new Map(offices.map((o) => [o.id, o.name])), [offices]);

  const visible = useMemo(() => rows.filter((r) => {
    if (status !== "all" && r.approval_status !== status) return false;
    if (!q.trim()) return true;
    const a = assetById.get(r.asset_id);
    const k = q.trim().toLowerCase();
    return ((a?.asset_code ?? "") + " " + (a?.name_en ?? "") + " " + (a?.name_bn ?? "") + " " + (r.remarks ?? "")).toLowerCase().includes(k);
  }), [rows, q, status, assetById]);

  const pendingCount = useMemo(() => rows.filter((r) => r.approval_status === "pending").length, [rows]);

  async function save() {
    if (!form.asset_id) return toast.error(tx("Asset required", "এসেট দরকার"));
    if (!form.to_location_id) return toast.error(tx("Destination required", "গন্তব্য দরকার"));
    if (form.from_location_id && form.from_location_id === form.to_location_id) return toast.error(tx("Choose different destination", "ভিন্ন গন্তব্য বাছুন"));
    setSaving(true);
    try {
      const a = assetById.get(form.asset_id);
      const requiresApproval = !isAdmin;
      const id = await recordAssetMovement({
        asset_id: form.asset_id, office_id: a?.office_id ?? officeId,
        from_location_id: form.from_location_id || null,
        to_location_id: form.to_location_id,
        quantity: Number(form.quantity), movement_date: form.movement_date,
        remarks: form.remarks || null, moved_by: user?.id ?? null,
        requiresApproval,
      });
      await logAssetAudit({
        office_id: a?.office_id ?? officeId, asset_id: form.asset_id,
        entity: "asset_movement", entity_id: id ?? null,
        action_type: "transfer", new_data: { ...form, approval_status: requiresApproval ? "pending" : "approved" },
      });
      toast.success(requiresApproval
        ? tx("Transfer request submitted for approval", "অনুমোদনের জন্য ট্রান্সফার অনুরোধ পাঠানো হয়েছে")
        : tx("Movement recorded", "মুভমেন্ট রেকর্ড হয়েছে"));
      setOpen(false);
      setForm({ asset_id: "", from_location_id: "", to_location_id: "", quantity: 1, movement_date: today(), remarks: "" });
      load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }

  async function approve(id: string) {
    try {
      await approveAssetMovement(id, user?.id ?? null);
      await logAssetAudit({ entity: "asset_movement", entity_id: id, action_type: "transfer", remarks: "approved" });
      toast.success(tx("Approved", "অনুমোদিত"));
      load();
    } catch (e: any) { toast.error(e.message); }
  }
  async function reject() {
    if (!rejectId) return;
    if (!rejectReason.trim()) return toast.error(tx("Reason required", "কারণ দরকার"));
    try {
      await rejectAssetMovement(rejectId, user?.id ?? null, rejectReason.trim());
      await logAssetAudit({ entity: "asset_movement", entity_id: rejectId, action_type: "transfer", remarks: `rejected: ${rejectReason.trim()}` });
      toast.success(tx("Rejected", "প্রত্যাখ্যাত"));
      setRejectId(null); setRejectReason("");
      load();
    } catch (e: any) { toast.error(e.message); }
  }


  function exportCsv() {
    downloadCsv(`asset-movements-${from}_to_${to}`, visible, [
      { header: tx("Date", "তারিখ"), accessor: (r) => r.movement_date },
      { header: tx("Code", "কোড"), accessor: (r) => assetById.get(r.asset_id)?.asset_code ?? "" },
      { header: tx("Name", "নাম"), accessor: (r) => assetById.get(r.asset_id)?.name_bn ?? assetById.get(r.asset_id)?.name_en ?? "" },
      { header: tx("From", "থেকে"), accessor: (r) => officeById.get(r.from_location_id ?? "") ?? "" },
      { header: tx("To", "এ"), accessor: (r) => officeById.get(r.to_location_id ?? "") ?? "" },
      { header: tx("Quantity", "পরিমাণ"), accessor: (r) => Number(r.quantity) },
      { header: tx("Remarks", "মন্তব্য"), accessor: (r) => r.remarks ?? "" },
    ]);
  }

  return (
    <>
      <PageHeader
        title={tx("Asset Movements", "এসেট স্থানান্তর")}
        description={tx(
          "Operational ledger of every asset transfer between locations.",
          "অবস্থানগুলোর মধ্যে প্রতিটি এসেট স্থানান্তরের অপারেশনাল লেজার।",
        )}
        actions={
          <div className="flex gap-2 items-center">
            {isAdmin && pendingCount > 0 && (
              <Badge variant="destructive">{pendingCount} {tx("pending", "অনুমোদনের অপেক্ষায়")}</Badge>
            )}
            <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4 mr-1" />{tx("CSV", "CSV")}</Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" />{isAdmin ? tx("New movement", "নতুন মুভমেন্ট") : tx("Request transfer", "ট্রান্সফার অনুরোধ")}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{isAdmin ? tx("Record movement", "মুভমেন্ট রেকর্ড") : tx("Request transfer", "ট্রান্সফার অনুরোধ")}</DialogTitle></DialogHeader>
                {!isAdmin && (
                  <p className="text-xs text-muted-foreground">{tx("Your request will be sent to an admin for approval.", "আপনার অনুরোধ অনুমোদনের জন্য অ্যাডমিনের কাছে পাঠানো হবে।")}</p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label>{tx("Asset", "এসেট")}</Label>
                    <Select value={form.asset_id} onValueChange={(v) => setForm({ ...form, asset_id: v })}>
                      <SelectTrigger><SelectValue placeholder={tx("Choose asset", "এসেট বাছুন")} /></SelectTrigger>
                      <SelectContent>{assets.map((a) => <SelectItem key={a.id} value={a.id}>{a.asset_code} — {a.name_bn || a.name_en}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>{tx("Date", "তারিখ")}</Label><Input type="date" value={form.movement_date} onChange={(e) => setForm({ ...form, movement_date: e.target.value })} /></div>
                  <div><Label>{tx("Quantity", "পরিমাণ")}</Label><Input type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} /></div>
                  <div>
                    <Label>{tx("From", "থেকে")}</Label>
                    <Select value={form.from_location_id} onValueChange={(v) => setForm({ ...form, from_location_id: v })}>
                      <SelectTrigger><SelectValue placeholder={tx("Source (optional)", "উৎস (ঐচ্ছিক)")} /></SelectTrigger>
                      <SelectContent>{offices.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{tx("To", "এ")}</Label>
                    <Select value={form.to_location_id} onValueChange={(v) => setForm({ ...form, to_location_id: v })}>
                      <SelectTrigger><SelectValue placeholder={tx("Destination", "গন্তব্য")} /></SelectTrigger>
                      <SelectContent>{offices.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label>{tx("Remarks", "মন্তব্য")}</Label>
                    <Textarea rows={2} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>{tx("Cancel", "বাতিল")}</Button>
                  <Button onClick={save} disabled={saving}>{saving ? "…" : isAdmin ? tx("Save", "সংরক্ষণ") : tx("Submit request", "অনুরোধ জমা দিন")}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <Card className="p-3 mb-3">
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx("Search code, name, remarks…", "কোড, নাম, মন্তব্য খুঁজুন…")} />
          </div>
          <div>
            <Label className="text-xs">{tx("Status", "স্ট্যাটাস")}</Label>
            <Select value={status} onValueChange={(v: any) => setStatus(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tx("All", "সব")}</SelectItem>
                <SelectItem value="pending">{tx("Pending", "অপেক্ষমাণ")}</SelectItem>
                <SelectItem value="approved">{tx("Approved", "অনুমোদিত")}</SelectItem>
                <SelectItem value="rejected">{tx("Rejected", "প্রত্যাখ্যাত")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">{tx("From", "থেকে")}</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label className="text-xs">{tx("To", "পর্যন্ত")}</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tx("Date", "তারিখ")}</TableHead>
              <TableHead>{tx("Asset", "এসেট")}</TableHead>
              <TableHead>{tx("From", "থেকে")}</TableHead>
              <TableHead></TableHead>
              <TableHead>{tx("To", "এ")}</TableHead>
              <TableHead className="text-right">{tx("Quantity", "পরিমাণ")}</TableHead>
              <TableHead>{tx("Status", "স্ট্যাটাস")}</TableHead>
              <TableHead>{tx("Remarks", "মন্তব্য")}</TableHead>
              <TableHead className="text-right">{tx("Actions", "অ্যাকশন")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((m) => {
              const a = assetById.get(m.asset_id);
              const statusVariant = m.approval_status === "approved" ? "default"
                : m.approval_status === "rejected" ? "destructive" : "secondary";
              const statusLabel = m.approval_status === "approved" ? tx("Approved", "অনুমোদিত")
                : m.approval_status === "rejected" ? tx("Rejected", "প্রত্যাখ্যাত") : tx("Pending", "অপেক্ষমাণ");
              return (
                <TableRow key={m.id}>
                  <TableCell className="text-xs">{m.movement_date}</TableCell>
                  <TableCell>
                    <div className="font-mono text-xs">{a?.asset_code}</div>
                    <div className="text-sm">{a?.name_bn || a?.name_en}</div>
                  </TableCell>
                  <TableCell className="text-sm">{officeById.get(m.from_location_id ?? "") ?? "—"}</TableCell>
                  <TableCell><ArrowRightLeft className="h-4 w-4 text-muted-foreground" /></TableCell>
                  <TableCell className="text-sm">{officeById.get(m.to_location_id ?? "") ?? "—"}</TableCell>
                  <TableCell className="text-right font-medium">{Number(m.quantity).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant as any}>{statusLabel}</Badge>
                    {m.approval_status === "rejected" && m.rejection_reason && (
                      <div className="text-[10px] text-muted-foreground mt-1">{m.rejection_reason}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{m.remarks ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {isAdmin && m.approval_status === "pending" && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => approve(m.id)} aria-label={tx("Approve", "অনুমোদন")} title={tx("Approve", "অনুমোদন")}>
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { setRejectId(m.id); setRejectReason(""); }} aria-label={tx("Reject", "প্রত্যাখ্যান")} title={tx("Reject", "প্রত্যাখ্যান")}>
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                      <Button variant="ghost" size="icon" asChild>
                        <Link to={`/assets/items/${m.asset_id}`} aria-label={tx("View", "দেখুন")}><Eye className="h-4 w-4" /></Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {!visible.length && (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">{tx("No movements in selected range", "নির্বাচিত সময়ে কোনো মুভমেন্ট নেই")}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!rejectId} onOpenChange={(o) => { if (!o) { setRejectId(null); setRejectReason(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{tx("Reject transfer request", "ট্রান্সফার অনুরোধ প্রত্যাখ্যান")}</DialogTitle></DialogHeader>
          <div>
            <Label>{tx("Reason", "কারণ")}</Label>
            <Textarea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder={tx("Explain why this transfer is being rejected", "কেন প্রত্যাখ্যান করা হচ্ছে তা ব্যাখ্যা করুন")} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectId(null); setRejectReason(""); }}>{tx("Cancel", "বাতিল")}</Button>
            <Button variant="destructive" onClick={reject}>{tx("Reject", "প্রত্যাখ্যান")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
