// i18n-ignore-file — admin-only page (English UI)
import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminVerify, RequiredAdmin, UserRoleRow } from "@/lib/api/adminVerify";
import { Check, X, RefreshCw, Wrench } from "lucide-react";
import { toast } from "sonner";

export default function AdminVerify() {
  const [required, setRequired] = useState<RequiredAdmin[]>([]);
  const [users, setUsers] = useState<UserRoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fixing, setFixing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminVerify.status();
      setRequired(data.required ?? []);
      setUsers(data.users ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Failed to load verification data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runFix = useCallback(async () => {
    setFixing(true);
    try {
      const data = await adminVerify.fix();
      setRequired(data.required ?? []);
      setUsers(data.users ?? []);
      const actions = data.actions ?? [];
      toast.success(actions.length ? `Fixed: ${actions.join(" ")}` : "Nothing to fix — all correct.");
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? e?.message ?? "Fix failed.");
    } finally {
      setFixing(false);
    }
  }, []);

  const hasMismatch = required.some((r) => !r.ok);

  return (
    <>
      <PageHeader
        title="Admin Verification"
        description="Confirms the two required admin accounts (developer + super_admin) exist with the correct roles, and shows the full user/role mapping."
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh
        </Button>
        <Button size="sm" onClick={runFix} disabled={fixing || loading}>
          <Wrench className="w-4 h-4 mr-1" /> {fixing ? "Fixing…" : "Fix mismatches"}
        </Button>
      </div>

      {error && (
        <Card className="p-4 mb-4 border-destructive/40">
          <p className="text-sm text-destructive">{error}</p>
        </Card>
      )}

      <Card className="p-4 mb-6">
        <h3 className="font-semibold mb-3">Required admin accounts</h3>
        {hasMismatch ? (
          <Badge variant="destructive" className="mb-3">Mismatch detected — click “Fix mismatches”.</Badge>
        ) : (
          required.length > 0 && <Badge className="mb-3">All required accounts are correct.</Badge>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Username</TableHead>
              <TableHead>Expected role</TableHead>
              <TableHead>Exists</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Has role</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {required.map((r) => (
              <TableRow key={r.username}>
                <TableCell className="font-medium">{r.username}</TableCell>
                <TableCell>{r.expected_role}</TableCell>
                <TableCell>{r.exists ? <Check className="w-4 h-4 text-green-600" /> : <X className="w-4 h-4 text-destructive" />}</TableCell>
                <TableCell>{r.active ? <Check className="w-4 h-4 text-green-600" /> : <X className="w-4 h-4 text-destructive" />}</TableCell>
                <TableCell>{r.has_role ? <Check className="w-4 h-4 text-green-600" /> : <X className="w-4 h-4 text-destructive" />}</TableCell>
                <TableCell>
                  {r.ok ? <Badge variant="secondary">OK</Badge> : <Badge variant="destructive">Fix needed</Badge>}
                </TableCell>
              </TableRow>
            ))}
            {!loading && required.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-muted-foreground">No data.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold mb-3">All users &amp; role mapping</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Username</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Roles</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.username}</TableCell>
                <TableCell>{u.name}</TableCell>
                <TableCell>{u.active ? <Check className="w-4 h-4 text-green-600" /> : <X className="w-4 h-4 text-destructive" />}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {u.roles.length ? u.roles.map((r) => <Badge key={r} variant="outline">{r}</Badge>) : <span className="text-muted-foreground text-sm">no role</span>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!loading && users.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-muted-foreground">No users.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
