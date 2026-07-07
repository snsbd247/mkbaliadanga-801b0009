import { db } from "@/lib/db";
import { isLaravelBackend } from "@/lib/backend";
import { logDiagnostic } from "@/lib/diagnostics";

const MISSING_RPC_HINTS = [
  "not available on this server",
  "could not find the function",
  "schema cache",
  "pgrst202",
  "not implemented",
  "501",
  "function not found",
];

function errorMessage(err: unknown): string {
  const anyErr = err as { message?: string; code?: string; status?: number; data?: unknown };
  const parts = [anyErr?.message, anyErr?.code, anyErr?.status != null ? String(anyErr.status) : undefined];
  try {
    if (anyErr?.data) parts.push(JSON.stringify(anyErr.data));
  } catch {
    // ignore non-serializable error details
  }
  return parts.filter(Boolean).join(" ");
}

/** Detect the "RPC missing / schema-cache stale" class of error. */
export function isRpcUnavailable(err: unknown): boolean {
  if (!err) return false;
  const anyErr = err as { message?: string; code?: string };
  const code = (anyErr.code ?? "").toUpperCase();
  if (code === "PGRST202" || code === "404" || code === "501") return true;
  const msg = errorMessage(err).toLowerCase();
  return MISSING_RPC_HINTS.some((h) => msg.includes(h));
}

export async function getCurrentSerialLast(): Promise<number> {
  const { data, error } = await db
    .from("receipt_counters")
    .select("last_no")
    .eq("kind", "SERIAL")
    .eq("year", 0)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Number((data as any)?.last_no ?? 0) || 0;
}

async function setReceiptSerialStartDirect(nextSerial: number): Promise<{ ok: boolean; message: string }> {
  try {
    const currentLast = await getCurrentSerialLast();
    if (nextSerial < currentLast) {
      return {
        ok: false,
        message: `এই নম্বর (${nextSerial}) বর্তমান সর্বশেষ রিসিপ্ট নম্বরের (${currentLast}) চেয়ে ছোট — ডুপ্লিকেট এড়াতে বাতিল করা হলো`,
      };
    }

    const payload = { receipt_serial_start: nextSerial, updated_at: new Date().toISOString() } as any;
    let { data, error } = await db
      .from("receipt_settings")
      .update(payload)
      .eq("id", 1)
      .select("id,receipt_serial_start");
    if (error) return { ok: false, message: error.message };

    const rows = Array.isArray(data) ? data : data ? [data] : [];
    if (rows.length === 0) {
      const defaults = {
        id: 1,
        language: "en",
        paper_size: "a5",
        accent_color: "#1f4e79",
        show_logo: true,
        show_signature_line: true,
        show_office: true,
        show_token_block: true,
        header_alignment: "center",
        footer_note: "This is a system-generated receipt. Please retain for your records.",
        footer_note_bn: "এটি সিস্টেম-জেনারেটেড রসিদ। অনুগ্রহ করে আপনার রেকর্ডের জন্য সংরক্ষণ করুন।",
        show_watermark: false,
        watermark_text: "",
        show_penalty_row: true,
        show_charge_row: true,
        qr_placement: "right",
        ...payload,
      } as any;
      const inserted = await db.from("receipt_settings").insert(defaults).select("id,receipt_serial_start");
      if (inserted.error) return { ok: false, message: inserted.error.message };
      data = inserted.data as any;
    }

    const savedRows = Array.isArray(data) ? data : data ? [data] : [];
    const persisted = Number((savedRows[0] as any)?.receipt_serial_start ?? NaN);
    if (!Number.isFinite(persisted) || persisted !== nextSerial) {
      return { ok: false, message: `Serial start save was not confirmed (expected ${nextSerial}, got ${Number.isFinite(persisted) ? persisted : "—"})` };
    }
    return { ok: true, message: "Serial start updated" };
  } catch (e) {
    return { ok: false, message: errorMessage(e) || "Serial start update failed" };
  }
}

/**
 * Verify the admin_set_receipt_serial_start RPC is reachable.
 * We probe with an intentionally invalid argument (-1) — a reachable function
 * rejects it with a validation error, while a missing function returns the
 * "not available / schema cache" error we care about.
 */
