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
import { Switch } from "@/components/ui/switch";
import { useLang } from "@/i18n/LanguageProvider";
import { fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { ALL_MODULES, type ModuleKey } from "@/lib/permissions";
import { ShieldCheck, Plus, Trash2, KeyRound, Pencil } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { DeleteButton } from "@/components/ui/action-icon-button";
import { z } from "zod";
import { isLaravelBackend } from "@/lib/backend";

// Minimal password policy — length only. Simple numeric passwords (e.g. 123456789) are allowed.
function passwordPolicyIssues(pw: string, _role: string, t: (k: any) => string): string[] {
  const issues: string[] = [];
  if (pw.length < 8) issues.push(t("pwAtLeastN").replace("{n}", "8"));
  return issues;
}

const createSchema = z.object({
  username: z.string().trim().regex(/^[a-zA-Z0-9_.-]{3,30}$/, "3–30 chars; letters, digits, . _ -"),
  email: z.string().trim().email().max(255),
  full_name: z.string().trim().min(1).max(120),
  password: z.string().min(8, "At least 8 characters").max(72),
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
  const [editFor, setEditFor] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ username: "", email: "", full_name: "", office_id: "" });
  const [resetPwd2, setResetPwd2] = useState("");
  const [busy, setBusy] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [officeFilter, setOfficeFilter] = useState("all");

  const [form, setForm] = useState({
    username: "", email: "", full_name: "", password: "",
    role: "staff" as "developer" | "super_admin" | "admin" | "committee" | "staff", office_id: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => { document.title = `${t("users")} — ${t("appName")}`; load(); }, [isDeveloper]);

  async function load() {
    if (isLaravelBackend) {
      const [usersResponse, officesResponse] = await Promise.all([
        invokeAdmin({ action: "list" }, false),
        db.from("offices").select("id,name"),
      ]);
      setOffices(officesResponse.data ?? []);
      if (usersResponse?.users) {
        const users = usersResponse.users as any[];
        setList(isDeveloper ? users : users.filter((u) => !(u.roles ?? []).includes("developer")));
        return;
      }
    }

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
      await db.rpc("log_developer_access", {
        _action: isDeveloper ? "view_developer_users" : "list_users",
        _blocked: blocked > 0 || !isDeveloper,
        _meta: { visible_count: visible.length, hidden_count: blocked } as any,
      });
    } catch { /* audit failure must not break UI */ }
  }

  async function invokeAdmin(payload: any, showToast = true) {
    const { data, error } = await db.functions.invoke("admin-users", { body: payload });
    if (error || data?.error) {
      const raw = String(data?.error ?? error?.message ?? "");
      // Detect a temporarily-unavailable / not-deployed edge function and give retry guidance.
      const unavailable = /not available on this server|Failed to (send|fetch)|Function not found|failed to reach|network|503|504/i.test(raw);
      if (!showToast) return null;
      if (unavailable) {
        toast.error(t("adminFnUnavailable"), {
          description: t("adminFnRetryHint"),
          action: { label: t("retry"), onClick: () => callAdmin(payload) },
        });
      } else {
        toast.error(raw || t("failedGeneric"));
      }
      return null;
    }
    return data;
  }

  async function callAdmin(payload: any) {
    setBusy(true);
    const data = await invokeAdmin(payload, true);
    setBusy(false);
    return data;
  }

  async function createUser() {
    // developer & super_admin are global — no office assignment required
    const requiresOffice = !(form.role === "developer" || form.role === "super_admin");
    const office_id = requiresOffice ? (form.office_id || null) : null;
    const parsed = createSchema.safeParse({ ...form, office_id });
    const fieldErrors: Record<string, string> = {};
    if (!parsed.success) {
      Object.entries(parsed.error.flatten().fieldErrors).forEach(([k, v]) => {
        if (v?.[0]) fieldErrors[k] = v[0];
      });
    }
    if (!form.role) fieldErrors.role = t("role") + " required";
    if (requiresOffice && !office_id) fieldErrors.office_id = t("office") + " required";
    if (parsed.success) {
      const policy = passwordPolicyIssues(parsed.data.password, parsed.data.role, t);
      if (policy.length) fieldErrors.password = policy.join(", ");
    }
    if (Object.keys(fieldErrors).length) {
      setErrors(fieldErrors);
      return toast.error(t("validationFailed"));
    }
    setErrors({});
    const ok = await callAdmin({ action: "create", ...parsed.data! });
    if (!ok) return;
    toast.success(t("userCreated"));
    setCreateOpen(false);
    setForm({ username: "", email: "", full_name: "", password: "", role: "staff", office_id: "" });
    load();
  }

  async function setActive(u: any, is_active: boolean) {
    if (u.id === me?.id) return toast.error("You cannot change your own status");
    const ok = await callAdmin({ action: "set_active", user_id: u.id, is_active });
    if (!ok) return;
    toast.success(t("saved"));
    load();
  }


  async function deleteUser(u: any) {
    if (u.id === me?.id) return toast.error(t("cannotDeleteSelf"));
    const ok = await callAdmin({ action: "delete", user_id: u.id });
    if (!ok) return;
    toast.success(t("userDeleted"));
    load();
  }

  async function logAudit(action: string, target: string, meta: Record<string, unknown>) {
    try {
      await db.rpc("log_developer_access", {
        _action: action,
        _blocked: false,
        _meta: { target_user: target, ...meta } as any,
      });
    } catch { /* audit failure must not break UI */ }
  }

  async function resetPassword() {
    if (!resetFor) return;
    const role = (resetFor.roles?.[0] as string) ?? "staff";
    const policy = passwordPolicyIssues(resetPwd, role, t);
    if (policy.length) return toast.error(`${t("pwPolicyPrefix")}: ${policy.join(", ")}`);
    if (resetPwd !== resetPwd2) return toast.error(t("passwordsDoNotMatch" as any) || "Passwords do not match");
    const ok = await callAdmin({ action: "reset_password", user_id: resetFor.id, password: resetPwd });
    if (!ok) return;
    await logAudit("reset_password", resetFor.id, {});
    toast.success(t("passwordUpdated"));
    setResetFor(null); setResetPwd(""); setResetPwd2("");
  }

  async function saveEdit() {
    if (!editFor) return;
    if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(editForm.username)) return toast.error(t("validationFailed"));
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(editForm.email)) return toast.error(t("validationFailed"));
    const role = (editFor.roles?.[0] as string) ?? "staff";
    const isGlobal = role === "developer" || role === "super_admin";
    const office_id = isGlobal ? null : (editForm.office_id || null);
    const ok = await callAdmin({
      action: "update_profile",
      user_id: editFor.id,
      username: editForm.username,
      email: editForm.email,
      full_name: editForm.full_name,
      office_id,
    });
    if (!ok) return;
    await logAudit("update_profile", editFor.id, { username: editForm.username, email: editForm.email });
    toast.success(t("saved"));
    setEditFor(null);
    load();
  }

  async function setRole(uid: string, role: "developer" | "super_admin" | "admin" | "committee" | "staff") {
    if (uid === me?.id) return toast.error(t("cannotChangeOwnRole" as any) || "You cannot change your own role");
    const target = list.find((u) => u.id === uid);
    const currentRole = (target?.roles?.[0] as string) ?? "staff";
    if ((role === "developer" || role === "super_admin") && !isDeveloper) {
      return toast.error("Only developers can assign this role");
    }
    // Guard: changing a Super Admin away from super_admin is developer-only.
    if (currentRole === "super_admin" && role !== "super_admin" && !isDeveloper) {
      return toast.error("Only developers can change a Super Admin's role");
    }
    if (isLaravelBackend) {
      const ok = await callAdmin({ action: "set_role", user_id: uid, role });
      if (!ok) return;
      await logAudit("update_role", uid, { from: currentRole, to: role });
      toast.success(t("saved")); load();
      return;
    }
    await db.from("user_roles").delete().eq("user_id", uid);
    const { error } = await db.from("user_roles").insert({ user_id: uid, role });
    if (error) return toast.error(error.message);
    await logAudit("update_role", uid, { from: currentRole, to: role });
    toast.success(t("saved")); load();
  }
  async function setOffice(uid: string, office_id: string) {
    const { error } = await db.from("profiles").update({ office_id: office_id || null }).eq("id", uid);
    if (error) return toast.error(error.message);
    await logAudit("update_office", uid, { office_id: office_id || null });
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
    await logAudit("update_permissions", permFor.id, {});
    toast.success(t("saved"));
    setPermFor(null);
  }
  function togglePerm(m: ModuleKey, k: string) {
    setPerms((p) => ({ ...p, [m]: { ...p[m], [k]: !p[m]?.[k] } }));
  }

  const officeName = (id: string | null) => offices.find((o) => o.id === id)?.name ?? "";
  const filtered = list.filter((u) => {
    const q = search.trim().toLowerCase();
    if (q) {
      const hay = `${u.username ?? ""} ${u.email ?? ""} ${u.full_name ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (roleFilter !== "all" && !(u.roles ?? []).includes(roleFilter)) return false;
    if (officeFilter !== "all") {
      if (officeFilter === "none" && u.office_id) return false;
      if (officeFilter !== "none" && u.office_id !== officeFilter) return false;
    }
    return true;
  });


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
              <div>
                <Label>{t("fullName")}</Label>
                <Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
                {errors.full_name && <p className="text-[11px] text-destructive mt-1">{errors.full_name}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t("username")}</Label>
                  <Input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder={t("usernamePlaceholder")} />
                  {errors.username && <p className="text-[11px] text-destructive mt-1">{errors.username}</p>}
                </div>
                <div>
                  <Label>{t("email")}</Label>
                  <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                  {errors.email && <p className="text-[11px] text-destructive mt-1">{errors.email}</p>}
                </div>
              </div>
              <div>
                <Label>{t("password")}</Label>
                <Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder={form.role === "super_admin" ? t("pwPlaceholderSuper") : t("pwPlaceholderStaff")} />
                {errors.password
                  ? <p className="text-[11px] text-destructive mt-1">{errors.password}</p>
                  : <p className="text-[11px] text-muted-foreground mt-1">{form.role === "super_admin" ? t("pwSuperHint") : t("pwStaffHint")}</p>}
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
                  {errors.role && <p className="text-[11px] text-destructive mt-1">{errors.role}</p>}
                </div>
                {!(form.role === "developer" || form.role === "super_admin") && (
                  <div><Label>{t("office")}</Label>
                    <Select value={form.office_id} onValueChange={v => setForm({ ...form, office_id: v })}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{offices.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
                    </Select>
                    {errors.office_id && <p className="text-[11px] text-destructive mt-1">{errors.office_id}</p>}
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

      <Card className="p-3 mb-3">
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[200px]">
            <Label className="text-xs">{t("search" as any) || "Search"}</Label>
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={`${t("username")} / ${t("email")} / ${t("fullName")}`} />
          </div>
          <div>
            <Label className="text-xs">{t("role")}</Label>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("all" as any) || "All"}</SelectItem>
                {isDeveloper && <SelectItem value="developer">Developer</SelectItem>}
                <SelectItem value="super_admin">{t("superAdmin")}</SelectItem>
                <SelectItem value="admin">{t("admin")}</SelectItem>
                <SelectItem value="committee">{t("committee")}</SelectItem>
                <SelectItem value="staff">{t("staff")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{t("office")}</Label>
            <Select value={officeFilter} onValueChange={setOfficeFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("all" as any) || "All"}</SelectItem>
                <SelectItem value="none">—</SelectItem>
                {offices.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card>
        <Table>

          <TableHeader><TableRow>
            <TableHead>{t("username")}</TableHead>
            <TableHead>{t("email")}</TableHead>
            <TableHead>{t("fullName")}</TableHead>
            <TableHead>{t("role")}</TableHead>
            <TableHead>{t("office")}</TableHead>
            <TableHead>{t("status" as any) || "Status"}</TableHead>
            <TableHead>{t("date")}</TableHead>
            <TableHead className="text-right">{t("actions")}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.map(u => (
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
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={u.is_active !== false}
                      disabled={u.id === me?.id || (u.roles.includes("developer") && !isDeveloper)}
                      onCheckedChange={(v) => setActive(u, v)}
                    />
                    <span className="text-xs text-muted-foreground">
                      {u.is_active !== false ? (t("active" as any) || "Active") : (t("inactive" as any) || "Inactive")}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs">{fmtDate(u.created_at)}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="sm" variant="outline" onClick={() => openPerms(u)} title={t("permissions")}>
                    <ShieldCheck className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setEditFor(u); setEditForm({ username: u.username ?? "", email: u.email ?? "", full_name: u.full_name ?? "", office_id: u.office_id ?? "" }); }} title={t("edit")}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setResetFor(u); setResetPwd(""); setResetPwd2(""); }} title={t("resetPasswordTitle")}>
                    <KeyRound className="h-4 w-4" />
                  </Button>
                  <DeleteButton onConfirm={() => deleteUser(u)} disabled={u.id === me?.id} title={t("deleteTitle")} />
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">{t("noData")}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      {/* Edit user dialog */}
      <Dialog open={!!editFor} onOpenChange={(o) => !o && setEditFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("edit")} — {editFor?.full_name || editFor?.email}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t("fullName")}</Label>
              <Input value={editForm.full_name} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} /></div>
            <div><Label>{t("username")}</Label>
              <Input value={editForm.username} onChange={e => setEditForm({ ...editForm, username: e.target.value })} /></div>
            <div><Label>{t("email")}</Label>
              <Input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} /></div>
            {(() => {
              const role = (editFor?.roles?.[0] as string) ?? "staff";
              const isGlobal = role === "developer" || role === "super_admin";
              if (isGlobal) return <p className="text-xs text-muted-foreground">All offices</p>;
              return (
                <div><Label>{t("office")}</Label>
                  <Select value={editForm.office_id} onValueChange={v => setEditForm({ ...editForm, office_id: v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{offices.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              );
            })()}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditFor(null)}>{t("cancel")}</Button>
            <Button onClick={saveEdit} disabled={busy}>{busy ? "…" : t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <div>
              <Label>{t("newPassword")}</Label>
              <Input type="password" value={resetPwd} onChange={e => setResetPwd(e.target.value)} placeholder={resetFor?.roles?.includes("super_admin") ? t("pwPlaceholderSuper") : t("pwPlaceholderStaff")} />
            </div>
            <div>
              <Label>{t("confirmPassword" as any) || "Confirm password"}</Label>
              <Input type="password" value={resetPwd2} onChange={e => setResetPwd2(e.target.value)} />
              {resetPwd2 && resetPwd !== resetPwd2 && (
                <p className="text-[11px] text-destructive mt-1">{t("passwordsDoNotMatch" as any) || "Passwords do not match"}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setResetFor(null)}>{t("cancel")}</Button>
            <Button onClick={resetPassword} disabled={busy || !resetPwd || resetPwd !== resetPwd2}>{busy ? "…" : t("update")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
