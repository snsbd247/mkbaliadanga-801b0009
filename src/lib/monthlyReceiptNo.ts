// Type-wise monthly receipt sequence (e.g. SAV-2026-05-0001).
// Calls Postgres function `next_monthly_receipt_no(office_id, kind)`.
// Falls back to the legacy autoReceiptNo() on RPC failure so the UI is never blocked.
import { supabase } from "@/integrations/supabase/client";
import { autoReceiptNo, type ReceiptKind } from "@/lib/receiptNo";

export type MonthlyKind = ReceiptKind | "COMBO";

export async function nextMonthlyReceiptNo(
  kind: MonthlyKind,
  officeId: string | null | undefined,
  fallbackSeed: string = crypto.randomUUID(),
): Promise<string> {
  if (officeId) {
    try {
      const { data, error } = await (supabase as any).rpc("next_monthly_receipt_no", {
        p_office_id: officeId,
        p_kind: kind,
      });
      if (!error && typeof data === "string" && data) return data;
    } catch {
      /* fall through to offline format */
    }
  }
  // Offline / no-office fallback keeps existing PREFIX-YYYYMMDD-XXXXXX shape.
  return autoReceiptNo(kind === "COMBO" ? "PAY" : kind, fallbackSeed);
}
