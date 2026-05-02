import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/auth/AuthProvider";
import { Navigate } from "react-router-dom";
import { ALL_MODULES } from "@/lib/permissions";
import { toast } from "sonner";
import { Save, Loader2 } from "lucide-react";

type Role = "super_admin" | "admin" | "committee" | "staff";
const ROLES: Role[] = ["super_admin", "admin", "committee", "staff"];
const ACTIONS = ["can_view", "can_add", "can_edit", "can_delete"] as const;
const ACTION_LABEL: Record<string, string> = { can_view: "View", can_add: "Add", can_edit: "Edit", can_delete: "Delete" };

type Perm = { can_view: boolean; can_add: boolean; can_edit: boolean; can_delete: boolean };

export default function RoleMatrix() {
  const { isSuper, rolesLoaded } = useAuth();
  const [matrix, setMatrix] = useState<Record<string, Perm>>({}); // key = `${role}:${module}`
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (isSuper) load(); }, [isSuper]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("role_permissions").select("*");
    const m: Record<string, Perm> = {};
    (data ?? []).forEach((r: any) => {
      m[`${r.role}:${r.module}`] = { can_view: r.can_view, can_add: r.can_add, can_edit: r.can_edit, can_delete: r.can_delete };
    });
    // ensure defaults present
    ROLES.forEach((role) => ALL_MODULES.forEach((mod) => {
      const k = `${role}:${mod}`;
      if (!m[k]) m[k] = { can_view: false, can_add: false, can_edit: false, can_delete: false };
    }));
    setMatrix(m);
    setLoading(false);
  }

  function toggle(role: Role, module: string, action: typeof ACTIONS[number]) {
    if (role === "super_admin") return; // locked
    const k = `${role}:${module}`;
    setMatrix((m) => ({ ...m, [k]: { ...m[k], [action]: !m[k][action] } }));
  }

  async function save() {
    setSaving(true);
    const rows = ROLES.flatMap((role) => ALL_MODULES.map((mod) => {
      const p = matrix[`${role}:${mod}`];
      return { role, module: mod, ...p, updated_at: new Date().toISOString() };
    }));
    const { error } = await supabase.from("role_permissions").upsert(rows, { onConflict: "role,module" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Role permissions saved");
  }

  if (!rolesLoaded) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!isSuper) return <Navigate to="/admin" replace />;

  return (
    <>
      <PageHeader
        title="Role Permission Matrix"
        description="Manage default permissions for each role. Super Admin always has full access."
        actions={
          <Button onClick={save} disabled={saving || loading}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Save
          </Button>
        }
      />

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-background z-10">Module</TableHead>
              {ROLES.map((r) => (
                <TableHead key={r} colSpan={4} className="text-center border-l capitalize">
                  {r.replace("_", " ")}
                </TableHead>
              ))}
            </TableRow>
            <TableRow>
              <TableHead className="sticky left-0 bg-background z-10"></TableHead>
              {ROLES.map((r) =>
                ACTIONS.map((a) => (
                  <TableHead key={`${r}-${a}`} className="text-center text-[10px] uppercase">{ACTION_LABEL[a]}</TableHead>
                ))
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {ALL_MODULES.map((mod) => (
              <TableRow key={mod}>
                <TableCell className="font-medium sticky left-0 bg-background z-10 capitalize">{mod}</TableCell>
                {ROLES.map((role) =>
                  ACTIONS.map((a) => {
                    const k = `${role}:${mod}`;
                    const checked = role === "super_admin" ? true : !!matrix[k]?.[a];
                    return (
                      <TableCell key={`${role}-${mod}-${a}`} className="text-center">
                        <Checkbox
                          checked={checked}
                          disabled={role === "super_admin"}
                          onCheckedChange={() => toggle(role, mod, a)}
                        />
                      </TableCell>
                    );
                  })
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <p className="text-xs text-muted-foreground mt-3">
        These role defaults are used when a user has no per-user permission override (set on the Users page).
      </p>
    </>
  );
}
