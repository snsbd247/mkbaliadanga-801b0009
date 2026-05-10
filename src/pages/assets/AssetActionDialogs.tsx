import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { useLang } from "@/i18n/LanguageProvider";
import { logAssetAudit } from "@/lib/assetAudit";
import { calcDisposalGainLoss } from "@/lib/assetMath";
import { Plus } from "lucide-react";

type Office = { id: string; name: string };
type Asset = {
  id: string;
  office_id: string | null;
  asset_code: string;
  name_en: string;
  name_bn: string | null;
  tracking_mode: "quantity" | "serial";
  purchase_price: number;
  current_location_id: string | null;
};

const today = () => new Date().toISOString().slice(0, 10);

function useOffices() {
  const [offices, setOffices] = useState<Office[]>([]);
  useEffect(() => {
    supabase.from("offices").select("id,name").order("name").then((r) => {
      if (!r.error) setOffices((r.data as any) ?? []);
    });
  }, []);
  return offices;
}

async function postPurchaseJournal(opts: {
  asset: Asset; total: number; payment_method: string; reference: string; userId: string | null;
}) {
  const cashCode = opts.payment_method === "bank" ? "1020" : "1010";
  const { data: accs } = await supabase.from("accounts").select("id,code").in("code", ["1510", cashCode]);
  const byCode = Object.fromEntries((accs ?? []).map((a: any) => [a.code, a.id]));
  if (!byCode["1510"] || !byCode[cashCode]) return null;
  const { data: je, error } = await supabase.from("journal_entries").insert({
    entry_date: today(), reference: opts.reference,
    description: `Asset purchase ${opts.asset.asset_code}`,
    office_id: opts.asset.office_id, posted: true, posted_at: new Date().toISOString(),
    created_by: opts.userId,
  }).select("id").single();
  if (error || !je) return null;
  await supabase.from("journal_entry_lines").insert([
    { journal_id: je.id, account_id: byCode["1510"], debit: opts.total, credit: 0, position: 0, description: "Asset Inventory" },
    { journal_id: je.id, account_id: byCode[cashCode], debit: 0, credit: opts.total, position: 1, description: opts.payment_method === "bank" ? "Bank" : "Cash" },
  ]);
  return je.id;
}

