import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DuplicateRow {
  receipt_no: string;
  kind: string;
  date: string;
  count: number;
}

/**
 * Scans `payments` for repeated receipt_no within the same kind+date.
 * Returns [] when none, used by the admin warning banner.
 */
export function useDuplicateReceiptAudit(enabled: boolean) {
  const [rows, setRows] = useState<DuplicateRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // Pull last 90 days of receipts; client-side group counts (small dataset).
        const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
        const { data } = await supabase
          .from("payments")
          .select("receipt_no, kind, created_at")
          .gte("created_at", since)
          .not("receipt_no", "is", null)
          .limit(5000);
        const counts = new Map<string, DuplicateRow>();
        for (const p of (data ?? []) as any[]) {
          if (!p.receipt_no) continue;
          const day = String(p.created_at).slice(0, 10);
          const key = `${p.kind}|${day}|${p.receipt_no}`;
          const cur = counts.get(key);
          if (cur) cur.count += 1;
          else counts.set(key, { receipt_no: p.receipt_no, kind: p.kind ?? "", date: day, count: 1 });
        }
        const dups = Array.from(counts.values()).filter((r) => r.count > 1);
        if (!cancelled) setRows(dups);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [enabled]);

  return { rows, loading };
}
