import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import { acquireVectorIndexLock } from "../../modules/index-lock.js";
import { isStoreConfigXml } from "../../modules/processing/store-config/is-store-config-xml.js";
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

export function registerVectorIndexDeltaRoute(app: FastifyInstance, deps: Dependencies): void {
  const { indexVectorQueue, redis, getMountPath, getSourceDirectories, getEmbeddingConfig } = deps;

  app.post<{ Body: { paths?: unknown } }>("/api/vector/index/delta", async (request, reply) => {
    const paths = request.body?.paths;

    if (Array.isArray(paths) && !paths.some((path) => typeof path === "string" && isStoreConfigXml(path))) {
      return reply.status(200).send({
        ok: true,
        skipped: true,
        message: "No store configuration files changed."
      });
    }

    if (!(await acquireVectorIndexLock(redis))) {
      return reply.status(409).send({
        ok: false,
        error: "a vector reindex or reset is already in progress"
      });
    }

    const job = await indexVectorQueue.add(getMountPath(), getSourceDirectories(), getEmbeddingConfig(), "delta");

    publishStatusEvent(redis, { type: "index" });

    return reply.status(202).send({
      ok: true,
      job,
      message: "Vector delta update request accepted."
    });
  });
}