async function postDisposalJournal(opts: {
  asset: Asset; sale_amount: number; book_value: number; gain_loss: number; reference: string; userId: string | null;
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

async function setStatus(asset_id: string, status: string, extra: Record<string, any> = {}) {
  await supabase.from("assets" as any).update({ current_status: status, ...extra }).eq("id", asset_id);
}

async function adjustStock(asset_id: string, office_id: string | null, location_id: string | null, delta: number) {
  if (!location_id) return;
  const { data: existing } = await supabase.from("asset_stocks" as any)
    .select("id,quantity").eq("asset_id", asset_id).eq("location_id", location_id).maybeSingle();
  if (existing) {
    const next = Number((existing as any).quantity) + delta;
    await supabase.from("asset_stocks" as any).update({ quantity: Math.max(0, next), updated_at: new Date().toISOString() }).eq("id", (existing as any).id);
  } else if (delta > 0) {
    await supabase.from("asset_stocks" as any).insert({ asset_id, office_id, location_id, quantity: delta });
  }
}

interface BaseProps { asset: Asset; onDone: () => void; }

/* -------- Purchase -------- */
export function PurchaseDialog({ asset, onDone }: BaseProps) {
  const { tx } = useLang();
  const { user } = useAuth();
  const offices = useOffices();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    purchase_date: today(), quantity: 1, unit_price: asset.purchase_price || 0,
    supplier: "", invoice_no: "", payment_method: "cash", location_id: asset.office_id ?? "", notes: "",
  });
  const total = +(Number(f.quantity || 0) * Number(f.unit_price || 0)).toFixed(2);

  async function save() {
    if (!f.quantity || !f.unit_price) return toast.error(tx("Quantity and price required", "পরিমাণ ও মূল্য দরকার"));
    setSaving(true);
    try {
      const { data: row, error } = await supabase.from("asset_purchases" as any).insert({
        office_id: asset.office_id, asset_id: asset.id,
        purchase_date: f.purchase_date, quantity: f.quantity, unit_price: f.unit_price, total_amount: total,
        supplier: f.supplier || null, invoice_no: f.invoice_no || null,
        payment_method: f.payment_method, notes: f.notes || null, created_by: user?.id ?? null,
      }).select("id").single();
      if (error) throw error;
      const jeId = await postPurchaseJournal({ asset, total, payment_method: f.payment_method, reference: `ASSET-PUR-${(row as any).id.slice(0,8)}`, userId: user?.id ?? null });
      if (jeId) await supabase.from("asset_purchases" as any).update({ journal_entry_id: jeId }).eq("id", (row as any).id);
      await adjustStock(asset.id, asset.office_id, f.location_id || null, Number(f.quantity));
      await setStatus(asset.id, "in_stock");
      await logAssetAudit({ office_id: asset.office_id, asset_id: asset.id, entity: "asset_purchase", entity_id: (row as any).id, action_type: "purchase", new_data: { ...f, total_amount: total, journal_entry_id: jeId } });
      toast.success(tx("Purchase recorded", "ক্রয় রেকর্ড হয়েছে"));
      setOpen(false); onDone();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />{tx("New purchase", "নতুন ক্রয়")}</Button></DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{tx("Record purchase", "ক্রয় রেকর্ড")}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>{tx("Date", "তারিখ")}</Label><Input type="date" value={f.purchase_date} onChange={(e) => setF({ ...f, purchase_date: e.target.value })} /></div>
          <div><Label>{tx("Supplier", "সরবরাহকারী")}</Label><Input value={f.supplier} onChange={(e) => setF({ ...f, supplier: e.target.value })} /></div>
          <div><Label>{tx("Quantity", "পরিমাণ")}</Label><Input type="number" min={1} value={f.quantity} onChange={(e) => setF({ ...f, quantity: Number(e.target.value) })} /></div>
          <div><Label>{tx("Unit price", "একক মূল্য")}</Label><Input type="number" min={0} value={f.unit_price} onChange={(e) => setF({ ...f, unit_price: Number(e.target.value) })} /></div>
          <div><Label>{tx("Total", "মোট")}</Label><Input value={total.toLocaleString()} readOnly /></div>
          <div><Label>{tx("Invoice no.", "ইনভয়েস নম্বর")}</Label><Input value={f.invoice_no} onChange={(e) => setF({ ...f, invoice_no: e.target.value })} /></div>
          <div>
            <Label>{tx("Payment method", "পেমেন্ট মাধ্যম")}</Label>
            <Select value={f.payment_method} onValueChange={(v) => setF({ ...f, payment_method: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">{tx("Cash", "নগদ")}</SelectItem>
                <SelectItem value="bank">{tx("Bank", "ব্যাংক")}</SelectItem>
                <SelectItem value="credit">{tx("Credit", "বাকি")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{tx("Stock location", "স্টক অবস্থান")}</Label>
            <Select value={f.location_id} onValueChange={(v) => setF({ ...f, location_id: v })}>
              <SelectTrigger><SelectValue placeholder={tx("Choose office", "অফিস বাছুন")} /></SelectTrigger>
              <SelectContent>{offices.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><Label>{tx("Notes", "মন্তব্য")}</Label><Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>{tx("Cancel", "বাতিল")}</Button>
          <Button onClick={save} disabled={saving}>{saving ? "…" : tx("Save & post", "সংরক্ষণ ও পোস্ট")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------- Movement -------- */
export function MovementDialog({ asset, onDone }: BaseProps) {
  const { tx } = useLang();
  const { user } = useAuth();
  const offices = useOffices();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({ movement_date: today(), from_location_id: asset.current_location_id ?? "", to_location_id: "", quantity: 1, remarks: "" });

  async function save() {
    if (!f.to_location_id || f.from_location_id === f.to_location_id) return toast.error(tx("Choose different destination", "ভিন্ন গন্তব্য বাছুন"));
    setSaving(true);
    try {
      const { data: row, error } = await supabase.from("asset_movements" as any).insert({
        office_id: asset.office_id, asset_id: asset.id, movement_date: f.movement_date,
        from_location_id: f.from_location_id || null, to_location_id: f.to_location_id,
        quantity: f.quantity, moved_by: user?.id ?? null, remarks: f.remarks || null,
      }).select("id").single();
      if (error) throw error;
      if (f.from_location_id) await adjustStock(asset.id, asset.office_id, f.from_location_id, -Number(f.quantity));
      await adjustStock(asset.id, asset.office_id, f.to_location_id, Number(f.quantity));
      await setStatus(asset.id, "transferred", { current_location_id: f.to_location_id });
      await logAssetAudit({ office_id: asset.office_id, asset_id: asset.id, entity: "asset_movement", entity_id: (row as any).id, action_type: "transfer", new_data: f });
      toast.success(tx("Movement recorded", "মুভমেন্ট রেকর্ড হয়েছে"));
      setOpen(false); onDone();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />{tx("New movement", "নতুন মুভমেন্ট")}</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{tx("Record movement", "মুভমেন্ট রেকর্ড")}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>{tx("Date", "তারিখ")}</Label><Input type="date" value={f.movement_date} onChange={(e) => setF({ ...f, movement_date: e.target.value })} /></div>
          <div><Label>{tx("Quantity", "পরিমাণ")}</Label><Input type="number" min={1} value={f.quantity} onChange={(e) => setF({ ...f, quantity: Number(e.target.value) })} /></div>
          <div>
            <Label>{tx("From", "থেকে")}</Label>
            <Select value={f.from_location_id} onValueChange={(v) => setF({ ...f, from_location_id: v })}>
              <SelectTrigger><SelectValue placeholder={tx("Source", "উৎস")} /></SelectTrigger>
              <SelectContent>{offices.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>{tx("To", "এ")}</Label>
            <Select value={f.to_location_id} onValueChange={(v) => setF({ ...f, to_location_id: v })}>
              <SelectTrigger><SelectValue placeholder={tx("Destination", "গন্তব্য")} /></SelectTrigger>
              <SelectContent>{offices.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><Label>{tx("Remarks", "মন্তব্য")}</Label><Textarea rows={2} value={f.remarks} onChange={(e) => setF({ ...f, remarks: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>{tx("Cancel", "বাতিল")}</Button>
          <Button onClick={save} disabled={saving}>{saving ? "…" : tx("Save", "সংরক্ষণ")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------- Installation -------- */
export function InstallationDialog({ asset, onDone }: BaseProps) {
  const { tx } = useLang();
  const { user } = useAuth();
  const offices = useOffices();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({ install_date: today(), location_id: asset.current_location_id ?? "", location_name: "", condition_status: "good", remarks: "" });

  async function save() {
    setSaving(true);
    try {
      const { data: row, error } = await supabase.from("asset_installations" as any).insert({
        office_id: asset.office_id, asset_id: asset.id, install_date: f.install_date,
        location_id: f.location_id || null, location_name: f.location_name || null,
        installed_by: user?.id ?? null, condition_status: f.condition_status, remarks: f.remarks || null,
      }).select("id").single();
      if (error) throw error;
      await setStatus(asset.id, "installed", { current_location_id: f.location_id || null, installed_at: new Date().toISOString() });
      await logAssetAudit({ office_id: asset.office_id, asset_id: asset.id, entity: "asset_installation", entity_id: (row as any).id, action_type: "install", new_data: f });
      toast.success(tx("Installation recorded", "ইনস্টলেশন রেকর্ড হয়েছে"));
      setOpen(false); onDone();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />{tx("New installation", "নতুন ইনস্টলেশন")}</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{tx("Record installation", "ইনস্টলেশন রেকর্ড")}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>{tx("Date", "তারিখ")}</Label><Input type="date" value={f.install_date} onChange={(e) => setF({ ...f, install_date: e.target.value })} /></div>
          <div>
            <Label>{tx("Office", "অফিস")}</Label>
            <Select value={f.location_id} onValueChange={(v) => setF({ ...f, location_id: v })}>
              <SelectTrigger><SelectValue placeholder={tx("Choose office", "অফিস বাছুন")} /></SelectTrigger>
              <SelectContent>{offices.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><Label>{tx("Location detail", "অবস্থান বিবরণ")}</Label><Input value={f.location_name} onChange={(e) => setF({ ...f, location_name: e.target.value })} placeholder={tx("e.g. Pump house, Block-A", "যেমন পাম্প ঘর, ব্লক-এ")} /></div>
          <div>
            <Label>{tx("Condition", "অবস্থা")}</Label>
            <Select value={f.condition_status} onValueChange={(v) => setF({ ...f, condition_status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="good">{tx("Good", "ভালো")}</SelectItem>
                <SelectItem value="fair">{tx("Fair", "মাঝারি")}</SelectItem>
                <SelectItem value="poor">{tx("Poor", "দুর্বল")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><Label>{tx("Remarks", "মন্তব্য")}</Label><Textarea rows={2} value={f.remarks} onChange={(e) => setF({ ...f, remarks: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>{tx("Cancel", "বাতিল")}</Button>
          <Button onClick={save} disabled={saving}>{saving ? "…" : tx("Save", "সংরক্ষণ")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------- Maintenance -------- */
export function MaintenanceDialog({ asset, onDone }: BaseProps) {
  const { tx } = useLang();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({ maintenance_date: today(), vendor: "", cost: 0, downtime_days: 0, status: "in_progress", remarks: "" });

  async function save() {
    setSaving(true);
    try {
      const { data: row, error } = await supabase.from("asset_maintenance_logs" as any).insert({
        office_id: asset.office_id, asset_id: asset.id, maintenance_date: f.maintenance_date,
        vendor: f.vendor || null, cost: f.cost, downtime_days: f.downtime_days,
        status: f.status, remarks: f.remarks || null, created_by: user?.id ?? null,
      }).select("id").single();
      if (error) throw error;
      await setStatus(asset.id, f.status === "completed" ? "in_stock" : "maintenance");
      await logAssetAudit({ office_id: asset.office_id, asset_id: asset.id, entity: "asset_maintenance", entity_id: (row as any).id, action_type: "repair", new_data: f });
      toast.success(tx("Maintenance recorded", "মেরামত রেকর্ড হয়েছে"));
      setOpen(false); onDone();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />{tx("New maintenance", "নতুন মেরামত")}</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{tx("Record maintenance", "মেরামত রেকর্ড")}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>{tx("Date", "তারিখ")}</Label><Input type="date" value={f.maintenance_date} onChange={(e) => setF({ ...f, maintenance_date: e.target.value })} /></div>
          <div><Label>{tx("Vendor", "ভেন্ডর")}</Label><Input value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })} /></div>
          <div><Label>{tx("Cost", "খরচ")}</Label><Input type="number" min={0} value={f.cost} onChange={(e) => setF({ ...f, cost: Number(e.target.value) })} /></div>
          <div><Label>{tx("Downtime (days)", "বন্ধ (দিন)")}</Label><Input type="number" min={0} value={f.downtime_days} onChange={(e) => setF({ ...f, downtime_days: Number(e.target.value) })} /></div>
          <div>
            <Label>{tx("Status", "অবস্থা")}</Label>
            <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="in_progress">{tx("In progress", "চলমান")}</SelectItem>
                <SelectItem value="completed">{tx("Completed", "সম্পন্ন")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><Label>{tx("Remarks", "মন্তব্য")}</Label><Textarea rows={2} value={f.remarks} onChange={(e) => setF({ ...f, remarks: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>{tx("Cancel", "বাতিল")}</Button>
          <Button onClick={save} disabled={saving}>{saving ? "…" : tx("Save", "সংরক্ষণ")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------- Damage -------- */
export function DamageDialog({ asset, onDone }: BaseProps) {
  const { tx } = useLang();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({ report_date: today(), severity: "minor", status: "reported", remarks: "" });

  async function save() {
    setSaving(true);
    try {
      const { data: row, error } = await supabase.from("asset_damage_reports" as any).insert({
        office_id: asset.office_id, asset_id: asset.id, report_date: f.report_date,
        severity: f.severity, reported_by: user?.id ?? null, status: f.status, remarks: f.remarks || null,
      }).select("id").single();
      if (error) throw error;
      await setStatus(asset.id, "damaged");
      await logAssetAudit({ office_id: asset.office_id, asset_id: asset.id, entity: "asset_damage", entity_id: (row as any).id, action_type: "damage", new_data: f });
      toast.success(tx("Damage recorded", "ক্ষতি রেকর্ড হয়েছে"));
      setOpen(false); onDone();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="destructive"><Plus className="h-4 w-4 mr-1" />{tx("Report damage", "ক্ষতি রিপোর্ট")}</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{tx("Report damage", "ক্ষতি রিপোর্ট")}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>{tx("Date", "তারিখ")}</Label><Input type="date" value={f.report_date} onChange={(e) => setF({ ...f, report_date: e.target.value })} /></div>
          <div>
            <Label>{tx("Severity", "মাত্রা")}</Label>
            <Select value={f.severity} onValueChange={(v) => setF({ ...f, severity: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="minor">{tx("Minor", "সামান্য")}</SelectItem>
                <SelectItem value="moderate">{tx("Moderate", "মাঝারি")}</SelectItem>
                <SelectItem value="severe">{tx("Severe", "গুরুতর")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{tx("Status", "অবস্থা")}</Label>
            <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="reported">{tx("Reported", "রিপোর্টেড")}</SelectItem>
                <SelectItem value="under_review">{tx("Under review", "পর্যালোচনাধীন")}</SelectItem>
                <SelectItem value="resolved">{tx("Resolved", "সমাধান")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><Label>{tx("Remarks", "মন্তব্য")}</Label><Textarea rows={2} value={f.remarks} onChange={(e) => setF({ ...f, remarks: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>{tx("Cancel", "বাতিল")}</Button>
          <Button onClick={save} disabled={saving}>{saving ? "…" : tx("Save", "সংরক্ষণ")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------- Disposal -------- */
export function DisposalDialog({ asset, onDone }: BaseProps) {
  const { tx } = useLang();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    disposal_date: today(), method: "scrap_sale", sale_amount: 0,
    book_value: Number(asset.purchase_price || 0), remarks: "",
  });
  const gain_loss = calcDisposalGainLoss(f.sale_amount, f.book_value);

  async function save() {
    setSaving(true);
    try {
      const { data: row, error } = await supabase.from("asset_disposals" as any).insert({
        office_id: asset.office_id, asset_id: asset.id, disposal_date: f.disposal_date,
        method: f.method, sale_amount: f.sale_amount, book_value: f.book_value, gain_loss,
        remarks: f.remarks || null, created_by: user?.id ?? null,
      }).select("id").single();
      if (error) throw error;
      const jeId = await postDisposalJournal({ asset, sale_amount: Number(f.sale_amount), book_value: Number(f.book_value), gain_loss, reference: `ASSET-DSP-${(row as any).id.slice(0,8)}`, userId: user?.id ?? null });
      if (jeId) await supabase.from("asset_disposals" as any).update({ journal_entry_id: jeId }).eq("id", (row as any).id);
      await setStatus(asset.id, "disposed");
      await logAssetAudit({ office_id: asset.office_id, asset_id: asset.id, entity: "asset_disposal", entity_id: (row as any).id, action_type: "dispose", new_data: { ...f, gain_loss, journal_entry_id: jeId } });
      toast.success(tx("Disposal recorded", "নিষ্পত্তি রেকর্ড হয়েছে"));
      setOpen(false); onDone();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="destructive"><Plus className="h-4 w-4 mr-1" />{tx("New disposal", "নতুন নিষ্পত্তি")}</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{tx("Record disposal", "নিষ্পত্তি রেকর্ড")}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>{tx("Date", "তারিখ")}</Label><Input type="date" value={f.disposal_date} onChange={(e) => setF({ ...f, disposal_date: e.target.value })} /></div>
          <div>
            <Label>{tx("Method", "পদ্ধতি")}</Label>
            <Select value={f.method} onValueChange={(v) => setF({ ...f, method: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="scrap_sale">{tx("Scrap sale", "স্ক্র্যাপ বিক্রয়")}</SelectItem>
                <SelectItem value="write_off">{tx("Write off", "অবলোপন")}</SelectItem>
                <SelectItem value="donation">{tx("Donation", "অনুদান")}</SelectItem>
                <SelectItem value="lost">{tx("Lost", "হারানো")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>{tx("Sale amount", "বিক্রয় মূল্য")}</Label><Input type="number" min={0} value={f.sale_amount} onChange={(e) => setF({ ...f, sale_amount: Number(e.target.value) })} /></div>
          <div><Label>{tx("Book value", "হিসাবী মূল্য")}</Label><Input type="number" min={0} value={f.book_value} onChange={(e) => setF({ ...f, book_value: Number(e.target.value) })} /></div>
          <div className="col-span-2 text-sm">
            <span className="text-muted-foreground">{tx("Gain/Loss", "লাভ/ক্ষতি")}: </span>
            <span className={gain_loss >= 0 ? "text-emerald-600 font-medium" : "text-destructive font-medium"}>{gain_loss.toLocaleString()}</span>
          </div>
          <div className="col-span-2"><Label>{tx("Remarks", "মন্তব্য")}</Label><Textarea rows={2} value={f.remarks} onChange={(e) => setF({ ...f, remarks: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>{tx("Cancel", "বাতিল")}</Button>
          <Button onClick={save} disabled={saving}>{saving ? "…" : tx("Save & post", "সংরক্ষণ ও পোস্ট")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
