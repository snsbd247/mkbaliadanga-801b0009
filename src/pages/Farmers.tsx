import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Eye, Search, Upload, IdCard, Trash2 } from "lucide-react";
import { LocationPicker, LocationValue } from "@/components/locations/LocationPicker";
import { useLang } from "@/i18n/LanguageProvider";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";

export default function Farmers() {
  const { t } = useLang();
  const { officeId, isSuper } = useAuth();
  const nav = useNavigate();
  const [list, setList] = useState<any[]>([]);
  const [offices, setOffices] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const PAGE = 15;
  const [open, setOpen] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [form, setForm] = useState<any>({
    name_en: "", name_bn: "", father_name: "", mother_name: "", nid: "", mobile: "",
    village: "", post_office: "", upazila: "", district: "", division: "", address: "",
    office_id: officeId ?? "", status: "active",
    division_id: null, district_id: null, upazila_id: null, union_id: null, ward_id: null, mouza_id: null,
  });
  const location: LocationValue = {
    division_id: form.division_id, district_id: form.district_id,
    upazila_id: form.upazila_id, union_id: form.union_id,
    ward_id: form.ward_id, mouza_id: form.mouza_id,
  };

  useEffect(() => { document.title = `${t("farmers")} — ${t("appName")}`; load(); supabase.from("offices").select("id,name").then(r => setOffices(r.data ?? [])); }, [q, page]);
  useEffect(() => { setForm((f: any) => ({ ...f, office_id: officeId ?? f.office_id })); }, [officeId]);

  async function load() {
    let qy = supabase.from("farmers").select("*, offices(name)").order("created_at", { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
    if (q) qy = qy.or(`name_en.ilike.%${q}%,name_bn.ilike.%${q}%,farmer_code.ilike.%${q}%,member_no.ilike.%${q}%,mobile.ilike.%${q}%,nid.ilike.%${q}%`);
    const { data } = await qy;
    setList(data ?? []);
  }

  async function save() {
    if (!form.name_en?.trim()) return toast.error("English name required");
    if (form.mobile && !/^\+?\d[\d\s-]{6,20}$/.test(form.mobile)) return toast.error("Invalid mobile number");
    if (form.nid && !/^\d{10,17}$/.test(form.nid.replace(/\D/g, ""))) return toast.error("Invalid NID (10–17 digits)");
    let photo_url: string | undefined;
    if (photo) {
      const ext = photo.name.split(".").pop();
      const path = `farmers/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("farmer-photos").upload(path, photo);
      if (error) return toast.error(error.message);
      photo_url = supabase.storage.from("farmer-photos").getPublicUrl(path).data.publicUrl;
    }
    const payload = { ...form, ...(photo_url ? { photo_url } : {}), office_id: form.office_id || null };
    const { data, error } = await supabase.from("farmers").insert(payload).select().single();
    if (error) return toast.error(error.message);
    if (data) await supabase.from("shares").insert({ farmer_id: data.id, balance: 0 });
    toast.success("Farmer added");
    setOpen(false);
    setPhoto(null);
    setForm({
      name_en: "", name_bn: "", father_name: "", mother_name: "", nid: "", mobile: "",
      village: "", post_office: "", upazila: "", district: "", division: "", address: "",
      office_id: officeId ?? "", status: "active",
      division_id: null, district_id: null, upazila_id: null, union_id: null, ward_id: null, mouza_id: null,
    });
    load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("farmers").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  }

  return (
    <>
      <PageHeader title={t("farmers")} actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />{t("addNew")}</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{t("addNew")} — {t("farmers")}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("nameEn")} *</Label><Input value={form.name_en} onChange={e => setForm({ ...form, name_en: e.target.value })} /></div>
              <div><Label>{t("nameBn")}</Label><Input value={form.name_bn} onChange={e => setForm({ ...form, name_bn: e.target.value })} /></div>
              <div><Label>{t("fatherName")}</Label><Input value={form.father_name} onChange={e => setForm({ ...form, father_name: e.target.value })} /></div>
              <div><Label>{t("motherName")}</Label><Input value={form.mother_name} onChange={e => setForm({ ...form, mother_name: e.target.value })} /></div>
              <div><Label>{t("nid")}</Label><Input value={form.nid} onChange={e => setForm({ ...form, nid: e.target.value })} /></div>
              <div><Label>{t("mobile")}</Label><Input value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} /></div>
              <div><Label>{t("village")}</Label><Input value={form.village} onChange={e => setForm({ ...form, village: e.target.value })} /></div>
              <div><Label>{t("postOffice")}</Label><Input value={form.post_office} onChange={e => setForm({ ...form, post_office: e.target.value })} /></div>
              <div><Label>{t("upazila")}</Label><Input value={form.upazila} onChange={e => setForm({ ...form, upazila: e.target.value })} /></div>
              <div><Label>{t("district")}</Label><Input value={form.district} onChange={e => setForm({ ...form, district: e.target.value })} /></div>
              <div><Label>{t("division")}</Label><Input value={form.division} onChange={e => setForm({ ...form, division: e.target.value })} /></div>
              <div>
                <Label>{t("office")}</Label>
                <Select value={form.office_id} onValueChange={v => setForm({ ...form, office_id: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{offices.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2"><Label>{t("address")}</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
              <div className="col-span-2 border-t pt-3 mt-1">
                <div className="text-xs font-medium text-muted-foreground mb-2">Location (optional — links farmer to managed division/district/etc.)</div>
                <LocationPicker
                  value={location}
                  onChange={(loc) => setForm({ ...form, ...loc })}
                />
              </div>
              <div className="col-span-2"><Label>{t("photo")}</Label><Input type="file" accept="image/*" onChange={e => setPhoto(e.target.files?.[0] ?? null)} /></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button><Button onClick={save}>{t("save")}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      } />

      <Card className="p-4 mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t("search") + "…"} value={q} onChange={e => { setQ(e.target.value); setPage(0); }} className="pl-9" />
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t("farmerCode")}</TableHead><TableHead>{t("memberNo") || "Member No"}</TableHead><TableHead>{t("farmerName")}</TableHead>
            <TableHead>{t("mobile")}</TableHead><TableHead>{t("village")}</TableHead>
            <TableHead>{t("office")}</TableHead><TableHead>{t("status")}</TableHead>
            <TableHead className="text-right">{t("actions")}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {list.map(f => (
              <TableRow key={f.id} className="cursor-pointer" onClick={() => nav(`/farmers/${f.id}`)}>
                <TableCell className="font-mono text-xs">{f.farmer_code}</TableCell>
                <TableCell className="font-mono text-xs">{f.member_no || "—"}</TableCell>
                <TableCell>
                  <div className="font-medium">{f.name_en}</div>
                  {f.name_bn && <div className="text-xs text-muted-foreground">{f.name_bn}</div>}
                </TableCell>
                <TableCell>{f.mobile}</TableCell>
                <TableCell>{f.village}</TableCell>
                <TableCell className="text-xs">{f.offices?.name}</TableCell>
                <TableCell><Badge variant={f.status === "active" ? "default" : "secondary"}>{f.status}</Badge></TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    <Button size="icon" variant="ghost" title="View" onClick={() => nav(`/farmers/${f.id}`)}><Eye className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" title="Membership card" onClick={() => nav(`/farmers/${f.id}/card`)}><IdCard className="h-4 w-4" /></Button>
                    {isSuper && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" title="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete farmer?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This permanently deletes <span className="font-mono">{f.farmer_code}</span>. Linked records will be affected. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => remove(f.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {list.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">{t("noData")}</TableCell></TableRow>}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between p-3 border-t">
          <div className="text-xs text-muted-foreground">Page {page + 1}</div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</Button>
            <Button size="sm" variant="outline" disabled={list.length < PAGE} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      </Card>
    </>
  );
}
