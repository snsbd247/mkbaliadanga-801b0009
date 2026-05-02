import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { money, fmtDate } from "@/lib/format";
import { useAuth } from "@/auth/AuthProvider";

type DecisionTarget = {
  table: "savings_transactions" | "loan_payments" | "loans";
  id: string;
  status: "approved" | "rejected";
  label: string;
} | null;

export default function Approvals() {
  const { isCommittee } = useAuth();
  const [savings, setSavings] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [decision, setDecision] = useState<DecisionTarget>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    const [{ data: s }, { data: p }, { data: l }] = await Promise.all([
      supabase.from("savings_transactions").select("id,txn_date,amount,type,status,note,farmer_id,farmers(name_en,farmer_code)")
        .eq("type", "withdraw").eq("status", "pending").order("txn_date", { ascending: false }),
      supabase.from("loan_payments").select("id,paid_on,amount,status,loan_id,loans(farmer_id,farmers(name_en,farmer_code))")
        .eq("status", "pending").order("paid_on", { ascending: false }),
      supabase.from("loans").select("id,issued_on,principal,total_payable,status,note,farmer_id,farmers(name_en,farmer_code)")
        .eq("status", "pending").order("issued_on", { ascending: false }),
    ]);
    setSavings((s as any[]) || []);
    setPayments((p as any[]) || []);
    setLoans((l as any[]) || []);
  };

  useEffect(() => { reload(); }, []);

  const askDecision = (table: DecisionTarget["table"], id: string, status: "approved" | "rejected", label: string) => {
    setComment(""); setDecision({ table, id, status, label });
  };

  const confirmDecision = async () => {
    if (!decision) return;
    if (decision.status === "rejected" && !comment.trim()) {
      return toast.error("A reason is required for rejections");
    }
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const patch: any = {
      status: decision.status,
      approved_by: u.user?.id,
    };
    // savings_transactions has `note`; loans / loan_payments use `approval_note`
    if (decision.table === "savings_transactions") {
      if (comment.trim()) patch.note = comment.trim();
    } else {
      if (comment.trim()) patch.approval_note = comment.trim();
      patch.approved_at = new Date().toISOString();
    }
    const { error } = await supabase.from(decision.table).update(patch).eq("id", decision.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Marked ${decision.status}`);
    setDecision(null);
    reload();
  };

  if (!isCommittee) {
    return (
      <div className="container mx-auto p-4">
        <PageHeader title="Approvals" />
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>
            Only Super Admin or Committee members can approve or reject. Ask an administrator for the right role.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-4">
      <PageHeader title="Approvals" description="Approve or reject pending savings withdrawals, loan disbursements, and loan repayments. Decisions are recorded in the audit log." />

      <Tabs defaultValue="savings">
        <TabsList>
          <TabsTrigger value="savings">Savings withdrawals ({savings.length})</TabsTrigger>
          <TabsTrigger value="loans">Loan disbursements ({loans.length})</TabsTrigger>
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
                      <Button size="sm" onClick={() => askDecision("savings_transactions", r.id, "approved", `Withdrawal ${money(r.amount)} for ${r.farmers?.name_en}`)}>Approve</Button>
                      <Button size="sm" variant="outline" onClick={() => askDecision("savings_transactions", r.id, "rejected", `Withdrawal ${money(r.amount)} for ${r.farmers?.name_en}`)}>Reject</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!savings.length && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No pending withdrawals</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="loans">
          <Card><CardContent className="pt-6">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Issued</TableHead><TableHead>Farmer</TableHead>
                <TableHead className="text-right">Principal</TableHead>
                <TableHead className="text-right">Total Payable</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {loans.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{fmtDate(r.issued_on)}</TableCell>
                    <TableCell>{r.farmers?.farmer_code} — {r.farmers?.name_en}</TableCell>
                    <TableCell className="text-right">{money(r.principal)}</TableCell>
                    <TableCell className="text-right">{money(r.total_payable)}</TableCell>
                    <TableCell className="flex gap-2 justify-end">
                      <Button size="sm" onClick={() => askDecision("loans", r.id, "approved", `Loan ${money(r.principal)} for ${r.farmers?.name_en}`)}>Approve</Button>
                      <Button size="sm" variant="outline" onClick={() => askDecision("loans", r.id, "rejected", `Loan ${money(r.principal)} for ${r.farmers?.name_en}`)}>Reject</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!loans.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No pending loans</TableCell></TableRow>}
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
                      <Button size="sm" onClick={() => askDecision("loan_payments", r.id, "approved", `Payment ${money(r.amount)}`)}>Approve</Button>
                      <Button size="sm" variant="outline" onClick={() => askDecision("loan_payments", r.id, "rejected", `Payment ${money(r.amount)}`)}>Reject</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!payments.length && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No pending payments</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!decision} onOpenChange={(o) => !o && setDecision(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decision?.status === "approved" ? "Approve" : "Reject"} — {decision?.label}
            </DialogTitle>
            <DialogDescription>
              This decision will be recorded in the audit log along with your user ID and timestamp.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Comment {decision?.status === "rejected" && <span className="text-destructive">*</span>}</Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={decision?.status === "rejected" ? "Reason for rejection (required)…" : "Optional note for the audit log"}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecision(null)} disabled={busy}>Cancel</Button>
            <Button
              variant={decision?.status === "rejected" ? "destructive" : "default"}
              onClick={confirmDecision}
              disabled={busy}
            >
              Confirm {decision?.status}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
