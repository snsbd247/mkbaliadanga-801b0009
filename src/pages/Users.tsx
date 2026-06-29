import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";
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
import { ShieldCheck, Plus, Trash2, KeyRound } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { DeleteButton } from "@/components/ui/action-icon-button";
import { z } from "zod";

// Stronger password policy. Super admins must use a longer, mixed password.
function passwordPolicyIssues(pw: string, role: string, t: (k: any) => string): string[] {
  const issues: string[] = [];
  const minLen = role === "super_admin" ? 12 : 10;
  if (pw.length < minLen) issues.push(t("pwAtLeastN").replace("{n}", String(minLen)));
  if (!/[a-z]/.test(pw)) issues.push(t("pwLowercase"));
  if (!/[A-Z]/.test(pw)) issues.push(t("pwUppercase"));
  if (!/[0-9]/.test(pw)) issues.push(t("pwDigit"));
  if (!/[^A-Za-z0-9]/.test(pw)) issues.push(t("pwSymbol"));
  return issues;
}

const createSchema = z.object({
  username: z.string().trim().regex(/^[a-zA-Z0-9_.-]{3,30}$/, "3–30 chars; letters, digits, . _ -"),
  email: z.string().trim().email().max(255),
  full_name: z.string().trim().min(1).max(120),
  password: z.string().min(10, "At least 10 characters").max(72),
  role: z.enum(["developer", "super_admin", "admin", "committee", "staff"]),
  office_id: z.string().nullable(),
});

