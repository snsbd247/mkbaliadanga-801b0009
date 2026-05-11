// i18n-ignore-file — admin-only page (English UI)
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/auth/AuthProvider";
import { Navigate } from "react-router-dom";
import { ALL_MODULES } from "@/lib/permissions";
import { toast } from "sonner";
import { Save, Loader2, Copy, Search } from "lucide-react";

type Role = "super_admin" | "admin" | "committee" | "staff";
const ROLES: Role[] = ["super_admin", "admin", "committee", "staff"];
const ACTIONS = ["can_view", "can_add", "can_edit", "can_delete"] as const;
type Action = typeof ACTIONS[number];

const ACTION_LABEL: Record<string, { en: string; bn: string }> = {
  can_view: { en: "View", bn: "দেখা" },
  can_add: { en: "Add", bn: "যোগ" },
  can_edit: { en: "Edit", bn: "সম্পাদনা" },
  can_delete: { en: "Delete", bn: "মুছুন" },
};

const MODULE_LABEL_BN: Record<string, string> = {
  dashboard: "ড্যাশবোর্ড", offices: "অফিস", farmers: "কৃষক", seasons: "মৌসুম",
  savings: "সঞ্চয়", loans: "ঋণ", irrigation: "সেচ", payments: "পেমেন্ট",
  reports: "রিপোর্ট", users: "ব্যবহারকারী", audit: "অডিট", settings: "সেটিংস",
  accounting: "হিসাব", cashbook: "ক্যাশবুক", approvals: "অনুমোদন", sms: "এসএমএস",
  locations: "এলাকা",
};

type Perm = { can_view: boolean; can_add: boolean; can_edit: boolean; can_delete: boolean };

