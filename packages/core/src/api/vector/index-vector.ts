import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import { acquireVectorIndexLock } from "../../modules/index-lock.js";
import type { createIndexVectorQueue } from "../../queue/index-vector.js";

type Dependencies = {
  indexVectorQueue: ReturnType<typeof createIndexVectorQueue>;
  redis: Redis;
  getMountPath: () => string;
  getSourceDirectories: () => string[];
};

export function registerIndexVectorRoute(app: FastifyInstance, deps: Dependencies): void {
  const { indexVectorQueue, redis, getMountPath, getSourceDirectories } = deps;

  app.post("/api/vector/index", async (_request, reply) => {
    if (!(await acquireVectorIndexLock(redis))) {
      return reply.status(409).send({
        ok: false,
        error: "a vector reindex or reset is already in progress"
      });
    }

    const job = await indexVectorQueue.add(getMountPath(), getSourceDirectories(), "index");

    return reply.status(202).send({
      ok: true,
      job,
      message: "Vector indexing request accepted."
    });
  });

  app.post("/api/vector/reset-and-index", async (_request, reply) => {
    if (!(await acquireVectorIndexLock(redis))) {
      return reply.status(409).send({
        ok: false,
        error: "a vector reindex or reset is already in progress"
      });
    }

    const job = await indexVectorQueue.add(getMountPath(), getSourceDirectories(), "reset-and-index");

    return reply.status(202).send({
      ok: true,
      job,
      message: "Vector reset and reindex request accepted."
    });
  });
}
