import type { Redis } from "ioredis";

const activeKey = "usage:active";
const lastSeenKey = "usage:lastSeen";
const idleWindowSeconds = 120;

export type UsageStatus = {
  connected: boolean;
  lastSeenAt: number | null;
};

export async function recordUsage(redis: Redis): Promise<void> {
  const now = Date.now().toString();

  await Promise.all([
    redis.set(activeKey, now, "EX", idleWindowSeconds),
    redis.set(lastSeenKey, now)
  ]);
}

export async function getUsage(redis: Redis): Promise<UsageStatus> {
  const [active, lastSeen] = await Promise.all([redis.exists(activeKey), redis.get(lastSeenKey)]);

  const lastSeenAt = lastSeen === null ? null : Number(lastSeen);

  return {
    connected: active === 1,
    lastSeenAt: lastSeenAt !== null && Number.isFinite(lastSeenAt) ? lastSeenAt : null
  };
}
