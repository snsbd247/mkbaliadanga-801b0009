import { db } from "@/lib/db";

const MISSING_RPC_HINTS = [
  "not available on this server",
  "could not find the function",
  "schema cache",
  "pgrst202",
];

/** Detect the "RPC missing / schema-cache stale" class of error. */
export function isRpcUnavailable(err: unknown): boolean {
  if (!err) return false;
  const anyErr = err as { message?: string; code?: string };
  const code = (anyErr.code ?? "").toUpperCase();
  if (code === "PGRST202" || code === "404") return true;
  const msg = (anyErr.message ?? "").toLowerCase();
  return MISSING_RPC_HINTS.some((h) => msg.includes(h));
}

/**
 * Verify the admin_set_receipt_serial_start RPC is reachable.
 * We probe with an intentionally invalid argument (-1) — a reachable function
 * rejects it with a validation error, while a missing function returns the
 * "not available / schema cache" error we care about.
 */
export async function checkReceiptSerialRpc(): Promise<{ available: boolean; message: string }> {
  const { error } = await (db as any).rpc("admin_set_receipt_serial_start", { p_start: -1 });
  if (!error) return { available: true, message: "RPC available" };
  if (isRpcUnavailable(error)) {
    return {
      available: false,
      message:
        "admin_set_receipt_serial_start RPC পাওয়া যায়নি। মাইগ্রেশন প্রয়োগ করুন এবং PostgREST schema cache reload করুন (মাইগ্রেশনের শেষে NOTIFY pgrst, 'reload schema';)।",
    };
  }
  // Any other error (e.g. our -1 validation rejection or permission) means the
  // function exists and is reachable.
  return { available: true, message: "RPC available" };
}

/**
 * Set the receipt serial start via the server-validated + audited RPC.
 * Automatically retries ONCE if the first attempt fails with a stale-schema /
 * missing-RPC error, giving PostgREST time to pick up a freshly deployed function.
 */
export async function setReceiptSerialStart(
  nextSerial: number,
): Promise<{ ok: boolean; message: string }> {
  const attempt = () => (db as any).rpc("admin_set_receipt_serial_start", { p_start: nextSerial });

  let { error } = await attempt();
  if (error && isRpcUnavailable(error)) {
    // brief backoff, then a single automatic retry
    await new Promise((r) => setTimeout(r, 1500));
    ({ error } = await attempt());
  }

  if (error) {
    if (isRpcUnavailable(error)) {
      return {
        ok: false,
        message:
          "সিরিয়াল সেট করা যায়নি: RPC এখনও লোড হয়নি। কিছুক্ষণ পর আবার চেষ্টা করুন বা মাইগ্রেশন/schema reload যাচাই করুন।",
      };
    }
    return { ok: false, message: error.message };
  }
  return { ok: true, message: "Serial start updated" };
}
