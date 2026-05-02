import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useLang } from "@/i18n/LanguageProvider";
import { fmtDate } from "@/lib/format";
import { toast } from "sonner";

export default function Users() {
  const { t } = useLang();
  const [list, setList] = useState<any[]>([]);
  const [offices, setOffices] = useState<any[]>([]);

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

  return (
    <>
      <PageHeader title={t("users")} />
      <Card><Table>
        <TableHeader><TableRow><TableHead>{t("email")}</TableHead><TableHead>{t("fullName")}</TableHead><TableHead>{t("role")}</TableHead><TableHead>{t("office")}</TableHead><TableHead>{t("date")}</TableHead></TableRow></TableHeader>
        <TableBody>
          {list.map(u => (
            <TableRow key={u.id}>
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
            </TableRow>
          ))}
          {list.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">{t("noData")}</TableCell></TableRow>}
        </TableBody>
      </Table></Card>
    </>
  );
}
