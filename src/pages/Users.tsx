import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useLang } from "@/i18n/LanguageProvider";
import { fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { ALL_MODULES, type ModuleKey } from "@/lib/permissions";
import { ShieldCheck } from "lucide-react";

export default function Users() {
  const { t } = useLang();
  const [list, setList] = useState<any[]>([]);
  const [offices, setOffices] = useState<any[]>([]);
  const [permFor, setPermFor] = useState<any | null>(null);
  const [perms, setPerms] = useState<Record<string, any>>({});

  useEffect(() => { document.title = `${t("users")} — ${t("appName")}`; load(); }, []);

  async function load() {
    const [p, r, o] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("user_roles").select("*"),
      supabase.from("offices").select("id,name"),
    ]);
    setOffices(o.data ?? []);
    const rolesByUser: Record<string, string[]> = {};
    (r.data ?? []).forEach((x: any) => { (rolesByUser[x.user_id] ??= []).push(x.role); });
    setList((p.data ?? []).map((x: any) => ({ ...x, roles: rolesByUser[x.id] ?? [] })));
  }

  async function setRole(uid: string, role: "super_admin" | "admin" | "staff") {
    await supabase.from("user_roles").delete().eq("user_id", uid);
    const { error } = await supabase.from("user_roles").insert({ user_id: uid, role });
    if (error) return toast.error(error.message);
    toast.success(t("saved")); load();
  }
  async function setOffice(uid: string, office_id: string) {
    const { error } = await supabase.from("profiles").update({ office_id: office_id || null }).eq("id", uid);
    if (error) return toast.error(error.message);
    load();
  }
  async function setUsername(uid: string, username: string) {
    const { error } = await supabase.from("profiles").update({ username: username || null }).eq("id", uid);
    if (error) return toast.error(error.message);
    toast.success(t("saved")); load();
  }

  async function openPerms(u: any) {
    setPermFor(u);
    const { data } = await supabase.from("user_permissions").select("*").eq("user_id", u.id);
    const map: Record<string, any> = {};
    (data ?? []).forEach((r: any) => { map[r.module] = r; });
    // initialize defaults
    ALL_MODULES.forEach((m) => {
      if (!map[m]) map[m] = { module: m, can_view: true, can_add: false, can_edit: false, can_delete: false };
    });
    setPerms(map);
  }
  async function savePerms() {
    if (!permFor) return;
    const rows = ALL_MODULES.map((m) => ({
      user_id: permFor.id,
      module: m,
      can_view: !!perms[m]?.can_view,
      can_add: !!perms[m]?.can_add,
      can_edit: !!perms[m]?.can_edit,
      can_delete: !!perms[m]?.can_delete,
    }));
    await supabase.from("user_permissions").delete().eq("user_id", permFor.id);
    const { error } = await supabase.from("user_permissions").insert(rows);
    if (error) return toast.error(error.message);
    toast.success(t("saved"));
    setPermFor(null);
  }
  function togglePerm(m: ModuleKey, k: string) {
    setPerms((p) => ({ ...p, [m]: { ...p[m], [k]: !p[m]?.[k] } }));
  }

  return (
    <>
      <PageHeader title={t("users")} />
      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t("username")}</TableHead>
            <TableHead>{t("email")}</TableHead>
            <TableHead>{t("fullName")}</TableHead>
            <TableHead>{t("role")}</TableHead>
            <TableHead>{t("office")}</TableHead>
            <TableHead>{t("date")}</TableHead>
            <TableHead className="text-right">{t("actions")}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {list.map(u => (
              <TableRow key={u.id}>
                <TableCell>
                  <Input
                    defaultValue={u.username ?? ""}
                    onBlur={(e) => { if (e.target.value !== (u.username ?? "")) setUsername(u.id, e.target.value); }}
                    className="h-8 w-32 font-mono text-xs"
                    placeholder="—"
                  />
                </TableCell>
                <TableCell className="font-mono text-xs">{u.email}</TableCell>
                <TableCell>{u.full_name}</TableCell>
                <TableCell>
                  <Select value={u.roles[0] ?? "staff"} onValueChange={(v) => setRole(u.id, v as any)}>
                    <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="super_admin">{t("superAdmin")}</SelectItem>
                      <SelectItem value="admin">{t("admin")}</SelectItem>
                      <SelectItem value="staff">{t("staff")}</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select value={u.office_id ?? ""} onValueChange={(v) => setOffice(u.id, v)}>
                    <SelectTrigger className="w-[200px]"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{offices.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
                  </Select>
                </TableCell>
                <TableCell>{fmtDate(u.created_at)}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => openPerms(u)}>
                    <ShieldCheck className="h-4 w-4 mr-1" />{t("permissions")}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {list.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">{t("noData")}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!permFor} onOpenChange={(o) => !o && setPermFor(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("permissions")} — {permFor?.full_name || permFor?.email}</DialogTitle>
          </DialogHeader>
          <Table>
            <TableHeader><TableRow>
              <TableHead>{t("module")}</TableHead>
              <TableHead className="text-center">{t("canView")}</TableHead>
              <TableHead className="text-center">{t("canAdd")}</TableHead>
              <TableHead className="text-center">{t("canEdit")}</TableHead>
              <TableHead className="text-center">{t("canDelete")}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {ALL_MODULES.map((m) => (
                <TableRow key={m}>
                  <TableCell className="font-medium capitalize">{m}</TableCell>
                  {(["can_view","can_add","can_edit","can_delete"] as const).map((k) => (
                    <TableCell key={k} className="text-center">
                      <Checkbox checked={!!perms[m]?.[k]} onCheckedChange={() => togglePerm(m, k)} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPermFor(null)}>{t("cancel")}</Button>
            <Button onClick={savePerms}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
