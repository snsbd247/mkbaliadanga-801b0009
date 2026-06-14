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

/**
 * Unified paid-receipt serial shared across all farmer payment streams
 * (irrigation / savings / loan / combined). Format: RCP-YYYY-MM-NNNN.
 * Falls back to the legacy per-kind monthly number on RPC failure.
 */
export async function nextUnifiedReceiptNo(
  officeId: string | null | undefined,
  fallbackKind: MonthlyKind = "PAY",
  fallbackSeed: string = crypto.randomUUID(),
): Promise<string> {
  if (officeId) {
    try {
      const { data, error } = await (supabase as any).rpc("next_unified_receipt_no", {
        p_office_id: officeId,
      });
      if (!error && typeof data === "string" && data) return data;
    } catch {
      /* fall through */
    }
  }
  return nextMonthlyReceiptNo(fallbackKind, officeId, fallbackSeed);
}

/** Non-consuming preview of the next monthly receipt no. Returns null if unknown. */
export async function peekMonthlyReceiptNo(
  kind: MonthlyKind,
  officeId: string | null | undefined,
): Promise<string | null> {
  if (!officeId) return null;
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  try {
    const { data } = await (supabase as any)
      .from("receipt_sequences")
      .select("last_no")
      .eq("office_id", officeId)
      .eq("kind", kind)
      .eq("year", y)
      .eq("month", m)
      .maybeSingle();
    const next = ((data?.last_no as number | undefined) ?? 0) + 1;
    return `${kind}-${y}-${String(m).padStart(2, "0")}-${String(next).padStart(4, "0")}`;
  } catch {
    return null;
  }
}
