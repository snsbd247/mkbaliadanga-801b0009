import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLang } from "@/i18n/LanguageProvider";
import { RefreshCw } from "lucide-react";

const sb = db as any;

type FallbackMeta = {
  rpc?: string;
  land_id?: string | null;
  office?: string | null;
  request_id?: string;
  error?: string | null;
};

type LogRow = {
  id: string;
  action: string;
  entity: string | null;
  entity_id: string | null;
  office_id: string | null;
  meta: FallbackMeta | null;
  created_at: string;
};

export default function RpcFallbackAudit() {
  const { tx } = useLang();
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [requestId, setRequestId] = useState("");
  const [office, setOffice] = useState("");
  const [landId, setLandId] = useState("");

  useEffect(() => {
    document.title = tx("RPC Fallback Audit", "RPC ফলব্যাক অডিট");
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await sb
        .from("audit_logs")
        .select("id,action,entity,entity_id,office_id,meta,created_at")
        .eq("action", "rpc.fallback_used")
        .order("created_at", { ascending: false })
        .limit(500);
      setRows((data as LogRow[]) ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const rq = requestId.trim().toLowerCase();
    const of = office.trim().toLowerCase();
    const ld = landId.trim().toLowerCase();
    return rows.filter((r) => {
      const meta = r.meta ?? {};
      const rid = String(meta.request_id ?? "").toLowerCase();
      const off = String(meta.office ?? r.office_id ?? "").toLowerCase();
      const lnd = String(meta.land_id ?? r.entity_id ?? "").toLowerCase();
      if (rq && !rid.includes(rq)) return false;
      if (of && !off.includes(of)) return false;
      if (ld && !lnd.includes(ld)) return false;
      return true;
    });
  }, [rows, requestId, office, landId]);

  return (
    <div className="space-y-4">
      <PageHeader
        title={tx("RPC Fallback Audit", "RPC ফলব্যাক অডিট")}
        description={tx(
          "Trace every time the invoice billing RPC fallback was used — filter by request_id, office, or land_id.",
          "ইনভয়েস বিলিং RPC ফলব্যাক কখন ব্যবহৃত হয়েছে দেখুন — request_id, অফিস বা জমি দিয়ে ফিল্টার করুন।",
        )}
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            {tx("Refresh", "রিফ্রেশ")}
          </Button>
        }
      />

      <Card className="p-3 flex flex-wrap items-end gap-3">
        <div>
          <Label>{tx("Request ID", "রিকোয়েস্ট আইডি")}</Label>
          <Input value={requestId} onChange={(e) => setRequestId(e.target.value)} placeholder="req_…" />
        </div>
        <div>
          <Label>{tx("Office", "অফিস")}</Label>
          <Input value={office} onChange={(e) => setOffice(e.target.value)} placeholder={tx("office id", "অফিস আইডি")} />
        </div>
        <div>
          <Label>{tx("Land ID", "জমি আইডি")}</Label>
          <Input value={landId} onChange={(e) => setLandId(e.target.value)} placeholder={tx("land id", "জমি আইডি")} />
        </div>
        <Badge variant="outline">
          {filtered.length} / {rows.length}
        </Badge>
      </Card>

      <Card className="p-0 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tx("Time", "সময়")}</TableHead>
              <TableHead>{tx("RPC", "RPC")}</TableHead>
              <TableHead>{tx("Land ID", "জমি আইডি")}</TableHead>
              <TableHead>{tx("Office", "অফিস")}</TableHead>
              <TableHead>{tx("Request ID", "রিকোয়েস্ট আইডি")}</TableHead>
              <TableHead>{tx("Error", "ত্রুটি")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                  {loading ? tx("Loading…", "লোড হচ্ছে…") : tx("No fallback events found", "কোনো ফলব্যাক ইভেন্ট নেই")}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => {
                const meta = r.meta ?? {};
                return (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {new Date(r.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{meta.rpc ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{meta.land_id ?? r.entity_id ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{meta.office ?? r.office_id ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{meta.request_id ?? "—"}</TableCell>
                    <TableCell className="text-xs text-destructive max-w-[280px] truncate" title={meta.error ?? ""}>
                      {meta.error ?? "—"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
