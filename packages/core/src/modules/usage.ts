import type { Redis } from "ioredis";

const usageKey = "usage:last";
const idleWindowSeconds = 120;

export type UsageStatus = {
  connected: boolean;
  lastSeenAt: number | null;
};

export async function recordUsage(redis: Redis): Promise<void> {
  await redis.set(usageKey, Date.now().toString(), "EX", idleWindowSeconds);
}

export async function getUsage(redis: Redis): Promise<UsageStatus> {
  const value = await redis.get(usageKey);

  if (!value) {
    return { connected: false, lastSeenAt: null };
  }

  const lastSeenAt = Number(value);

  return {
    connected: true,
    lastSeenAt: Number.isFinite(lastSeenAt) ? lastSeenAt : null
  };
}
