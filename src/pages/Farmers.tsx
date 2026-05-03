import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Eye, Search, IdCard, Trash2, Pencil, AlertTriangle, Loader2 } from "lucide-react";
import { LocationPicker, LocationValue } from "@/components/locations/LocationPicker";
import { useLang } from "@/i18n/LanguageProvider";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { validateLocationChain, parseLocationDbError, type LocationLevel } from "@/lib/locationValidation";

const EMPTY_FORM = {
  name_en: "", name_bn: "", father_name: "", mother_name: "", nid: "", mobile: "",
  post_office: "", address: "", voter_number: "", is_voter: false,
  office_id: "", status: "active",
  division_id: null, district_id: null, upazila_id: null, union_id: null,
  ward_id: null, village_id: null, mouza_id: null,
};

type FormState = typeof EMPTY_FORM & Record<string, any>;

type FormErrors = {
  name_en?: string;
  mobile?: string;
  nid?: string;
  office_id?: string;
  location?: string;
};

const farmerFormSchema = z.object({
  name_en: z.string().trim().min(1, "English name required").max(100, "Name must be 100 characters or less"),
  name_bn: z.string().trim().max(100, "Name must be 100 characters or less").optional().or(z.literal("")),
  father_name: z.string().trim().max(100, "Father's name must be 100 characters or less").optional().or(z.literal("")),
  mother_name: z.string().trim().max(100, "Mother's name must be 100 characters or less").optional().or(z.literal("")),
  nid: z.string().trim().refine((v) => !v || /^\d{10,17}$/.test(v.replace(/\D/g, "")), "Invalid NID (10–17 digits)"),
  mobile: z.string().trim().refine((v) => !v || /^\+?\d[\d\s-]{6,20}$/.test(v), "Invalid mobile number"),
  post_office: z.string().trim().max(100, "Post office must be 100 characters or less").optional().or(z.literal("")),
  address: z.string().trim().max(250, "Address must be 250 characters or less").optional().or(z.literal("")),
  voter_number: z.string().trim().refine((v) => !v || /^\d{1,20}$/.test(v), "Voter number must be digits only").optional().or(z.literal("")),
  office_id: z.string().optional().or(z.literal("")),
});

function pickLocation(form: FormState): LocationValue {
  return {
    division_id: form.division_id, district_id: form.district_id,
    upazila_id: form.upazila_id, union_id: form.union_id,
    ward_id: form.ward_id, village_id: form.village_id, mouza_id: form.mouza_id,
  };
}

