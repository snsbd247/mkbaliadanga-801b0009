import { useState } from "react";
import { ApiShell } from "@/components/api/ApiShell";
import { useIssueQr, useRevokeQr } from "@/hooks/useAdminApi";
import { QrApi } from "@/lib/api/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const SUBJECTS = ["farmer", "land", "irrigation_invoice", "loan", "payment"];

export default function ApiQr() {
  const issue = useIssueQr();
  const revoke = useRevokeQr();
  const [subjectType, setSubjectType] = useState("farmer");
  const [subjectId, setSubjectId] = useState("");
  const [ttl, setTtl] = useState(30);
  const [issued, setIssued] = useState<any>(null);
  const [resolveTok, setResolveTok] = useState("");
  const [resolved, setResolved] = useState<any>(null);

  const onIssue = async () => {
    try {
      const r = await issue.mutateAsync({ subject_type: subjectType, subject_id: subjectId, ttl_days: ttl });
      setIssued(r);
      toast.success("Token issued");
    } catch (e: any) { toast.error(e.message); }
  };

  const onRevoke = async (id: string) => {
    try { await revoke.mutateAsync(id); toast.success("Revoked"); setIssued(null); }
    catch (e: any) { toast.error(e.message); }
  };

  const onResolve = async () => {
    try { setResolved(await QrApi.resolve(resolveTok)); }
    catch (e: any) { toast.error(e.message); setResolved(null); }
  };

  return (
    <ApiShell>
      <div className="container mx-auto p-4 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Issue QR Token</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Subject Type</Label>
              <Select value={subjectType} onValueChange={setSubjectType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Subject ID</Label><Input value={subjectId} onChange={e => setSubjectId(e.target.value)} /></div>
            <div><Label>TTL (days)</Label><Input type="number" value={ttl} onChange={e => setTtl(Number(e.target.value))} /></div>
            <Button onClick={onIssue} disabled={issue.isPending || !subjectId} className="w-full">Issue</Button>
            {issued && (
              <div className="rounded border p-3 space-y-2 text-sm">
                <div><span className="text-muted-foreground">Token:</span> <code className="break-all">{issued.token}</code></div>
                <div><span className="text-muted-foreground">Expires:</span> {issued.expires_at || "-"}</div>
                <Button variant="destructive" size="sm" onClick={() => onRevoke(issued.id)}>Revoke</Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Resolve Token</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Token</Label><Input value={resolveTok} onChange={e => setResolveTok(e.target.value)} /></div>
            <Button onClick={onResolve} disabled={!resolveTok} className="w-full">Resolve</Button>
            {resolved && (
              <pre className="rounded border bg-muted p-3 text-xs overflow-auto max-h-80">
                {JSON.stringify(resolved, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>
      </div>
    </ApiShell>
  );
}
