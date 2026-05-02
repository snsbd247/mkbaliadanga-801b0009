import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { money, fmtDate } from "@/lib/format";

export default function Approvals() {
  const [savings, setSavings] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);

  const reload = async () => {
    const [{ data: s }, { data: p }] = await Promise.all([
      supabase.from("savings_transactions").select("id,txn_date,amount,type,status,farmer_id,farmers(name_en,farmer_code)")
        .eq("type", "withdraw").eq("status", "pending").order("txn_date", { ascending: false }),
      supabase.from("loan_payments").select("id,paid_on,amount,status,loan_id,loans(farmer_id,farmers(name_en,farmer_code))")
        .eq("status", "pending").order("paid_on", { ascending: false }),
    ]);
    setSavings((s as any[]) || []);
    setPayments((p as any[]) || []);
  };

  useEffect(() => { reload(); }, []);

  const setStatus = async (table: "savings_transactions" | "loan_payments", id: string, status: string) => {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from(table).update({
      status, approved_by: u.user?.id, approved_at: new Date().toISOString(),
    } as any).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Marked ${status}`);
    reload();
  };

  return (
    <div className="container mx-auto p-4 space-y-4">
      <PageHeader title="Approvals" description="Approve savings withdrawals and loan payments before they post to the ledger" />

      <Tabs defaultValue="savings">
        <TabsList>
          <TabsTrigger value="savings">Savings withdrawals ({savings.length})</TabsTrigger>
          <TabsTrigger value="payments">Loan payments ({payments.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="savings">
          <Card><CardContent className="pt-6">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Farmer</TableHead>
                <TableHead className="text-right">Amount</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {savings.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{fmtDate(r.txn_date)}</TableCell>
                    <TableCell>{r.farmers?.farmer_code} — {r.farmers?.name_en}</TableCell>
                    <TableCell className="text-right">{money(r.amount)}</TableCell>
                    <TableCell className="flex gap-2 justify-end">
                      <Button size="sm" onClick={() => setStatus("savings_transactions", r.id, "approved")}>Approve</Button>
                      <Button size="sm" variant="outline" onClick={() => setStatus("savings_transactions", r.id, "rejected")}>Reject</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!savings.length && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No pending withdrawals</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card><CardContent className="pt-6">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Farmer</TableHead>
                <TableHead className="text-right">Amount</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {payments.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{fmtDate(r.paid_on)}</TableCell>
                    <TableCell>{r.loans?.farmers?.farmer_code} — {r.loans?.farmers?.name_en}</TableCell>
                    <TableCell className="text-right">{money(r.amount)}</TableCell>
                    <TableCell className="flex gap-2 justify-end">
                      <Button size="sm" onClick={() => setStatus("loan_payments", r.id, "approved")}>Approve</Button>
                      <Button size="sm" variant="outline" onClick={() => setStatus("loan_payments", r.id, "rejected")}>Reject</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!payments.length && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No pending payments</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
