import type { Redis } from "ioredis";

const fullIndexLockKey = "magentic:full-index:lock";
const fullIndexLockTtlSeconds = 3600;

export async function acquireFullIndexLock(redis: Redis): Promise<boolean> {
  const result = await redis.set(fullIndexLockKey, "1", "EX", fullIndexLockTtlSeconds, "NX");

  return result === "OK";
}

export async function releaseFullIndexLock(redis: Redis): Promise<void> {
  await redis.del(fullIndexLockKey);
}

export async function isFullIndexLocked(redis: Redis): Promise<boolean> {
  return (await redis.exists(fullIndexLockKey)) === 1;
}
