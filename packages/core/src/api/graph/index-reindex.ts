import type { FlowProducer } from "bullmq";
import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import { acquireFullIndexLock } from "../../modules/index-lock.js";
import { buildIndexFlow } from "./build-index-flow.js";

type Dependencies = {
  indexFlowProducer: FlowProducer;
  redis: Redis;
  getAnalyzedSourcePath: () => string;
};

export function registerIndexReindexRoute(app: FastifyInstance, deps: Dependencies): void {
  const { indexFlowProducer, redis, getAnalyzedSourcePath } = deps;

  app.post("/api/graph/index/reindex", async (_request, reply) => {
    if (!(await acquireFullIndexLock(redis))) {
      return reply.status(409).send({
        ok: false,
        error: "a reset or full reindex is already in progress"
      });
    }

    const flow = await indexFlowProducer.add(buildIndexFlow(getAnalyzedSourcePath(), false));

    return reply.status(202).send({
      ok: true,
      jobId: flow.job.id,
      message: "Reindex request accepted."
    });
  });
}