export default function RoleMatrix() {
  const { isSuper, rolesLoaded, user } = useAuth();
  const [matrix, setMatrix] = useState<Record<string, Perm>>({});
  const [original, setOriginal] = useState<Record<string, Perm>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [cloneFrom, setCloneFrom] = useState<Role>("staff");
  const [cloneTo, setCloneTo] = useState<Role>("admin");

  useEffect(() => { if (isSuper) load(); }, [isSuper]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("role_permissions").select("*");
    const m: Record<string, Perm> = {};
    (data ?? []).forEach((r: any) => {
      m[`${r.role}:${r.module}`] = {
        can_view: r.can_view, can_add: r.can_add, can_edit: r.can_edit, can_delete: r.can_delete,
      };
    });
    ROLES.forEach((role) => ALL_MODULES.forEach((mod) => {
      const k = `${role}:${mod}`;
      if (!m[k]) m[k] = { can_view: false, can_add: false, can_edit: false, can_delete: false };
    }));
    setMatrix(m);
    setOriginal(JSON.parse(JSON.stringify(m)));
    setLoading(false);
  }

  function toggle(role: Role, module: string, action: Action) {
    if (role === "super_admin") return;
    const k = `${role}:${module}`;
    setMatrix((m) => ({ ...m, [k]: { ...m[k], [action]: !m[k][action] } }));
  }

  function setRowAll(mod: string, role: Role, value: boolean) {
    if (role === "super_admin") return;
    const k = `${role}:${mod}`;
    setMatrix((m) => ({
      ...m,
      [k]: { can_view: value, can_add: value, can_edit: value, can_delete: value },
    }));
  }

  function setColAll(role: Role, action: Action, value: boolean) {
    if (role === "super_admin") return;
    setMatrix((m) => {
      const next = { ...m };
      ALL_MODULES.forEach((mod) => {
        const k = `${role}:${mod}`;
        next[k] = { ...next[k], [action]: value };
      });
      return next;
    });
  }

  function doClone() {
    if (cloneFrom === cloneTo) return toast.error("Source and target roles must differ");
    if (cloneTo === "super_admin") return toast.error("Cannot overwrite super admin");
    setMatrix((m) => {
      const next = { ...m };
      ALL_MODULES.forEach((mod) => {
        next[`${cloneTo}:${mod}`] = { ...m[`${cloneFrom}:${mod}`] };
      });
      return next;
    });
    toast.success(`Cloned ${cloneFrom} → ${cloneTo} (unsaved)`);
  }

  function diffEntries() {
    const diffs: Array<{ role: Role; module: string; action: Action; old: boolean; nw: boolean }> = [];
    ROLES.forEach((role) => {
      if (role === "super_admin") return;
      ALL_MODULES.forEach((mod) => {
        const k = `${role}:${mod}`;
        ACTIONS.forEach((a) => {
          const o = original[k]?.[a] ?? false;
          const n = matrix[k]?.[a] ?? false;
          if (o !== n) diffs.push({ role, module: mod, action: a, old: o, nw: n });
        });
      });
    });
    return diffs;
  }

  async function save() {
    const diffs = diffEntries();
    setSaving(true);
    const rows = ROLES.filter((r) => r !== "super_admin").flatMap((role) =>
      ALL_MODULES.map((mod) => {
        const p = matrix[`${role}:${mod}`];
        return { role, module: mod, ...p, updated_at: new Date().toISOString() };
      })
    );
    const { error } = await supabase
      .from("role_permissions")
      .upsert(rows, { onConflict: "role,module" });

    if (!error && diffs.length) {
      const auditRows = diffs.map((d) => ({
        changed_by: user?.id ?? null,
        role: d.role,
        module: d.module,
        action: d.action,
        old_value: d.old,
        new_value: d.nw,
      }));
      // Fail-safe: don't block save on audit failure
      await supabase.from("permission_audit_logs").insert(auditRows);
    }

    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`Saved (${diffs.length} changes)`);
    setOriginal(JSON.parse(JSON.stringify(matrix)));
  }

  const filteredModules = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ALL_MODULES;
    return ALL_MODULES.filter((m) =>
      m.toLowerCase().includes(q) || (MODULE_LABEL_BN[m] ?? "").includes(q)
    );
  }, [search]);

  const dirtyCount = diffEntries().length;

  if (!rolesLoaded) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!isSuper) return <Navigate to="/admin" replace />;

  return (
    <>
      <PageHeader
        title="Role Permission Matrix / রোল পারমিশন ম্যাট্রিক্স"
        description="Manage default permissions for each role. Super Admin always has full access."
        actions={
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={saving || loading || dirtyCount === 0}>
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                Save {dirtyCount > 0 ? `(${dirtyCount})` : ""}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirm permission changes</AlertDialogTitle>
                <AlertDialogDescription>
                  {dirtyCount} permission change(s) will be applied and audit-logged. This affects all users in those roles.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={save}>Apply & Log</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        }
      />

      <Card className="p-3 mb-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search module / মডিউল খুঁজুন"
            className="pl-8 w-64"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-sm text-muted-foreground">Clone:</span>
          <Select value={cloneFrom} onValueChange={(v) => setCloneFrom(v as Role)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <span>→</span>
          <Select value={cloneTo} onValueChange={(v) => setCloneTo(v as Role)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ROLES.filter((r) => r !== "super_admin").map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={doClone}>
            <Copy className="h-4 w-4 mr-1" /> Clone
          </Button>
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-20">
            <TableRow>
              <TableHead className="sticky left-0 bg-background z-30">Module / মডিউল</TableHead>
              {ROLES.map((r) => (
                <TableHead key={r} colSpan={4} className="text-center border-l capitalize">
                  {r.replace("_", " ")}
                </TableHead>
              ))}
            </TableRow>
            <TableRow>
              <TableHead className="sticky left-0 bg-background z-30"></TableHead>
              {ROLES.map((r) =>
                ACTIONS.map((a) => (
                  <TableHead key={`${r}-${a}`} className="text-center text-[10px] uppercase">
                    <div>{ACTION_LABEL[a].en}</div>
                    <div className="text-[9px] text-muted-foreground">{ACTION_LABEL[a].bn}</div>
                    {r !== "super_admin" && (
                      <div className="flex justify-center gap-1 mt-1">
                        <button
                          className="text-[9px] text-primary hover:underline"
                          onClick={() => setColAll(r, a, true)}
                          title="Grant all"
                        >✓All</button>
                        <button
                          className="text-[9px] text-muted-foreground hover:underline"
                          onClick={() => setColAll(r, a, false)}
                          title="Revoke all"
                        >✕</button>
                      </div>
                    )}
                  </TableHead>
                ))
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredModules.map((mod) => (
              <TableRow key={mod}>
                <TableCell className="font-medium sticky left-0 bg-background z-10">
                  <div className="capitalize">{mod}</div>
                  <div className="text-xs text-muted-foreground">{MODULE_LABEL_BN[mod]}</div>
                </TableCell>
                {ROLES.map((role) =>
                  ACTIONS.map((a) => {
                    const k = `${role}:${mod}`;
                    const checked = role === "super_admin" ? true : !!matrix[k]?.[a];
                    const dirty = role !== "super_admin" && original[k]?.[a] !== matrix[k]?.[a];
                    return (
                      <TableCell
                        key={`${role}-${mod}-${a}`}
                        className={`text-center ${dirty ? "bg-amber-50 dark:bg-amber-950/30" : ""}`}
                      >
                        <Checkbox
                          checked={checked}
                          disabled={role === "super_admin"}
                          onCheckedChange={() => toggle(role, mod, a)}
                        />
                      </TableCell>
                    );
                  })
                )}
                <TableCell className="hidden">
                  {/* row bulk handled via column buttons */}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
        <span>Role defaults are applied unless a user has a per-user override (Users page).</span>
        <span>{dirtyCount > 0 ? `${dirtyCount} unsaved change(s)` : "All saved"}</span>
      </div>
    </>
  );
}