export default function Farmers() {
  const { t } = useLang();
  const { officeId, isSuper } = useAuth();
  const nav = useNavigate();
  const [list, setList] = useState<any[]>([]);
  const [offices, setOffices] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const PAGE = 15;

  // Create
  const [open, setOpen] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM, office_id: officeId ?? "" });
  const [createErr, setCreateErr] = useState<{ level: LocationLevel; key: string } | null>(null);
  const [createFieldErrors, setCreateFieldErrors] = useState<FormErrors>({});
  const createNameRef = useRef<HTMLInputElement>(null);

  // Edit
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<FormState | null>(null);
  const [editPhoto, setEditPhoto] = useState<File | null>(null);
  const [editErr, setEditErr] = useState<{ level: LocationLevel; key: string } | null>(null);
  const [editFieldErrors, setEditFieldErrors] = useState<FormErrors>({});
  const editNameRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { document.title = `${t("farmers")} — ${t("appName")}`; load(); supabase.from("offices").select("id,name").then(r => setOffices(r.data ?? [])); }, [q, page]);
  useEffect(() => { setForm((f) => ({ ...f, office_id: officeId ?? f.office_id })); }, [officeId]);

  // Scroll the failing dropdown into view when a hierarchy error appears.
  useEffect(() => {
    const lvl = createErr?.level ?? editErr?.level;
    if (!lvl) return;
    const el = document.querySelector(`[data-level="${lvl}"]`) as HTMLElement | null;
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [createErr, editErr]);

  async function load() {
    let qy = supabase.from("farmers").select("*, offices(name)").order("created_at", { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
    if (q) qy = qy.or(`name_en.ilike.%${q}%,name_bn.ilike.%${q}%,farmer_code.ilike.%${q}%,account_number.ilike.%${q}%,member_no.ilike.%${q}%,mobile.ilike.%${q}%,nid.ilike.%${q}%`);
    const { data } = await qy;
    setList(data ?? []);
  }

  function levelLabel(level: LocationLevel) {
    const map: Record<LocationLevel, string> = {
      division: t("division"), district: t("district"), upazila: t("upazila"),
      union: t("union"), ward: t("ward"), village: t("village"), mouza: t("mouza"),
    };
    return map[level];
  }

  function buildErrMessage(key: string, level: LocationLevel) {
    const tpl = t(key as any) || "";
    return tpl.replace("{level}", levelLabel(level));
  }

  async function uploadPhoto(file: File): Promise<string | undefined> {
    const ext = file.name.split(".").pop();
    const path = `farmers/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("farmer-photos").upload(path, file);
    if (error) { toast.error(error.message); return undefined; }
    return supabase.storage.from("farmer-photos").getPublicUrl(path).data.publicUrl;
  }

  function resetCreateForm() {
    setOpen(false);
    setPhoto(null);
    setCreateErr(null);
    setCreateFieldErrors({});
    setForm({ ...EMPTY_FORM, office_id: officeId ?? "" });
    setSaving(false);
  }

  function resetEditForm() {
    setEditOpen(false);
    setEditForm(null);
    setEditPhoto(null);
    setEditErr(null);
    setEditFieldErrors({});
    setSaving(false);
  }

  function commonValidate(f: FormState, setErrors: (errors: FormErrors) => void): boolean {
    const parsed = farmerFormSchema.safeParse({
      name_en: f.name_en,
      name_bn: f.name_bn ?? "",
      father_name: f.father_name ?? "",
      mother_name: f.mother_name ?? "",
      nid: f.nid ?? "",
      mobile: f.mobile ?? "",
      post_office: f.post_office ?? "",
      address: f.address ?? "",
      voter_number: f.voter_number ?? "",
      office_id: f.office_id ?? "",
    });

    const nextErrors: FormErrors = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FormErrors | undefined;
        if (key && !nextErrors[key]) nextErrors[key] = issue.message;
      }
    }

    const loc = pickLocation(f);
    if (!loc.division_id || !loc.district_id || !loc.upazila_id || !loc.union_id || !loc.ward_id || !loc.village_id || !loc.mouza_id) {
      nextErrors.location = "Please complete all location dropdowns.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      const firstError = Object.values(nextErrors)[0];
      if (firstError) toast.error(firstError);
      return false;
    }
    return true;
  }

  async function save() {
    setCreateErr(null);
    setCreateFieldErrors({});
    if (!commonValidate(form, setCreateFieldErrors)) return;
    const v = validateLocationChain(pickLocation(form));
    if (v.ok === false) {
      setCreateErr({ level: v.level, key: "locationInvalidMissingParent" });
      setCreateFieldErrors((prev) => ({ ...prev, location: buildErrMessage("locationInvalidMissingParent", v.level) }));
      return;
    }

    setSaving(true);
    let photo_url: string | undefined;
    if (photo) {
      photo_url = await uploadPhoto(photo);
      if (!photo_url) { setSaving(false); return; }
    }
    const payload: any = { ...form, ...(photo_url ? { photo_url } : {}), office_id: form.office_id || null };
    const { data, error } = await supabase.from("farmers").insert(payload).select().single();
    if (error) {
      setSaving(false);
      const lvl = parseLocationDbError(error.message);
      if (lvl) {
        setCreateErr({ level: lvl, key: "locationInvalidMismatch" });
        setCreateFieldErrors((prev) => ({ ...prev, location: buildErrMessage("locationInvalidMismatch", lvl) }));
      } else toast.error(error.message);
      return;
    }
    if (data) await supabase.from("shares").insert({ farmer_id: data.id, balance: 0 });
    setSaving(false);
    toast.success("Farmer added");
    resetCreateForm();
    load();
  }

  function openEdit(row: any) {
    setEditErr(null); setEditPhoto(null);
    setEditForm({
      ...EMPTY_FORM,
      ...row,
      office_id: row.office_id ?? "",
    });
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editForm) return;
    setEditErr(null);
    setEditFieldErrors({});
    if (!commonValidate(editForm, setEditFieldErrors)) return;
    const v = validateLocationChain(pickLocation(editForm));
    if (v.ok === false) {
      setEditErr({ level: v.level, key: "locationInvalidMissingParent" });
      setEditFieldErrors((prev) => ({ ...prev, location: buildErrMessage("locationInvalidMissingParent", v.level) }));
      return;
    }

    setSaving(true);
    let photo_url: string | undefined;
    if (editPhoto) {
      photo_url = await uploadPhoto(editPhoto);
      if (!photo_url) { setSaving(false); return; }
    }
    const { id, farmer_code, created_at, updated_at, voter_number, offices: _o, ...rest } = editForm as any;
    const payload = { ...rest, ...(photo_url ? { photo_url } : {}), office_id: editForm.office_id || null };
    const { error } = await supabase.from("farmers").update(payload).eq("id", id);
    setSaving(false);
    if (error) {
      const lvl = parseLocationDbError(error.message);
      if (lvl) {
        setEditErr({ level: lvl, key: "locationInvalidMismatch" });
        setEditFieldErrors((prev) => ({ ...prev, location: buildErrMessage("locationInvalidMismatch", lvl) }));
      } else toast.error(error.message);
      return;
    }
    toast.success("Farmer updated");
    resetEditForm();
    load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("farmers").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  }

  // ---------- Reusable form fields ----------
  const renderFormFields = ({
    f, setF, photoFile, setPhotoFile, err, fieldErrors, disabled, nameInputRef,
  }: {
    f: FormState;
    setF: (next: FormState) => void;
    photoFile: File | null;
    setPhotoFile: (p: File | null) => void;
    err: { level: LocationLevel; key: string } | null;
    fieldErrors: FormErrors;
    disabled: boolean;
    nameInputRef?: RefObject<HTMLInputElement | null>;
  }) => {
    return (
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className={fieldErrors.name_en ? "text-destructive" : ""}>{t("nameEn")} *</Label>
          <Input
            ref={nameInputRef}
            value={f.name_en}
            disabled={disabled}
            maxLength={100}
            aria-invalid={!!fieldErrors.name_en || undefined}
            className={fieldErrors.name_en ? "border-destructive ring-2 ring-destructive/40 focus-visible:ring-destructive" : ""}
            onChange={e => setF({ ...f, name_en: e.target.value })}
          />
          {fieldErrors.name_en && <p className="mt-1 text-xs text-destructive">{fieldErrors.name_en}</p>}
        </div>
        <div><Label>{t("nameBn")}</Label><Input value={f.name_bn} disabled={disabled} maxLength={100} onChange={e => setF({ ...f, name_bn: e.target.value })} /></div>
        <div><Label>{t("fatherName")}</Label><Input value={f.father_name} disabled={disabled} maxLength={100} onChange={e => setF({ ...f, father_name: e.target.value })} /></div>
        <div><Label>{t("motherName")}</Label><Input value={f.mother_name} disabled={disabled} maxLength={100} onChange={e => setF({ ...f, mother_name: e.target.value })} /></div>
        <div>
          <Label className={fieldErrors.nid ? "text-destructive" : ""}>{t("nid")}</Label>
          <Input value={f.nid} disabled={disabled} inputMode="numeric" maxLength={17} onChange={e => setF({ ...f, nid: e.target.value })} className={fieldErrors.nid ? "border-destructive ring-2 ring-destructive/40 focus-visible:ring-destructive" : ""} />
          {fieldErrors.nid && <p className="mt-1 text-xs text-destructive">{fieldErrors.nid}</p>}
        </div>
        <div>
          <Label className={fieldErrors.mobile ? "text-destructive" : ""}>{t("mobile")}</Label>
          <Input value={f.mobile} disabled={disabled} inputMode="tel" maxLength={20} onChange={e => setF({ ...f, mobile: e.target.value })} className={fieldErrors.mobile ? "border-destructive ring-2 ring-destructive/40 focus-visible:ring-destructive" : ""} />
          {fieldErrors.mobile && <p className="mt-1 text-xs text-destructive">{fieldErrors.mobile}</p>}
        </div>
        <div><Label>{t("postOffice")}</Label><Input value={f.post_office} disabled={disabled} maxLength={100} onChange={e => setF({ ...f, post_office: e.target.value })} /></div>
        <div>
          <Label>Is Voter</Label>
          <div className="flex items-center gap-3 h-10">
            <Switch
              checked={!!f.is_voter}
              disabled={disabled}
              onCheckedChange={async (on) => {
                if (on) {
                  if (f.voter_number) {
                    setF({ ...f, is_voter: true });
                    return;
                  }
                  const { data, error } = await supabase.rpc("generate_farmer_voter_number");
                  if (error) { toast.error(error.message); return; }
                  setF({ ...f, is_voter: true, voter_number: String(data ?? "") });
                } else {
                  setF({ ...f, is_voter: false });
                }
              }}
              data-testid="voter-toggle"
            />
            {f.voter_number ? (
              <Input
                value={f.voter_number}
                disabled
                readOnly
                inputMode="numeric"
                maxLength={20}
                className="font-mono"
                aria-label="Voter number (read-only)"
              />
            ) : (
              <span className="text-xs text-muted-foreground">
                {f.is_voter ? "auto-generating…" : "No voter number assigned"}
              </span>
            )}
          </div>
          {f.voter_number && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-500">
              ⚠ Voter number is permanent and cannot be edited. It will be reused if Is Voter is re-enabled.
            </p>
          )}
        </div>
        <div>
          <Label>{t("office")}</Label>
          <Select value={f.office_id || undefined} onValueChange={v => setF({ ...f, office_id: v })} disabled={disabled}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{offices.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="col-span-2"><Label>{t("address")}</Label><Input value={f.address} disabled={disabled} maxLength={250} onChange={e => setF({ ...f, address: e.target.value })} /></div>

        <div className="col-span-2 border-t pt-3 mt-1">
          <div className="text-xs font-medium text-muted-foreground mb-2">
            Location (strict cascading: division → district → upazila → union → ward → village → mouza)
          </div>
          {(err || fieldErrors.location) && (
            <Alert variant="destructive" className="mb-3" role="alert" aria-live="assertive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{t("locationInvalidTitle")}</AlertTitle>
              <AlertDescription data-testid="location-error" data-level={err?.level}>
                {fieldErrors.location ?? (err ? <><span className="font-semibold">{levelLabel(err.level)}:</span>{" "}{buildErrMessage(err.key, err.level)}</> : null)}
              </AlertDescription>
            </Alert>
          )}
          <LocationPicker
            value={pickLocation(f)}
            onChange={(loc) => setF({ ...f, ...loc })}
            errorLevel={err?.level ?? null}
            errorMessage={fieldErrors.location ?? (err ? buildErrMessage(err.key, err.level) : null)}
            labels={{
              division: t("division"), district: t("district"), upazila: t("upazila"),
              union: t("union"), ward: t("ward"), village: t("village"), mouza: t("mouza"),
            }}
          />
        </div>
        <div className="col-span-2"><Label>{t("photo")}</Label><Input type="file" accept="image/*" disabled={disabled} onChange={e => setPhotoFile(e.target.files?.[0] ?? null)} />
          {photoFile && <div className="text-xs text-muted-foreground mt-1">{photoFile.name}</div>}
        </div>
      </div>
    );
  };

  return (
    <>
      <PageHeader title={t("farmers")} actions={
        <Dialog open={open} onOpenChange={(o) => { if (!o && !saving) resetCreateForm(); else setOpen(o); }}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />{t("addNew")}</Button></DialogTrigger>
          <DialogContent
            className="max-w-2xl max-h-[85vh] overflow-y-auto"
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              setTimeout(() => createNameRef.current?.focus(), 50);
            }}
          >
            <DialogHeader><DialogTitle>{t("addNew")} — {t("farmers")}</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); if (!saving) save(); }}>
              {renderFormFields({
                f: form,
                setF: (next) => { setForm(next); if (createErr) setCreateErr(null); if (Object.keys(createFieldErrors).length) setCreateFieldErrors({}); },
                photoFile: photo,
                setPhotoFile: setPhoto,
                err: createErr,
                fieldErrors: createFieldErrors,
                disabled: saving,
                nameInputRef: createNameRef,
              })}
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={resetCreateForm} disabled={saving}>{t("cancel")}</Button>
                <Button type="submit" disabled={saving}>{saving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />{t("save")}</> : t("save")}</Button>
              </DialogFooter>
            </form>
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
            <TableHead>Account No</TableHead><TableHead>{t("memberNo") || "Member No"}</TableHead><TableHead>{t("farmerName")}</TableHead>
            <TableHead>{t("mobile")}</TableHead><TableHead>{t("village")}</TableHead>
            <TableHead>{t("office")}</TableHead><TableHead>{t("status")}</TableHead>
            <TableHead className="text-right">{t("actions")}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {list.map(f => (
              <TableRow key={f.id} className="cursor-pointer" onClick={() => nav(`/farmers/${f.id}`)}>
                <TableCell className="font-mono text-xs">{f.account_number ?? f.farmer_code}</TableCell>
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
                    <Button size="icon" variant="ghost" title="Edit" onClick={() => openEdit(f)}><Pencil className="h-4 w-4" /></Button>
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
                            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => remove(f.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t("delete")}</AlertDialogAction>
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
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>{t("prev")}</Button>
            <Button size="sm" variant="outline" disabled={list.length < PAGE} onClick={() => setPage(p => p + 1)}>{t("next")}</Button>
          </div>
        </div>
      </Card>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={(o) => { if (!o && !saving) resetEditForm(); else setEditOpen(o); }}>
        <DialogContent
          className="max-w-2xl max-h-[85vh] overflow-y-auto"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            setTimeout(() => editNameRef.current?.focus(), 50);
          }}
        >
          <DialogHeader><DialogTitle>{t("edit")} — {t("farmers")}</DialogTitle></DialogHeader>
          {editForm && (
            <form onSubmit={(e) => { e.preventDefault(); if (!saving) saveEdit(); }}>
              {renderFormFields({
                f: editForm,
                setF: (next) => { setEditForm(next); if (editErr) setEditErr(null); if (Object.keys(editFieldErrors).length) setEditFieldErrors({}); },
                photoFile: editPhoto,
                setPhotoFile: setEditPhoto,
                err: editErr,
                fieldErrors: editFieldErrors,
                disabled: saving,
                nameInputRef: editNameRef,
              })}
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={resetEditForm} disabled={saving}>{t("cancel")}</Button>
                <Button type="submit" disabled={saving}>{saving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />{t("save")}</> : t("save")}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
