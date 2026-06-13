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

export function registerIndexResetAndReindexRoute(app: FastifyInstance, deps: Dependencies): void {
  const { indexFlowProducer, redis, getAnalyzedSourcePath } = deps;

  app.post("/api/graph/index/reset-and-reindex", async (_request, reply) => {
    if (!(await acquireFullIndexLock(redis))) {
      return reply.status(409).send({
        ok: false,
        error: "a reset or full reindex is already in progress"
      });
    }

    const flow = await indexFlowProducer.add(buildIndexFlow(getAnalyzedSourcePath(), true));

    return reply.status(202).send({
      ok: true,
      jobId: flow.job.id,
      message: "Reset and reindex request accepted."
    });
  });
}
