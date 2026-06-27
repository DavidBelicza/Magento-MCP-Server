import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import type { Pool } from "pg";
import { getAppSettings } from "../../modules/app-config.js";
import { isGraphIndexLocked, isVectorIndexLocked } from "../../modules/index-lock.js";
import { getIndexRunState } from "../../modules/index-run-state.js";
import type { createIndexStatus } from "../../modules/index-status.js";
import { getUsage } from "../../modules/usage.js";

type Dependencies = {
  indexStatus: ReturnType<typeof createIndexStatus>;
  vectorIndexStatus: ReturnType<typeof createIndexStatus>;
  redis: Redis;
  postgres: Pool;
};

export function registerStatusRoute(app: FastifyInstance, deps: Dependencies): void {
  const { indexStatus, vectorIndexStatus, redis, postgres } = deps;

  app.get("/api/status", async (_request, reply) => {
    try {
      const [inProgress, locked, vectorInProgress, vectorLocked, agent, runState] = await Promise.all([
        indexStatus.getInProgress(),
        isGraphIndexLocked(redis),
        vectorIndexStatus.getInProgress(),
        isVectorIndexLocked(redis),
        getUsage(redis),
        getIndexRunState(postgres)
      ]);

      return reply.send({
        ok: true,
        indexing: { inProgress: inProgress.length, locked, items: inProgress },
        vector: { inProgress: vectorInProgress.length, locked: vectorLocked, items: vectorInProgress },
        indexed: (runState?.nodeCount ?? 0) > 0,
        agent,
        watcherEnabled: getAppSettings().watcherEnabled
      });
    } catch (error) {
      app.log.error(error);

      return reply.status(500).send({ ok: false, error: "failed to read status" });
    }
  });
}
