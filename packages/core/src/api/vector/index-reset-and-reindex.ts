import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import { acquireVectorIndexLock } from "../../modules/index-lock.js";
import { publishStatusEvent } from "../../modules/stream/status-events.js";
import type { EmbeddingConfig } from "../../modules/vector/embedding/types.js";
import type { createIndexVectorQueue } from "../../queue/index-vector.js";

type Dependencies = {
  indexVectorQueue: ReturnType<typeof createIndexVectorQueue>;
  redis: Redis;
  getMountPath: () => string;
  getSourceDirectories: () => string[];
  getEmbeddingConfig: () => EmbeddingConfig;
};

export function registerVectorIndexResetAndReindexRoute(app: FastifyInstance, deps: Dependencies): void {
  const { indexVectorQueue, redis, getMountPath, getSourceDirectories, getEmbeddingConfig } = deps;

  app.post("/api/vector/index/reset-and-reindex", async (_request, reply) => {
    if (!(await acquireVectorIndexLock(redis))) {
      return reply.status(409).send({
        ok: false,
        error: "a vector reindex or reset is already in progress"
      });
    }

    const job = await indexVectorQueue.add(getMountPath(), getSourceDirectories(), getEmbeddingConfig(), "reset-and-index");

    publishStatusEvent(redis, { type: "index" });

    return reply.status(202).send({
      ok: true,
      job,
      message: "Vector reset and reindex request accepted."
    });
  });
}
