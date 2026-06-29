import type { Redis } from "ioredis";
import type { Pool } from "pg";
import { getAppSettings } from "../app-config.js";
import { isGraphIndexLocked, isVectorIndexLocked } from "../index-lock.js";
import { getIndexRunState } from "../index-run-state.js";
import type { createIndexStatus } from "../index-status.js";
import { getUsage } from "../usage.js";

type Dependencies = {
  indexStatus: ReturnType<typeof createIndexStatus>;
  vectorIndexStatus: ReturnType<typeof createIndexStatus>;
  redis: Redis;
  postgres: Pool;
};

export async function buildStatusSnapshot(deps: Dependencies) {
  const { indexStatus, vectorIndexStatus, redis, postgres } = deps;

  const [inProgress, locked, vectorInProgress, vectorLocked, agent, runState] = await Promise.all([
    indexStatus.getInProgress(),
    isGraphIndexLocked(redis),
    vectorIndexStatus.getInProgress(),
    isVectorIndexLocked(redis),
    getUsage(redis),
    getIndexRunState(postgres)
  ]);

  return {
    indexing: { inProgress: inProgress.length, locked, items: inProgress },
    vector: { inProgress: vectorInProgress.length, locked: vectorLocked, items: vectorInProgress },
    indexed: (runState?.nodeCount ?? 0) > 0,
    agent,
    watcherEnabled: getAppSettings().watcherEnabled
  };
}
