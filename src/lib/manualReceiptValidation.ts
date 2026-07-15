import { db } from "@/lib/db";

export type ManualReceiptStatus =
  | "ok_gap"        // numeric, fills a gap → safe
  | "ok_manual"     // non-numeric manual code → safe (never touches serial)
  | "duplicate"     // already used by an active payment/receipt
  | "would_break_serial" // numeric ≥ next auto serial or ≥ max used → refuses
  | "invalid_format"
  | "empty";

export type ManualReceiptCheck = {
  status: ManualReceiptStatus;
  reason: string;
  next_serial?: number;
  max_used?: number;
};

/**
 * Pure gap-check used by unit tests and as a fallback when the DB RPC is not
 * yet available. Rules:
 *  - empty → invalid_format
 *  - non-numeric → ok_manual if not a duplicate
 *  - numeric: safe only if strictly less than BOTH nextSerial and maxUsed
 *    (so next_serial_receipt_no() = GREATEST(nextSerial, maxUsed+1) does not
 *    move because of it).
 */
export function checkManualReceiptNoLocal(
  raw: string,
  ctx: { nextSerial: number; maxUsed: number; activeNos: Set<string> },
): ManualReceiptCheck {
  const v = String(raw ?? "").trim();
  if (!v) return { status: "invalid_format", reason: "empty" };

  if (!/^[0-9]+$/.test(v)) {
    if (ctx.activeNos.has(v)) return { status: "duplicate", reason: "exists" };
    return { status: "ok_manual", reason: "non-numeric manual code" };
  }

  if (ctx.activeNos.has(v)) return { status: "duplicate", reason: "exists" };

  const n = Number(v);
  const { nextSerial, maxUsed } = ctx;
  if (n >= nextSerial || n >= maxUsed) {
    return {
      status: "would_break_serial",
      reason: `# ${n} would break serial (next=${nextSerial}, max_used=${maxUsed})`,
      next_serial: nextSerial,
      max_used: maxUsed,
    };
  }
  return { status: "ok_gap", reason: "fills existing gap", next_serial: nextSerial, max_used: maxUsed };
}

/**
 * Server-authoritative check. Calls the RPC and falls back to a local computation
 * (querying receipt_settings + max receipt_no) if the RPC is not deployed yet.
 */
export async function validateManualReceiptNo(no: string): Promise<ManualReceiptCheck> {
  const v = String(no ?? "").trim();
  if (!v) return { status: "invalid_format", reason: "empty" };

  try {
    const { data, error } = await (db as any).rpc("validate_manual_receipt_no", { _no: v });
    if (!error && Array.isArray(data) && data[0]) {
      const row = data[0] as any;
      return {
        status: row.status as ManualReceiptStatus,
        reason: row.reason,
        next_serial: Number(row.next_serial ?? 0),
        max_used: Number(row.max_used ?? 0),
      };
    }
  } catch {
    /* fall through to client-side check */
  }

  // Fallback: compute nextSerial + maxUsed from the client.
  const [setRes, payMaxRes, dupPayRes] = await Promise.all([
    (db as any).from("receipt_settings").select("receipt_serial_start").eq("id", 1).maybeSingle(),
    (db as any).from("payments").select("receipt_no")
      .not("receipt_no", "is", null).is("deleted_at", null).is("voided_at", null)
      .order("receipt_no", { ascending: false }).limit(200),
    (db as any).from("payments").select("id")
      .eq("receipt_no", v).is("deleted_at", null).is("voided_at", null).limit(1),
  ]);

  const activeNos = new Set<string>();
  if (dupPayRes.data && dupPayRes.data.length > 0) activeNos.add(v);

  const nums = (payMaxRes.data ?? [])
    .map((r: any) => Number(String(r.receipt_no ?? "").match(/^(\d+)$/)?.[1] ?? 0))
    .filter((n: number) => Number.isFinite(n) && n > 0);
  const maxUsed = nums.length ? Math.max(...nums) : 0;
  const nextSerial = Number(setRes.data?.receipt_serial_start ?? maxUsed + 1);

  return checkManualReceiptNoLocal(v, { nextSerial, maxUsed, activeNos });
}
