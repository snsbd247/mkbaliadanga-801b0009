import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { useAuth } from "@/auth/AuthProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, RefreshCw, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type AuditRow = {
  id: string;
  user_id: string | null;
  created_at: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
};

function serialOf(v: Record<string, unknown> | null | undefined): string {
  const n = v?.["receipt_serial_start"];
  return n === null || n === undefined ? "—" : String(n);
}

export default function ReceiptSerialAuditPage() {
  const { isSuper } = useAuth();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const { data } = await db
        .from("system_audit_logs" as any)
        .select("id,user_id,created_at,old_data,new_data")
        .eq("module", "receipt")
        .eq("action_type", "update")
        .not("new_data->receipt_serial_start", "is", null)
        .order("created_at", { ascending: false })
        .limit(200);
      const list = (data ?? []) as AuditRow[];
      setRows(list);

      const ids = Array.from(new Set(list.map((r) => r.user_id).filter(Boolean))) as string[];
      if (ids.length) {
        const { data: profs } = await db
          .from("profiles" as any)
          .select("id,full_name,username")
          .in("id", ids);
        const map: Record<string, string> = {};
        for (const p of (profs ?? []) as any[]) {
          map[p.id] = p.full_name || p.username || p.id;
        }
        setNames(map);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    document.title = "Receipt Serial Audit";
    load();
  }, []);

  if (!isSuper) {
    return (
      <>
        <PageHeader title="Receipt Serial Audit" />
        <Alert variant="destructive"><AlertDescription>This page is restricted to super administrators.</AlertDescription></Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="রিসিপ্ট ক্রমিক নম্বর পরিবর্তন লগ"
        description="শুরুর ক্রমিক নম্বর কে, কখন এবং কী থেকে কী পরিবর্তন করেছেন তার ইতিহাস।"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/receipt-template"><ArrowLeft className="h-4 w-4" />Receipt Template</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Refresh
            </Button>
          </div>
        }
      />

      <Card className="p-0 overflow-x-auto" data-testid="serial-audit-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>তারিখ ও সময় (When)</TableHead>
              <TableHead>পরিবর্তনকারী (Who)</TableHead>
              <TableHead className="text-right">আগের নম্বর</TableHead>
              <TableHead className="text-right">নতুন নম্বর</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground" data-testid="serial-audit-empty">কোনো পরিবর্তনের রেকর্ড নেই।</TableCell></TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id} data-testid="serial-audit-row">
                  <TableCell>{new Date(r.created_at).toLocaleString()}</TableCell>
                  <TableCell>{r.user_id ? (names[r.user_id] ?? r.user_id) : "—"}</TableCell>
                  <TableCell className="text-right font-mono">{serialOf(r.old_data)}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">{serialOf(r.new_data)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
