/**
 * BullMQ wrapper — opt-in when REDIS_URL + DEBRIEF_USE_BULLMQ=1.
 */
import { Queue } from "bullmq";
import Redis from "ioredis";

let _queue: Queue | null = null;

export const redisConnectionOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  /** Avoid eager TCP during module/init; errors surface on first command instead of crashing the process. */
  lazyConnect: true,
  retryStrategy(times: number) {
    if (times > 10) return null;
    return Math.min(times * 200, 3000);
  },
} as const;

function attachRedisLogging(r: Redis, label: string) {
  r.on("error", (err) => {
    console.error(`[redis:${label}]`, err.message);
  });
}

/** New ioredis instance per BullMQ component (Queue vs Worker). */
export function createRedisConnection(): Redis | null {
  const url = process.env.REDIS_URL?.trim();
  if (process.env.DEBRIEF_USE_BULLMQ === "1" && !url) {
    console.warn(
      "[redis] DEBRIEF_USE_BULLMQ=1 but REDIS_URL is empty — analyzer queue disabled until Redis is configured.",
    );
    return null;
  }
  if (!url || process.env.DEBRIEF_USE_BULLMQ !== "1") return null;
  const r = new Redis(url, { ...redisConnectionOptions });
  attachRedisLogging(r, "bullmq");
  return r;
}

// Retention kept low — Render Redis free tier is 25MB cap, no persistence.
// Do not raise these without upgrading Redis tier first.
const defaultJobOptions = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 2000 },
  removeOnComplete: { count: 10 },
  removeOnFail: { count: 5 },
};

export function analyzerQueue(): Queue | null {
  if (_queue) return _queue;
  const connection = createRedisConnection();
  if (!connection) return null;
  _queue = new Queue("debrief-analyzer", {
    connection,
    defaultJobOptions,
  });
  return _queue;
}

export function useQueueForAnalyzer(): boolean {
  return analyzerQueue() !== null;
}