export default function Users() {
  const { t } = useLang();
  const { user: me, isDeveloper } = useAuth();
  const [list, setList] = useState<any[]>([]);
  const [offices, setOffices] = useState<any[]>([]);
  const [permFor, setPermFor] = useState<any | null>(null);
  const [perms, setPerms] = useState<Record<string, any>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [resetFor, setResetFor] = useState<any | null>(null);
  const [resetPwd, setResetPwd] = useState("");
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    username: "", email: "", full_name: "", password: "",
    role: "staff" as "developer" | "super_admin" | "admin" | "committee" | "staff", office_id: "",
  });

  useEffect(() => { document.title = `${t("users")} — ${t("appName")}`; load(); }, [isDeveloper]);

  async function load() {
    const [p, r, o] = await Promise.all([
      db.from("profiles").select("*"),
      db.from("user_roles").select("*"),
      db.from("offices").select("id,name"),
    ]);
    setOffices(o.data ?? []);
    const ROLE_RANK: Record<string, number> = { developer: 5, super_admin: 4, admin: 3, committee: 2, staff: 1 };
    const rolesByUser: Record<string, string[]> = {};
    (r.data ?? []).forEach((x: any) => { (rolesByUser[x.user_id] ??= []).push(x.role); });
    Object.keys(rolesByUser).forEach((uid) => {
      rolesByUser[uid].sort((a, b) => (ROLE_RANK[b] ?? 0) - (ROLE_RANK[a] ?? 0));
    });
    const mapped = (p.data ?? []).map((x: any) => ({ ...x, roles: rolesByUser[x.id] ?? [] }));
    // Server-side RLS already hides developer profiles from non-developers; this filter
    // is a defense-in-depth no-op when RLS is healthy.
    const visible = mapped.filter((u: any) => isDeveloper || !u.roles.includes("developer"));
    const blocked = mapped.length - visible.length;
    setList(visible);
    // Audit who viewed/attempted to view developer accounts
    try {
      await supabase.rpc("log_developer_access", {
        _action: isDeveloper ? "view_developer_users" : "list_users",
        _blocked: blocked > 0 || !isDeveloper,
        _meta: { visible_count: visible.length, hidden_count: blocked } as any,
      });
    } catch { /* audit failure must not break UI */ }
  }

  async function callAdmin(payload: any) {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-users", { body: payload });
    setBusy(false);
    if (error || data?.error) {
      toast.error(data?.error ?? error?.message ?? t("failedGeneric"));
      return null;
    }
    return data;
  }

  async function createUser() {
    // developer & super_admin are global — no office assignment required
    const requiresOffice = !(form.role === "developer" || form.role === "super_admin");
    const office_id = requiresOffice ? (form.office_id || null) : null;
    const parsed = createSchema.safeParse({ ...form, office_id });
    if (!parsed.success) {
      const first = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
      return toast.error(first ?? t("validationFailed"));
    }
    if (requiresOffice && !office_id) return toast.error(t("office") + " required");
    const policy = passwordPolicyIssues(parsed.data.password, parsed.data.role, t);
    if (policy.length) return toast.error(`${t("pwPolicyPrefix")}: ${policy.join(", ")}`);
    const ok = await callAdmin({ action: "create", ...parsed.data });
    if (!ok) return;
    toast.success(t("userCreated"));
    setCreateOpen(false);
    setForm({ username: "", email: "", full_name: "", password: "", role: "staff", office_id: "" });
    load();
  }

  async function deleteUser(u: any) {
    if (u.id === me?.id) return toast.error(t("cannotDeleteSelf"));
    const ok = await callAdmin({ action: "delete", user_id: u.id });
    if (!ok) return;
    toast.success(t("userDeleted"));
    load();
  }

  async function resetPassword() {
    if (!resetFor) return;
    const role = (resetFor.roles?.[0] as string) ?? "staff";
    const policy = passwordPolicyIssues(resetPwd, role, t);
    if (policy.length) return toast.error(`${t("pwPolicyPrefix")}: ${policy.join(", ")}`);
    const ok = await callAdmin({ action: "reset_password", user_id: resetFor.id, password: resetPwd });
    if (!ok) return;
    toast.success(t("passwordUpdated"));
    setResetFor(null); setResetPwd("");
  }

  async function setRole(uid: string, role: "developer" | "super_admin" | "admin" | "committee" | "staff") {
    if (uid === me?.id) return toast.error(t("cannotChangeOwnRole" as any) || "You cannot change your own role");
    if ((role === "developer" || role === "super_admin") && !isDeveloper) {
      return toast.error("Only developers can assign this role");
    }
    await db.from("user_roles").delete().eq("user_id", uid);
    const { error } = await db.from("user_roles").insert({ user_id: uid, role });
    if (error) return toast.error(error.message);
    toast.success(t("saved")); load();
  }
  async function setOffice(uid: string, office_id: string) {
    const { error } = await db.from("profiles").update({ office_id: office_id || null }).eq("id", uid);
    if (error) return toast.error(error.message);
    load();
  }

  async function openPerms(u: any) {
    setPermFor(u);
    const role = (u.roles?.[0] as string) ?? "staff";
    const isGlobal = role === "developer" || role === "super_admin";
    const { data } = await db.from("user_permissions").select("*").eq("user_id", u.id);
    const map: Record<string, any> = {};
    (data ?? []).forEach((r: any) => { map[r.module] = r; });
    ALL_MODULES.forEach((m) => {
      if (isGlobal) {
        map[m] = { module: m, can_view: true, can_add: true, can_edit: true, can_delete: true };
      } else if (!map[m]) {
        map[m] = { module: m, can_view: true, can_add: false, can_edit: false, can_delete: false };
      }
    });
    setPerms(map);
  }
  async function savePerms() {
    if (!permFor) return;
    const rows = ALL_MODULES.map((m) => ({
      user_id: permFor.id, module: m,
      can_view: !!perms[m]?.can_view, can_add: !!perms[m]?.can_add,
      can_edit: !!perms[m]?.can_edit, can_delete: !!perms[m]?.can_delete,
    }));
    await db.from("user_permissions").delete().eq("user_id", permFor.id);
    const { error } = await db.from("user_permissions").insert(rows);
    if (error) return toast.error(error.message);
    toast.success(t("saved"));
    setPermFor(null);
  }
  function togglePerm(m: ModuleKey, k: string) {
    setPerms((p) => ({ ...p, [m]: { ...p[m], [k]: !p[m]?.[k] } }));
  }

  return (
    <>
      <PageHeader title={t("users")} description={t("onlySuperAdminUsers")} actions={
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" />{t("newUser")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("createUser")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>{t("fullName")}</Label><Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t("username")}</Label><Input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder={t("usernamePlaceholder")} /></div>
                <div><Label>{t("email")}</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              </div>
              <div>
                <Label>{t("password")}</Label>
                <Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder={form.role === "super_admin" ? t("pwPlaceholderSuper") : t("pwPlaceholderStaff")} />
                <p className="text-[11px] text-muted-foreground mt-1">
                  {form.role === "super_admin" ? t("pwSuperHint") : t("pwStaffHint")}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t("role")}</Label>
                  <Select value={form.role} onValueChange={v => setForm({ ...form, role: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {isDeveloper && <SelectItem value="developer">Developer</SelectItem>}
                      {isDeveloper && <SelectItem value="super_admin">{t("superAdmin")}</SelectItem>}
                      <SelectItem value="admin">{t("admin")}</SelectItem>
                      <SelectItem value="committee">{t("committee")}</SelectItem>
                      <SelectItem value="staff">{t("staff")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {!(form.role === "developer" || form.role === "super_admin") && (
                  <div><Label>{t("office")}</Label>
                    <Select value={form.office_id} onValueChange={v => setForm({ ...form, office_id: v })}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{offices.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>{t("cancel")}</Button>
              <Button onClick={createUser} disabled={busy}>{busy ? "…" : t("create")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      } />

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
                <TableCell className="font-mono text-xs">{u.username ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">{u.email}</TableCell>
                <TableCell>{u.full_name}</TableCell>
                {(() => {
                  const role = u.roles[0] ?? "staff";
                  const isGlobal = role === "developer" || role === "super_admin";
                  const lockRole = u.id === me?.id || role === "developer";
                  return (
                    <>
                      <TableCell>
                        <Select value={role} onValueChange={(v) => setRole(u.id, v as any)} disabled={lockRole}>
                          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {isDeveloper && <SelectItem value="developer">Developer</SelectItem>}
                            {isDeveloper && <SelectItem value="super_admin">{t("superAdmin")}</SelectItem>}
                            {!isDeveloper && role === "super_admin" && <SelectItem value="super_admin">{t("superAdmin")}</SelectItem>}
                            <SelectItem value="admin">{t("admin")}</SelectItem>
                            <SelectItem value="committee">{t("committee")}</SelectItem>
                            <SelectItem value="staff">{t("staff")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {isGlobal ? (
                          <span className="text-xs text-muted-foreground">All offices</span>
                        ) : (
                          <Select value={u.office_id ?? ""} onValueChange={(v) => setOffice(u.id, v)}>
                            <SelectTrigger className="w-[200px]"><SelectValue placeholder="—" /></SelectTrigger>
                            <SelectContent>{offices.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
                          </Select>
                        )}
                      </TableCell>
                    </>
                  );
                })()}
                <TableCell className="whitespace-nowrap text-xs">{fmtDate(u.created_at)}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="sm" variant="outline" onClick={() => openPerms(u)} title={t("permissions")}>
                    <ShieldCheck className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setResetFor(u); setResetPwd(""); }} title={t("resetPasswordTitle")}>
                    <KeyRound className="h-4 w-4" />
                  </Button>
                  <DeleteButton onConfirm={() => deleteUser(u)} disabled={u.id === me?.id} title={t("deleteTitle")} />
                </TableCell>
              </TableRow>
            ))}
            {list.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">{t("noData")}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      {/* Permissions dialog */}
      <Dialog open={!!permFor} onOpenChange={(o) => !o && setPermFor(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("permissions")} — {permFor?.full_name || permFor?.email}</DialogTitle>
          </DialogHeader>
          {(() => {
            const role = (permFor?.roles?.[0] as string) ?? "staff";
            const isGlobal = role === "developer" || role === "super_admin";
            return (
              <>
                {isGlobal && (
                  <p className="text-xs text-muted-foreground mb-2">
                    {role === "developer" ? "Developer" : t("superAdmin")} has full access to all modules across all offices. Permissions cannot be restricted.
                  </p>
                )}
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
                            <Checkbox checked={isGlobal ? true : !!perms[m]?.[k]} disabled={isGlobal} onCheckedChange={() => togglePerm(m, k)} />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPermFor(null)}>{t("cancel")}</Button>
            <Button onClick={savePerms}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password dialog */}
      <Dialog open={!!resetFor} onOpenChange={(o) => !o && setResetFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("resetPasswordTitle")} — {resetFor?.username || resetFor?.email}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>{t("newPassword")}</Label>
            <Input type="password" value={resetPwd} onChange={e => setResetPwd(e.target.value)} placeholder={resetFor?.roles?.includes("super_admin") ? t("pwPlaceholderSuper") : t("pwPlaceholderStaff")} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetFor(null)}>{t("cancel")}</Button>
            <Button onClick={resetPassword} disabled={busy}>{busy ? "…" : t("update")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
