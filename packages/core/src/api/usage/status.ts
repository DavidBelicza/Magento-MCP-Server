import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import { getAppSettings } from "../../modules/app-config.js";
import { isFullIndexLocked } from "../../modules/index-lock.js";
import type { createIndexStatus } from "../../modules/index-status.js";
import { getUsage } from "../../modules/usage.js";

type Dependencies = {
  indexStatus: ReturnType<typeof createIndexStatus>;
  redis: Redis;
};

export function registerStatusRoute(app: FastifyInstance, deps: Dependencies): void {
  const { indexStatus, redis } = deps;

  app.get("/api/status", async (_request, reply) => {
    try {
      const [inProgress, locked, agent] = await Promise.all([
        indexStatus.getInProgress(),
        isFullIndexLocked(redis),
        getUsage(redis)
      ]);

      return reply.send({
        ok: true,
        indexing: { inProgress: inProgress.length, locked, items: inProgress },
        agent,
        watcherEnabled: getAppSettings().watcherEnabled
      });
    } catch (error) {
      app.log.error(error);

      return reply.status(500).send({ ok: false, error: "failed to read status" });
    }
  });
}
