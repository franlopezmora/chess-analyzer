import { Redis } from "@upstash/redis";

export type AnalysisJobPayload = {
  gameId: string;
};

const queueKey =
  process.env.ANALYSIS_QUEUE_KEY ?? "chess:analyzer:analysis-jobs";

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

export async function enqueueAnalysisJob(
  payload: AnalysisJobPayload,
): Promise<boolean> {
  if (!redis) {
    return false;
  }

  await redis.rpush(queueKey, JSON.stringify(payload));
  return true;
}

export async function dequeueAnalysisJob(): Promise<
  AnalysisJobPayload | null
> {
  if (!redis) {
    return null;
  }

  const raw = await redis.lpop<string>(queueKey);
  return raw ? (JSON.parse(raw) as AnalysisJobPayload) : null;
}

export function isQueueEnabled() {
  return Boolean(redis);
}

