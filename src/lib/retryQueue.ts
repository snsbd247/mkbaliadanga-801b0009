import { db } from "@/lib/db";
export type RetryJobType =
  | "receipt_generation"
  | "sms_send"
  | "sms_delivery_check"
  | "report_export";

export type RetryJobStatus =
  | "pending"
  | "retrying"
  | "succeeded"
  | "failed"
  | "permanently_failed";

const SCHEDULE_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];

export function nextRetryAt(attempt: number, base: Date = new Date()): Date {
  const idx = Math.min(Math.max(attempt, 0), SCHEDULE_MS.length - 1);
  return new Date(base.getTime() + SCHEDULE_MS[idx]);
}

export interface EnqueueOpts {
  jobType: RetryJobType;
  referenceId?: string | null;
  payload?: Record<string, unknown>;
  officeId?: string | null;
  maxRetry?: number;
  lastError?: string;
}

export async function enqueueRetryJob(opts: EnqueueOpts) {
  const { data, error } = await db
    .from("background_retry_jobs")
    .insert({
      job_type: opts.jobType,
      reference_id: opts.referenceId ?? null,
      payload: opts.payload ?? {},
      office_id: opts.officeId ?? null,
      max_retry: opts.maxRetry ?? 4,
      next_retry_at: nextRetryAt(0).toISOString(),
      last_error: opts.lastError ?? null,
      status: "pending",
    } as any)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data?.id as string | undefined;
}

export async function markJobSuccess(id: string) {
  await db
    .from("background_retry_jobs")
    .update({ status: "succeeded", last_error: null } as any)
    .eq("id", id);
}

export async function markJobFailed(id: string, errMsg: string) {
  const { data: row } = await db
    .from("background_retry_jobs")
    .select("retry_count, max_retry")
    .eq("id", id)
    .maybeSingle();
  const attempt = (row?.retry_count ?? 0) + 1;
  const exhausted = attempt > (row?.max_retry ?? 4);
  await db
    .from("background_retry_jobs")
    .update({
      status: exhausted ? "permanently_failed" : "retrying",
      retry_count: attempt,
      next_retry_at: nextRetryAt(attempt - 1).toISOString(),
      last_error: errMsg.slice(0, 4000),
    } as any)
    .eq("id", id);
}

export async function manualRetry(id: string) {
  await db
    .from("background_retry_jobs")
    .update({
      status: "pending",
      next_retry_at: new Date().toISOString(),
    } as any)
    .eq("id", id);
}

/** Wraps a side-effect (SMS, PDF) so failure enqueues a retry job and never throws. */
export async function safeWithRetry<T>(
  jobType: RetryJobType,
  fn: () => Promise<T>,
  ctx: { referenceId?: string | null; payload?: Record<string, unknown>; officeId?: string | null },
): Promise<{ ok: boolean; result?: T; error?: string; jobId?: string }> {
  try {
    const result = await fn();
    return { ok: true, result };
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    try {
      const jobId = await enqueueRetryJob({
        jobType,
        referenceId: ctx.referenceId,
        payload: ctx.payload,
        officeId: ctx.officeId,
        lastError: msg,
      });
      return { ok: false, error: msg, jobId };
    } catch {
      return { ok: false, error: msg };
    }
  }
}