export async function checkReceiptSerialRpc(): Promise<{ available: boolean; message: string }> {
  if (isLaravelBackend) {
    const viaFunction = await (db as any).functions.invoke("receipt-serial-admin", { body: { check: true } });
    if (!viaFunction.error) return { available: true, message: "Receipt serial admin endpoint available" };
    try {
      await getCurrentSerialLast();
      return { available: true, message: "Receipt serial direct fallback available" };
    } catch {
      return {
        available: false,
        message: "Receipt serial table gateway পাওয়া যায়নি। VPS backend-এ receipt_counters/receipt_settings API যাচাই করুন।",
      };
    }
  }

  const viaFunction = await (db as any).functions.invoke("receipt-serial-admin", { body: { check: true } });
  if (!viaFunction.error) return { available: true, message: "Receipt serial admin endpoint available" };

  const { error } = await (db as any).rpc("admin_set_receipt_serial_start", { p_start: -1 });
  if (!error) return { available: true, message: "RPC available" };
  if (isRpcUnavailable(error)) {
    // Self-hosted/VPS installs may not implement /api/fn or /api/rpc. In that
    // case the app can still safely update receipt_settings through the normal
    // table gateway after checking the SERIAL counter below.
    try {
      await getCurrentSerialLast();
      return { available: true, message: "Receipt serial direct fallback available" };
    } catch {
      // continue to the clear unavailable message
    }
    return {
      available: false,
      message:
        "Receipt serial admin endpoint/RPC পাওয়া যায়নি। অ্যাপটি নতুন করে publish/deploy করুন; backend schema cache reload মাইগ্রেশনে যুক্ত আছে।",
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
): Promise<{ ok: boolean; message: string; value?: number }> {
  const t = (start: number) => Math.round(performance.now() - start);

  const functionAttempt = () => (db as any).functions.invoke("receipt-serial-admin", { body: { p_start: nextSerial } });
  let fs = performance.now();
  let functionResult = await functionAttempt();
  if (functionResult.error) {
    logDiagnostic("/api/fn/receipt-serial-admin", "error", errorMessage(functionResult.error), { durationMs: t(fs) });
    await new Promise((r) => setTimeout(r, 800));
    fs = performance.now();
    functionResult = await functionAttempt();
  }
  if (!functionResult.error) {
    // The edge function persists with the service role and echoes the stored value.
    const stored = Number((functionResult.data as any)?.receipt_serial_start);
    logDiagnostic("/api/fn/receipt-serial-admin", "ok", "Serial start updated", { durationMs: t(fs) });
    return { ok: true, message: "Serial start updated", value: Number.isFinite(stored) ? stored : nextSerial };
  }
  const functionUnavailable = isRpcUnavailable(functionResult.error);

  const attempt = () => (db as any).rpc("admin_set_receipt_serial_start", { p_start: nextSerial });

  let rs = performance.now();
  let { data: rpcData, error } = await attempt();
  if (error && isRpcUnavailable(error)) {
    logDiagnostic("/api/rpc/admin_set_receipt_serial_start", "error", errorMessage(error), { durationMs: t(rs) });
    // brief backoff, then a single automatic retry
    await new Promise((r) => setTimeout(r, 1500));
    rs = performance.now();
    ({ data: rpcData, error } = await attempt());
  }

  if (error) {
    if (isRpcUnavailable(error)) {
      const s = performance.now();
      const res = await setReceiptSerialStartDirect(nextSerial);
      logDiagnostic("/api/db receipt_settings (fallback)", res.ok ? "fallback" : "error", res.ok ? "RPC/endpoint unavailable — direct table fallback ব্যবহার করা হলো" : res.message, { durationMs: t(s), usedFallback: true });
      return res.ok ? { ...res, value: nextSerial } : res;
    }
    logDiagnostic("/api/rpc/admin_set_receipt_serial_start", "error", error.message, { durationMs: t(rs) });
    return { ok: false, message: error.message };
  }
  // The RPC returns the newly stored serial start.
  const stored = Number(rpcData);
  logDiagnostic("/api/rpc/admin_set_receipt_serial_start", "ok", functionUnavailable ? "RPC fallback succeeded" : "Serial start updated", { durationMs: t(rs) });
  return { ok: true, message: "Serial start updated", value: Number.isFinite(stored) ? stored : nextSerial };
}

/** Bilingual (Bangla / English) toast content shown when the serial save
 * cannot be confirmed — e.g. the RPC/edge returned a null value and the DB
 * fallback did not match the expected next serial. Extracted for testability. */
export function serialSaveUnconfirmedToast(
  nextSerial: number,
  persisted: number | null | undefined,
): { title: string; description: string } {
  const got = persisted != null && Number.isFinite(persisted) ? persisted : "—";
  return {
    title: "ক্রমিক নম্বর ডাটাবেসে সংরক্ষণ নিশ্চিত করা যায়নি / Could not confirm the serial number was saved",
    description: `প্রত্যাশিত ${nextSerial}, সার্ভার থেকে পাওয়া গেছে ${got}। অনুগ্রহ করে আবার চেষ্টা করুন। / Expected ${nextSerial}, server returned ${got}. Please try again.`,
  };
}
