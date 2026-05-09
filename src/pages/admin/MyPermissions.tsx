// i18n-ignore-file — admin-only page (English UI)
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/auth/AuthProvider";
import { ALL_MODULES, usePermissions } from "@/lib/permissions";
import { Check, X } from "lucide-react";
import { Link } from "react-router-dom";

const ACTIONS = [
  { key: "can_view", label: "View" },
  { key: "can_add", label: "Add" },
  { key: "can_edit", label: "Edit" },
  { key: "can_delete", label: "Delete" },
  { key: "can_view", label: "Print" }, // Print is gated by view access
] as const;

/**
 * Read-only self-test: shows the effective permissions for the currently
 * logged-in user across every module. Useful for QA-ing role wiring without
 * needing the full Role Matrix admin page.
 */
export default function MyPermissions() {
  const { user, roles, isSuper, isAdmin, rolesLoaded } = useAuth();
  const { can } = usePermissions();

  if (!rolesLoaded) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!user) return <div className="p-6 text-muted-foreground">Not logged in.</div>;

  return (
    <>
      <PageHeader
        title="My Permissions (Self-test)"
        description="Effective View / Add / Edit / Delete permissions for the currently logged-in user, derived from role + per-user overrides."
      />

      <Card className="p-4 mb-4 flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">Signed in as</span>
        <span className="font-medium">{user.email}</span>
        <span className="text-sm text-muted-foreground">Roles:</span>
        {isSuper && <Badge variant="default">super_admin</Badge>}
        {isAdmin && !isSuper && <Badge variant="secondary">admin</Badge>}
        {roles.map((r) => (
          <Badge key={r} variant="outline">{r}</Badge>
        ))}
        {isSuper && (
          <Link to="/admin/role-matrix" className="ml-auto text-sm text-primary underline">
            Edit Role Matrix →
          </Link>
        )}
      </Card>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Module</TableHead>
              {ACTIONS.map((a, idx) => (
                <TableHead key={`${a.label}-${idx}`} className="text-center">{a.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {ALL_MODULES.map((mod) => (
              <TableRow key={mod}>
                <TableCell className="font-medium capitalize">{mod}</TableCell>
                {ACTIONS.map((a, idx) => {
                  const ok = can(mod, a.key);
                  return (
                    <TableCell key={`${a.label}-${idx}`} className="text-center">
                      {ok ? (
                        <Check className="inline h-4 w-4 text-green-600" aria-label="allowed" />
                      ) : (
                        <X className="inline h-4 w-4 text-destructive" aria-label="denied" />
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
