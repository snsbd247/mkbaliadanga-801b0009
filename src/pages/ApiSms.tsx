import { useState } from "react";
import { ApiShell } from "@/components/api/ApiShell";
import { useSmsLogs, useSendSms, useRetrySms } from "@/hooks/useAdminApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RotateCw } from "lucide-react";
import { toast } from "sonner";

const STATUSES = ["all", "queued", "sent", "failed", "delivered"];

export default function ApiSms() {
  const [status, setStatus] = useState("all");
  const { data, isLoading } = useSmsLogs({ status: status === "all" ? undefined : status, per_page: 100 });
  const send = useSendSms();
  const retry = useRetrySms();

  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const [body, setBody] = useState("");

  const submit = async () => {
    try {
      await send.mutateAsync({ to, body });
      toast.success("Queued");
      setOpen(false); setTo(""); setBody("");
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <ApiShell>
      <div className="container mx-auto p-4 space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>SMS Logs</CardTitle>
            <div className="flex gap-2">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild><Button>Send SMS</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Send SMS</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>To</Label><Input value={to} onChange={e => setTo(e.target.value)} placeholder="+8801…" /></div>
                    <div><Label>Body</Label><Textarea rows={4} value={body} onChange={e => setBody(e.target.value)} /></div>
                    <Button className="w-full" onClick={submit} disabled={send.isPending}>Send</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? <p>Loading…</p> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Time</TableHead><TableHead>To</TableHead>
                  <TableHead>Body</TableHead><TableHead>Provider</TableHead>
                  <TableHead>Status</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {data?.data?.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="text-xs">{new Date(s.created_at).toLocaleString()}</TableCell>
                      <TableCell>{s.to}</TableCell>
                      <TableCell className="max-w-md truncate text-xs">{s.body}</TableCell>
                      <TableCell className="text-xs">{s.provider || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={s.status === "failed" ? "destructive" : s.status === "sent" || s.status === "delivered" ? "default" : "secondary"}>
                          {s.status}
                        </Badge>
                        {s.error && <p className="text-xs text-destructive mt-1">{s.error}</p>}
                      </TableCell>
                      <TableCell>
                        {s.status === "failed" && (
                          <Button variant="ghost" size="icon" onClick={() => retry.mutate(s.id)}>
                            <RotateCw className="h-4 w-4" />
                          </Button>
                        )}
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
