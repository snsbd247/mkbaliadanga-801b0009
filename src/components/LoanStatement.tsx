import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLang } from "@/i18n/LanguageProvider";
import { money, fmtDate } from "@/lib/format";

export function LoanStatement({ loanId }: { loanId: string }) {
  const { tx } = useLang();
  const [loan, setLoan] = useState<any>(null);
  const [pays, setPays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const [l, p] = await Promise.all([
        supabase.from("loans").select("*, loan_plans(name,name_bn,duration_months,interest_rate,installment_type), farmers(name_en,name_bn,farmer_code,member_no)").eq("id", loanId).maybeSingle(),
        supabase.from("loan_payments").select("*").eq("loan_id", loanId).order("paid_on", { ascending: true }),
      ]);
      if (!active) return;
      setLoan(l.data ?? null);
      setPays(p.data ?? []);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [loanId]);

  if (loading) return <div className="text-sm text-muted-foreground py-6 text-center">…</div>;
  if (!loan) return <div className="text-sm text-muted-foreground py-6 text-center">{tx("Not found", "পাওয়া যায়নি")}</div>;

  const principalPaid = pays.reduce((s, p) => s + (Number(p.principal_amount ?? 0) > 0 ? Number(p.principal_amount) : Number(p.amount ?? 0)), 0);
  const interestPaid = pays.reduce((s, p) => s + Number(p.interest_amount ?? 0), 0);
  const principalRemaining = Math.max(0, Number(loan.principal ?? 0) - principalPaid);

  return (
    <div className="space-y-4">
      <Card className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div><div className="text-muted-foreground">{tx("Loan No", "ঋণ নং")}</div><div className="font-medium">{loan.loan_no || loan.id.slice(0, 8)}</div></div>
        <div><div className="text-muted-foreground">{tx("Plan", "প্ল্যান")}</div><div className="font-medium">{loan.loan_plans?.name_bn || loan.loan_plans?.name || "—"}</div></div>
        <div><div className="text-muted-foreground">{tx("Issued On", "ইস্যু তারিখ")}</div><div className="font-medium">{fmtDate(loan.issued_on)}</div></div>
        <div><div className="text-muted-foreground">{tx("Status", "অবস্থা")}</div><div><Badge>{loan.status}</Badge></div></div>
        <div><div className="text-muted-foreground">{tx("Principal", "আসল")}</div><div className="font-mono">{money(loan.principal)}</div></div>
        <div><div className="text-muted-foreground">{tx("Interest Rate", "সুদের হার")}</div><div className="font-mono">{Number(loan.interest_rate || 0)}%</div></div>
        <div><div className="text-muted-foreground">{tx("Principal Paid", "আসল পরিশোধ")}</div><div className="font-mono">{money(principalPaid)}</div></div>
        <div><div className="text-muted-foreground">{tx("Principal Due", "আসল বাকি")}</div><div className="font-mono font-bold">{money(principalRemaining)}</div></div>
        <div><div className="text-muted-foreground">{tx("Interest Paid", "লাভ পরিশোধ")}</div><div className="font-mono">{money(interestPaid)}</div></div>
      </Card>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{tx("Date", "তারিখ")}</TableHead>
            <TableHead>{tx("Receipt", "রশিদ")}</TableHead>
            <TableHead className="text-right">{tx("Principal", "আসল")}</TableHead>
            <TableHead className="text-right">{tx("Interest", "লাভ")}</TableHead>
            <TableHead className="text-right">{tx("Total", "মোট")}</TableHead>
            <TableHead>{tx("Status", "অবস্থা")}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {pays.map(p => (
              <TableRow key={p.id}>
                <TableCell>{fmtDate(p.paid_on)}</TableCell>
                <TableCell className="text-xs">{p.receipt_no || "—"}</TableCell>
                <TableCell className="text-right font-mono">{money(p.principal_amount ?? p.amount)}</TableCell>
                <TableCell className="text-right font-mono">{money(p.interest_amount ?? 0)}</TableCell>
                <TableCell className="text-right font-mono">{money(p.amount)}</TableCell>
                <TableCell><Badge variant="secondary">{p.status || "approved"}</Badge></TableCell>
              </TableRow>
            ))}
            {pays.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">{tx("No payments yet", "কোনো পরিশোধ নেই")}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
