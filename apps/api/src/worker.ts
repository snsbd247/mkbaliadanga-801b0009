/**
 * Background worker — BullMQ consumer skeleton.
 * Add SMS retries, scheduled QR rotations, ledger reconciles, etc. here.
 */
import { Worker, QueueEvents } from "bullmq";
import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://redis:6379";
const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

const worker = new Worker(
  "default",
  async (job) => {
    console.log(`[worker] job ${job.name} (${job.id})`, job.data);
    return { ok: true };
  },
  { connection }
);

worker.on("ready",  () => console.log("[worker] ready"));
worker.on("failed", (job, err) => console.error("[worker] failed", job?.id, err.message));

new QueueEvents("default", { connection });
