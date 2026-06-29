// i18n-ignore-file — admin-only page (English UI)
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { db } from "@/lib/db";
import { useAuth } from "@/auth/AuthProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Search, ShieldCheck, Loader2 } from "lucide-react";

type AppRole = "developer" | "super_admin" | "admin" | "committee" | "staff";
const ASSIGNABLE: AppRole[] = ["super_admin", "admin", "committee", "staff"];
const ROLE_RANK: Record<string, number> = { developer: 5, super_admin: 4, admin: 3, committee: 2, staff: 1 };

type Row = {
  id: string;
  username: string | null;
  full_name: string | null;
  email: string | null;
  office_id: string | null;
  roles: string[];
};

const GLOBAL = "__global__";

export default function UserRoles() {
  const { isSuper, isDeveloper, rolesLoaded, user: me } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [offices, setOffices] = useState<{ id: string; name: string }[]>([]);
  const [officeFilter, setOfficeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (isSuper) load(); }, [isSuper]);

  async function load() {
    setLoading(true);
    const [p, r, o] = await Promise.all([
      db.from("profiles").select("id,username,full_name,email,office_id"),
      db.from("user_roles").select("user_id,role"),
      db.from("offices").select("id,name"),
    ]);
    setOffices(o.data ?? []);
    const byUser: Record<string, string[]> = {};
    (r.data ?? []).forEach((x: any) => { (byUser[x.user_id] ??= []).push(x.role); });
    Object.values(byUser).forEach((rs) => rs.sort((a, b) => (ROLE_RANK[b] ?? 0) - (ROLE_RANK[a] ?? 0)));
    const mapped: Row[] = (p.data ?? []).map((x: any) => ({ ...x, roles: byUser[x.id] ?? [] }));
    setRows(mapped.filter((u) => isDeveloper || !u.roles.includes("developer")));
    setLoading(false);
  }

  async function setRole(uid: string, role: AppRole) {
    if (uid === me?.id) return toast.error("You cannot change your own role");
    if ((role === "developer" || role === "super_admin") && !isDeveloper) {
      return toast.error("Only developers can assign this role");
    }
    await db.from("user_roles").delete().eq("user_id", uid);
    const { error } = await db.from("user_roles").insert({ user_id: uid, role });
    if (error) return toast.error(error.message);
    toast.success("Role updated");
    load();
  }

  const officeName = (id: string | null) =>
    id ? (offices.find((o) => o.id === id)?.name ?? "—") : "All offices";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((u) => {
      const role = u.roles[0] ?? "staff";
      const isGlobal = role === "developer" || role === "super_admin";
      if (officeFilter === GLOBAL && !isGlobal) return false;
      if (officeFilter !== "all" && officeFilter !== GLOBAL && u.office_id !== officeFilter) return false;
      if (!q) return true;
      return [u.username, u.full_name, u.email].some((v) => (v ?? "").toLowerCase().includes(q));
    });
  }, [rows, officeFilter, search]);

  if (!rolesLoaded) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!isSuper) return <Navigate to="/admin" replace />;

  return (
    <>
      <PageHeader
        title="User Roles by Office"
        description="View and manage which role each user holds, grouped by office. Edit fine-grained permissions in the Role Matrix."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/role-matrix"><ShieldCheck className="h-4 w-4 mr-1" /> Role Matrix</Link>
          </Button>
        }
      />

      <Card className="p-3 mb-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search user…"
            className="pl-8 w-64"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={officeFilter} onValueChange={setOfficeFilter}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All offices</SelectItem>
            <SelectItem value={GLOBAL}>Global (dev / super admin)</SelectItem>
            {offices.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} user(s)</span>
      </Card>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Office</TableHead>
              <TableHead>Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={4} className="text-center py-6">
                <Loader2 className="h-4 w-4 animate-spin inline" />
              </TableCell></TableRow>
            )}
            {!loading && filtered.map((u) => {
              const role = (u.roles[0] ?? "staff") as AppRole;
              const isGlobal = role === "developer" || role === "super_admin";
              const lock = u.id === me?.id || role === "developer";
              return (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="font-medium">{u.full_name ?? "—"}</div>
                    <div className="font-mono text-xs text-muted-foreground">{u.username ?? "—"}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{u.email ?? "—"}</TableCell>
                  <TableCell className="text-sm">
                    {isGlobal ? <span className="text-muted-foreground">All offices</span> : officeName(u.office_id)}
                  </TableCell>
                  <TableCell>
                    <Select value={role} onValueChange={(v) => setRole(u.id, v as AppRole)} disabled={lock}>
                      <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {isDeveloper && <SelectItem value="developer">Developer</SelectItem>}
                        {(isDeveloper || role === "super_admin") && <SelectItem value="super_admin">Super Admin</SelectItem>}
                        {ASSIGNABLE.filter((r) => r !== "super_admin").map((r) => (
                          <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              );
            })}
            {!loading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No users</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
