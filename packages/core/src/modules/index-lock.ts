import type { Redis } from "ioredis";

const graphIndexLockKey = "magentic:graph-index:lock";
const vectorIndexLockKey = "magentic:vector-index:lock";
const indexLockTtlSeconds = 3600;

export async function acquireGraphIndexLock(redis: Redis): Promise<boolean> {
  const result = await redis.set(graphIndexLockKey, "1", "EX", indexLockTtlSeconds, "NX");

  return result === "OK";
}

export async function releaseGraphIndexLock(redis: Redis): Promise<void> {
  await redis.del(graphIndexLockKey);
}

export async function isGraphIndexLocked(redis: Redis): Promise<boolean> {
  return (await redis.exists(graphIndexLockKey)) === 1;
}

export async function acquireVectorIndexLock(redis: Redis): Promise<boolean> {
  const result = await redis.set(vectorIndexLockKey, "1", "EX", indexLockTtlSeconds, "NX");

  return result === "OK";
}

export async function releaseVectorIndexLock(redis: Redis): Promise<void> {
  await redis.del(vectorIndexLockKey);
}

export async function isVectorIndexLocked(redis: Redis): Promise<boolean> {
  return (await redis.exists(vectorIndexLockKey)) === 1;
}
