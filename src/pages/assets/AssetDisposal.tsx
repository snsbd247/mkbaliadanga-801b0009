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
import { Plus, Download, Search, Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { useLang } from "@/i18n/LanguageProvider";
import { downloadCsv } from "@/lib/csvExport";
import { logAssetAudit } from "@/lib/assetAudit";
import { calcDisposalGainLoss } from "@/lib/assetMath";

type Office = { id: string; name: string };
type AssetLite = { id: string; asset_code: string; name_en: string; name_bn: string | null; office_id: string | null; purchase_price: number };
type Row = {
  id: string; asset_id: string; office_id: string | null;
  disposal_date: string; method: string; sale_amount: number; book_value: number; gain_loss: number;
  remarks: string | null; journal_entry_id: string | null;
  created_at: string; deleted_at: string | null;
};

const today = () => new Date().toISOString().slice(0, 10);
const monthsAgo = (n: number) => { const d = new Date(); d.setMonth(d.getMonth() - n); return d.toISOString().slice(0, 10); };

async function postDisposalJournal(opts: {
  asset: AssetLite; sale_amount: number; book_value: number; gain_loss: number;
  reference: string; userId: string | null;
}) {
  const codes = ["1010", "1500", "4090", "5050"];
  const { data: accs } = await supabase.from("accounts").select("id,code").in("code", codes);
  const byCode = Object.fromEntries((accs ?? []).map((a: any) => [a.code, a.id]));
  if (!byCode["1010"] || !byCode["1500"]) return null;
  const { data: je, error } = await supabase.from("journal_entries").insert({
    entry_date: today(), reference: opts.reference,
    description: `Asset disposal ${opts.asset.asset_code}`,
    office_id: opts.asset.office_id, posted: true, posted_at: new Date().toISOString(),
    created_by: opts.userId,
  }).select("id").single();
  if (error || !je) return null;
  const lines: any[] = [];
  let pos = 0;
  if (opts.sale_amount > 0) lines.push({ journal_id: je.id, account_id: byCode["1010"], debit: opts.sale_amount, credit: 0, position: pos++, description: "Cash from disposal" });
  if (opts.gain_loss < 0 && byCode["5050"]) lines.push({ journal_id: je.id, account_id: byCode["5050"], debit: Math.abs(opts.gain_loss), credit: 0, position: pos++, description: "Disposal loss" });
  lines.push({ journal_id: je.id, account_id: byCode["1500"], debit: 0, credit: opts.book_value, position: pos++, description: "Asset book value" });
  if (opts.gain_loss > 0 && byCode["4090"]) lines.push({ journal_id: je.id, account_id: byCode["4090"], debit: 0, credit: opts.gain_loss, position: pos++, description: "Disposal gain" });
  await supabase.from("journal_entry_lines").insert(lines);
  return je.id;
}

export default function AssetDisposal() {
  const { tx } = useLang();
  const { user, officeId, isAdmin } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [assets, setAssets] = useState<AssetLite[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [q, setQ] = useState("");
  const [methodF, setMethodF] = useState("all");
  const [from, setFrom] = useState(monthsAgo(12));
  const [to, setTo] = useState(today());
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    asset_id: "", disposal_date: today(), method: "scrap_sale" as "scrap_sale" | "write_off" | "donation" | "lost",
    sale_amount: 0, book_value: 0, remarks: "", post_journal: true,
  });

  useEffect(() => { document.title = tx("Asset Disposal", "এসেট অপসারণ"); load(); }, []);
  useEffect(() => { load(); }, [from, to]);

  async function load() {
    const [r, a, o] = await Promise.all([
      supabase.from("asset_disposals" as any).select("*")
        .is("deleted_at", null)
        .gte("disposal_date", from).lte("disposal_date", to)
        .order("disposal_date", { ascending: false }).order("created_at", { ascending: false })
        .limit(1000),
      supabase.from("assets" as any).select("id,asset_code,name_en,name_bn,office_id,purchase_price").is("deleted_at", null),
      supabase.from("offices").select("id,name").order("name"),
    ]);
    if (r.error) toast.error(r.error.message); else setRows((r.data as any) ?? []);
    if (!a.error) setAssets((a.data as any) ?? []);
    if (!o.error) setOffices((o.data as any) ?? []);
  }

  const assetById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);

  // Auto-fill book_value when asset chosen
  useEffect(() => {
    if (!form.asset_id) return;
    const a = assetById.get(form.asset_id);
    if (a) setForm((f) => ({ ...f, book_value: Number(a.purchase_price || 0) }));
  }, [form.asset_id, assetById]);

  const visible = useMemo(() => rows.filter((r) => {
    if (methodF !== "all" && r.method !== methodF) return false;
    if (!q.trim()) return true;
    const a = assetById.get(r.asset_id);
    const k = q.trim().toLowerCase();
    return ((a?.asset_code ?? "") + " " + (a?.name_en ?? "") + " " + (a?.name_bn ?? "") + " " + (r.remarks ?? "")).toLowerCase().includes(k);
  }), [rows, q, methodF, assetById]);

  const totalSale = useMemo(() => visible.reduce((s, r) => s + Number(r.sale_amount || 0), 0), [visible]);
  const totalGainLoss = useMemo(() => visible.reduce((s, r) => s + Number(r.gain_loss || 0), 0), [visible]);

  const previewGainLoss = useMemo(
    () => calcDisposalGainLoss(Number(form.sale_amount || 0), Number(form.book_value || 0)),
    [form.sale_amount, form.book_value]
  );

  async function save() {
    if (!form.asset_id) return toast.error(tx("Asset required", "এসেট দরকার"));
    setSaving(true);
    try {
      const a = assetById.get(form.asset_id);
      if (!a) throw new Error("Asset not found");
      const gain_loss = calcDisposalGainLoss(form.sale_amount, form.book_value);
      const { data: row, error } = await supabase.from("asset_disposals" as any).insert({
        office_id: a.office_id, asset_id: form.asset_id,
        disposal_date: form.disposal_date, method: form.method,
        sale_amount: form.sale_amount, book_value: form.book_value, gain_loss,
        remarks: form.remarks || null, created_by: user?.id ?? null,
      }).select("id").single();
      if (error) throw error;
      let jeId: string | null = null;
      if (form.post_journal && (form.method === "scrap_sale" || form.method === "write_off")) {
        jeId = await postDisposalJournal({
          asset: a, sale_amount: form.sale_amount, book_value: form.book_value, gain_loss,
          reference: `ASSET-DISP-${(row as any).id.slice(0, 8)}`, userId: user?.id ?? null,
        });
        if (jeId) await supabase.from("asset_disposals" as any).update({ journal_entry_id: jeId }).eq("id", (row as any).id);
      }
      const newStatus = form.method === "lost" ? "lost" : form.method === "scrap_sale" ? "scrapped" : "disposed";
      await supabase.from("assets" as any).update({ current_status: newStatus, disposed_at: new Date().toISOString() }).eq("id", form.asset_id);
      await logAssetAudit({
        office_id: a.office_id, asset_id: form.asset_id,
        entity: "asset_disposal", entity_id: (row as any)?.id ?? null,
        action_type: "dispose", new_data: { ...form, gain_loss, journal_entry_id: jeId },
      });
      toast.success(tx("Disposal recorded", "অপসারণ রেকর্ড হয়েছে"));
      setOpen(false);
      setForm({ asset_id: "", disposal_date: today(), method: "scrap_sale", sale_amount: 0, book_value: 0, remarks: "", post_journal: true });
      load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }

  function exportCsv() {
    downloadCsv(`asset-disposals-${from}_to_${to}`, visible, [
      { header: tx("Date", "তারিখ"), accessor: (r) => r.disposal_date },
      { header: tx("Code", "কোড"), accessor: (r) => assetById.get(r.asset_id)?.asset_code ?? "" },
      { header: tx("Name", "নাম"), accessor: (r) => assetById.get(r.asset_id)?.name_bn ?? assetById.get(r.asset_id)?.name_en ?? "" },
      { header: tx("Method", "পদ্ধতি"), accessor: (r) => r.method },
      { header: tx("Sale amount", "বিক্রয় মূল্য"), accessor: (r) => Number(r.sale_amount || 0) },
      { header: tx("Book value", "বুক মূল্য"), accessor: (r) => Number(r.book_value || 0) },
      { header: tx("Gain/Loss", "লাভ/ক্ষতি"), accessor: (r) => Number(r.gain_loss || 0) },
      { header: tx("Journal", "জার্নাল"), accessor: (r) => r.journal_entry_id ?? "" },
      { header: tx("Remarks", "মন্তব্য"), accessor: (r) => r.remarks ?? "" },
    ]);
  }

  return (
    <>
      <PageHeader
        title={tx("Asset Disposal", "এসেট অপসারণ")}
        description={tx("Sale, write-off, donation or loss — with automatic accounting entries.",
          "বিক্রয়, রাইট-অফ, দান বা ক্ষতি — স্বয়ংক্রিয় হিসাব এন্ট্রিসহ।")}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4 mr-1" />CSV</Button>
            {isAdmin && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />{tx("New disposal", "নতুন অপসারণ")}</Button></DialogTrigger>
                <DialogContent className="max-w-xl">
                  <DialogHeader><DialogTitle>{tx("Record disposal", "অপসারণ রেকর্ড")}</DialogTitle></DialogHeader>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Label>{tx("Asset", "এসেট")}</Label>
                      <Select value={form.asset_id} onValueChange={(v) => setForm({ ...form, asset_id: v })}>
                        <SelectTrigger><SelectValue placeholder={tx("Choose asset", "এসেট বাছুন")} /></SelectTrigger>
                        <SelectContent>{assets.map((a) => <SelectItem key={a.id} value={a.id}>{a.asset_code} — {a.name_bn || a.name_en}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>{tx("Date", "তারিখ")}</Label><Input type="date" value={form.disposal_date} onChange={(e) => setForm({ ...form, disposal_date: e.target.value })} /></div>
                    <div>
                      <Label>{tx("Method", "পদ্ধতি")}</Label>
                      <Select value={form.method} onValueChange={(v: any) => setForm({ ...form, method: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="scrap_sale">{tx("Scrap sale", "ভাঙ্গারি বিক্রয়")}</SelectItem>
                          <SelectItem value="write_off">{tx("Write-off", "রাইট-অফ")}</SelectItem>
                          <SelectItem value="donation">{tx("Donation", "দান")}</SelectItem>
                          <SelectItem value="lost">{tx("Lost", "হারিয়ে গেছে")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>{tx("Sale amount", "বিক্রয় মূল্য")}</Label><Input type="number" min={0} value={form.sale_amount} onChange={(e) => setForm({ ...form, sale_amount: Number(e.target.value) })} /></div>
                    <div><Label>{tx("Book value", "বুক মূল্য")}</Label><Input type="number" min={0} value={form.book_value} onChange={(e) => setForm({ ...form, book_value: Number(e.target.value) })} /></div>
                    <div className="col-span-2">
                      <div className={`p-2 rounded text-sm ${previewGainLoss >= 0 ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-destructive/10 text-destructive"}`}>
                        {tx("Gain/Loss preview", "লাভ/ক্ষতি প্রিভিউ")}: {previewGainLoss.toLocaleString()}
                      </div>
                    </div>
                    <div className="col-span-2"><Label>{tx("Remarks", "মন্তব্য")}</Label><Textarea rows={2} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></div>
                    <div className="col-span-2 flex items-center gap-2">
                      <input id="post_je" type="checkbox" checked={form.post_journal} onChange={(e) => setForm({ ...form, post_journal: e.target.checked })} />
                      <Label htmlFor="post_je" className="cursor-pointer">{tx("Post journal entry (scrap sale / write-off)", "জার্নাল এন্ট্রি পোস্ট করুন (বিক্রয়/রাইট-অফ)")}</Label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>{tx("Cancel", "বাতিল")}</Button>
                    <Button onClick={save} disabled={saving}>{saving ? "…" : tx("Save & post", "সংরক্ষণ ও পোস্ট")}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <Card className="p-3"><div className="text-xs text-muted-foreground">{tx("Records", "রেকর্ড")}</div><div className="text-2xl font-bold">{visible.length.toLocaleString()}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">{tx("Total sale", "মোট বিক্রয়")}</div><div className="text-2xl font-bold">{totalSale.toLocaleString()}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">{tx("Net gain/loss", "নেট লাভ/ক্ষতি")}</div><div className={`text-2xl font-bold ${totalGainLoss >= 0 ? "text-emerald-600" : "text-destructive"}`}>{totalGainLoss.toLocaleString()}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">{tx("Posted", "পোস্টকৃত")}</div><div className="text-2xl font-bold">{visible.filter(r => r.journal_entry_id).length}</div></Card>
      </div>

      <Card className="p-3 mb-3">
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx("Search…", "খুঁজুন…")} />
          </div>
          <div>
            <Label className="text-xs">{tx("Method", "পদ্ধতি")}</Label>
            <Select value={methodF} onValueChange={setMethodF}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tx("All", "সব")}</SelectItem>
                <SelectItem value="scrap_sale">{tx("Scrap sale", "ভাঙ্গারি বিক্রয়")}</SelectItem>
                <SelectItem value="write_off">{tx("Write-off", "রাইট-অফ")}</SelectItem>
                <SelectItem value="donation">{tx("Donation", "দান")}</SelectItem>
                <SelectItem value="lost">{tx("Lost", "হারিয়ে গেছে")}</SelectItem>
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
              <TableHead>{tx("Method", "পদ্ধতি")}</TableHead>
              <TableHead className="text-right">{tx("Sale", "বিক্রয়")}</TableHead>
              <TableHead className="text-right">{tx("Book value", "বুক মূল্য")}</TableHead>
              <TableHead className="text-right">{tx("Gain/Loss", "লাভ/ক্ষতি")}</TableHead>
              <TableHead>{tx("JE", "জার্নাল")}</TableHead>
              <TableHead className="text-right">{tx("Actions", "অ্যাকশন")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((r) => {
              const a = assetById.get(r.asset_id);
              const gl = Number(r.gain_loss || 0);
              return (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{r.disposal_date}</TableCell>
                  <TableCell><div className="font-mono text-xs">{a?.asset_code}</div><div className="text-sm">{a?.name_bn || a?.name_en}</div></TableCell>
                  <TableCell><Badge variant="outline">{r.method}</Badge></TableCell>
                  <TableCell className="text-right">{Number(r.sale_amount || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right">{Number(r.book_value || 0).toLocaleString()}</TableCell>
                  <TableCell className={`text-right font-medium ${gl >= 0 ? "text-emerald-600" : "text-destructive"}`}>{gl.toLocaleString()}</TableCell>
                  <TableCell>{r.journal_entry_id ? <Badge variant="default" className="text-xs">{tx("Posted", "পোস্টকৃত")}</Badge> : <Badge variant="secondary" className="text-xs">—</Badge>}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" asChild><Link to={`/assets/items/${r.asset_id}`}><Eye className="h-4 w-4" /></Link></Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {!visible.length && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6"><Trash2 className="h-8 w-8 mx-auto mb-2 opacity-40" />{tx("No disposals in selected range", "নির্বাচিত সময়ে কোনো অপসারণ নেই")}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
