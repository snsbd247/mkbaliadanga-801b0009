// Admin page to view and process public payment intents (P-E3).
// i18n-ignore-file — admin/utility page
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/auth/AuthProvider";
import { fmtDate, money } from "@/lib/format";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";

const sb = supabase as any;

export default function PublicPaymentIntents() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("pending");

  async function load() {
    let q = sb.from("public_payment_intents").select("*").order("created_at", { ascending: false }).limit(500);
    if (statusFilter !== "all") q = q.eq("status", statusFilter);
    const { data, error } = await q;
    if (error) { toast.error(error.message); return; }
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, [statusFilter]);

  async function mark(id: string, status: string) {
    const { error } = await sb.from("public_payment_intents").update({
      status, processed_by: user?.id, processed_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(status);
    load();
  }

  return (
    <>
      <PageHeader
        title="পাবলিক পেমেন্ট অনুরোধ"
        description="অনলাইন পোর্টালের মাধ্যমে জমা দেওয়া পেমেন্ট অনুরোধ"
        actions={
          <div className="flex items-center gap-2">
            <Link to="/pay" target="_blank" className="text-xs text-primary inline-flex items-center gap-1">পাবলিক পোর্টাল <ExternalLink className="h-3 w-3" /></Link>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processed">Processed</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />
      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Date</TableHead><TableHead>Farmer Code</TableHead><TableHead>Phone</TableHead>
            <TableHead>Amount</TableHead><TableHead>For</TableHead><TableHead>Note</TableHead>
            <TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs">{fmtDate(r.created_at)}</TableCell>
                <TableCell className="font-mono text-xs">{r.farmer_code}</TableCell>
                <TableCell className="text-xs">{r.phone ?? "—"}</TableCell>
                <TableCell className="tabular-nums">{money(r.amount)}</TableCell>
                <TableCell className="text-xs">{r.allocation_hint}</TableCell>
                <TableCell className="text-xs max-w-xs truncate">{r.note ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={r.status === "processed" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>
                    {r.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {r.status === "pending" && (
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="outline" onClick={() => mark(r.id, "processed")}>Mark processed</Button>
                      <Button size="sm" variant="ghost" onClick={() => mark(r.id, "rejected")}>Reject</Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">No requests</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
