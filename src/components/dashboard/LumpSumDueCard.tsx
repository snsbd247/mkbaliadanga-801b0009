import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { money, fmtDate } from "@/lib/format";

const sb = db as any;

/**
 * Dashboard card listing active lump-sum loans that still have a due amount,
 * red-highlighted, scoped to the user's assigned office (RLS already restricts
 * rows, the office filter keeps the list relevant when set).
 */
export function LumpSumDueCard({ officeId }: { officeId?: string | null }) {
  const { tx, lang } = useLang();
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      let q = sb.from("loans")
        .select("id,principal,next_due_on,office_id,farmers(name_en,name_bn,member_no),loan_plans!inner(installment_type),loan_payments(principal_amount,amount)")
        .is("deleted_at", null)
        .eq("loan_plans.installment_type", "lump_sum")
        .in("status", ["approved", "overdue"]);
      if (officeId) q = q.eq("office_id", officeId);
      const { data } = await q;
      const due = (data ?? [])
        .map((r: any) => {
          const paid = (r.loan_payments ?? []).reduce(
            (s: number, p: any) => s + (Number(p.principal_amount ?? 0) > 0 ? Number(p.principal_amount) : Number(p.amount ?? 0)), 0);
          return { ...r, _due: Math.max(0, Number(r.principal ?? 0) - paid) };
        })
        .filter((r: any) => r._due > 0)
        .sort((a: any, b: any) => b._due - a._due);
      setRows(due);
    })();
  }, [officeId]);

  if (rows.length === 0) return null;

  return (
    <Card className="p-4 border-destructive/40 bg-destructive/5">
      <div className="flex items-center gap-2 mb-3 text-destructive font-medium">
        <AlertTriangle className="h-4 w-4" />
        {tx("Lump-sum loans with due", "একবারে পরিশোধের বকেয়া ঋণ")} ({rows.length})
      </div>
      <div className="space-y-1">
        {rows.slice(0, 6).map((r) => (
          <Link key={r.id} to="/loans" className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-destructive/10 text-sm">
            <span>
              {(lang === "bn" ? (r.farmers?.name_bn || r.farmers?.name_en) : r.farmers?.name_en) ?? ""}
              <span className="text-xs text-muted-foreground ml-2">{r.farmers?.member_no ?? ""}</span>
            </span>
            <span className="flex items-center gap-3">
              {r.next_due_on && <span className="text-xs text-muted-foreground">{fmtDate(r.next_due_on)}</span>}
              <span className="font-mono font-bold text-destructive">{money(r._due)}</span>
            </span>
          </Link>
        ))}
      </div>
    </Card>
  );
}
