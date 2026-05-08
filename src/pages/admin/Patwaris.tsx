import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus } from "lucide-react";
import { ViewButton, EditButton } from "@/components/ui/action-icon-button";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";

type Patwari = {
  id: string;
  name: string;
  name_bn: string | null;
  mobile: string | null;
  nid: string | null;
  address: string | null;
  mouza_id: string | null;
  office_id: string | null;
  is_active: boolean;
  note: string | null;
  mouzas?: { name: string; name_bn: string | null } | null;
};

const empty = {
  name: "", name_bn: "", mobile: "", nid: "", address: "",
  mouza_id: "", office_id: "", is_active: true, note: "",
};

export default function Patwaris() {
  const { user, isSuper } = useAuth();
  const [rows, setRows] = useState<Patwari[]>([]);
  const [mouzas, setMouzas] = useState<any[]>([]);
  const [offices, setOffices] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(empty);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => { document.title = "পাটুয়ারী — তালিকা"; load(); }, [showInactive]);

  async function load() {
    const [p, m, o] = await Promise.all([
      supabase.from("patwaris").select("*, mouzas(name,name_bn)").order("name"),
      supabase.from("mouzas").select("id,name,name_bn").eq("is_active", true).order("name"),
      supabase.from("offices").select("id,name").order("name"),
    ]);
    let list = (p.data ?? []) as Patwari[];
    if (!showInactive) list = list.filter((r) => r.is_active);
    setRows(list);
    setMouzas(m.data ?? []);
    setOffices(o.data ?? []);
  }

  function openNew() {
    setEditId(null);
    setForm({ ...empty, office_id: isSuper ? "" : (user as any)?.office_id ?? "" });
    setOpen(true);
  }

  function openEdit(r: Patwari) {
    setEditId(r.id);
    setForm({
      name: r.name, name_bn: r.name_bn ?? "", mobile: r.mobile ?? "",
      nid: r.nid ?? "", address: r.address ?? "",
      mouza_id: r.mouza_id ?? "", office_id: r.office_id ?? "",
      is_active: r.is_active, note: r.note ?? "",
    });
    setOpen(true);
  }

  async function save() {
    if (!form.name?.trim()) return toast.error("নাম দিন");
    const payload: any = {
      name: form.name.trim(),
      name_bn: form.name_bn?.trim() || null,
      mobile: form.mobile?.trim() || null,
      nid: form.nid?.trim() || null,
      address: form.address?.trim() || null,
      mouza_id: form.mouza_id || null,
      office_id: form.office_id || null,
      is_active: !!form.is_active,
      note: form.note?.trim() || null,
    };
    let error;
    if (editId) {
      ({ error } = await supabase.from("patwaris").update(payload).eq("id", editId));
    } else {
      payload.created_by = user?.id;
      ({ error } = await supabase.from("patwaris").insert(payload));
    }
    if (error) return toast.error(error.message);
    toast.success("সংরক্ষিত হয়েছে");
    setOpen(false); setEditId(null); load();
  }

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.name?.toLowerCase().includes(q) ||
      r.name_bn?.toLowerCase().includes(q) ||
      r.mobile?.toLowerCase().includes(q) ||
      r.mouzas?.name?.toLowerCase().includes(q)
    );
  });

  return (
    <>
      <PageHeader
        title="পাটুয়ারী ব্যবস্থাপনা"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" />নতুন পাটুয়ারী</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{editId ? "পাটুয়ারী এডিট" : "নতুন পাটুয়ারী"}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>নাম (English) *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>নাম (বাংলা)</Label><Input value={form.name_bn} onChange={(e) => setForm({ ...form, name_bn: e.target.value })} /></div>
                <div><Label>মোবাইল</Label><Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></div>
                <div><Label>NID</Label><Input value={form.nid} onChange={(e) => setForm({ ...form, nid: e.target.value })} /></div>
                <div className="col-span-2"><Label>ঠিকানা</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
                <div>
                  <Label>মৌজা (দায়িত্বরত)</Label>
                  <Select value={form.mouza_id || "none"} onValueChange={(v) => setForm({ ...form, mouza_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— কোনটি না —</SelectItem>
                      {mouzas.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name_bn || m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {isSuper && (
                  <div>
                    <Label>অফিস</Label>
                    <Select value={form.office_id || "none"} onValueChange={(v) => setForm({ ...form, office_id: v === "none" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— কোনটি না —</SelectItem>
                        {offices.map((o) => (
                          <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="col-span-2 flex items-center gap-2">
                  <Switch checked={!!form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                  <Label>সক্রিয়</Label>
                </div>
                <div className="col-span-2"><Label>নোট</Label><Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>বাতিল</Button>
                <Button onClick={save}>সংরক্ষণ</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="p-3 mb-3 flex flex-wrap items-center gap-3">
        <Input className="max-w-xs" placeholder="নাম, মোবাইল, মৌজা খুঁজুন…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Label className="text-sm flex items-center gap-2 cursor-pointer">
          <Switch checked={showInactive} onCheckedChange={setShowInactive} />
          নিষ্ক্রিয় দেখান
        </Label>
        <span className="text-xs text-muted-foreground ml-auto">মোট: {filtered.length}</span>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>নাম</TableHead>
              <TableHead>মোবাইল</TableHead>
              <TableHead>মৌজা</TableHead>
              <TableHead>স্ট্যাটাস</TableHead>
              <TableHead className="text-right">অ্যাকশন</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name_bn || r.name}</TableCell>
                <TableCell>{r.mobile ?? "—"}</TableCell>
                <TableCell>{r.mouzas?.name_bn || r.mouzas?.name || "—"}</TableCell>
                <TableCell>
                  {r.is_active ? <Badge variant="default">সক্রিয়</Badge> : <Badge variant="secondary">নিষ্ক্রিয়</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <Link to={`/admin/patwaris/${r.id}`}>
                    <Button size="icon" variant="ghost" title="প্রোফাইল"><Eye className="h-4 w-4" /></Button>
                  </Link>
                  <Button size="icon" variant="ghost" onClick={() => openEdit(r)} title="এডিট">✎</Button>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">কোন পাটুয়ারী নেই</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
