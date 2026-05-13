import { useState } from "react";
import { ApiShell } from "@/components/api/ApiShell";
import { useAuditLogs } from "@/hooks/useAdminApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function ApiAudit() {
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { data, isLoading } = useAuditLogs({ q: q || undefined, from: from || undefined, to: to || undefined, per_page: 100 });

  return (
    <ApiShell>
      <div className="container mx-auto p-4 space-y-4">
        <Card>
          <CardHeader><CardTitle>Audit Log</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-3 gap-3">
            <div><Label>Search</Label><Input value={q} onChange={e => setQ(e.target.value)} placeholder="action / entity…" /></div>
            <div><Label>From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
            <div><Label>To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            {isLoading ? <p>Loading…</p> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Time</TableHead><TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead><TableHead>User</TableHead>
                  <TableHead>Meta</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {data?.data?.map(a => (
                    <TableRow key={a.id}>
                      <TableCell className="text-xs">{new Date(a.created_at).toLocaleString()}</TableCell>
                      <TableCell><Badge variant="outline">{a.action}</Badge></TableCell>
                      <TableCell className="text-xs">{a.entity_type || "-"} {a.entity_id ? `#${String(a.entity_id).slice(0, 8)}` : ""}</TableCell>
                      <TableCell className="text-xs">{a.user_id ? String(a.user_id).slice(0, 8) : "-"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-md truncate">
                        {a.meta ? JSON.stringify(a.meta) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </ApiShell>
  );
}
