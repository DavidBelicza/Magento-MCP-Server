import type { FlowProducer } from "bullmq";
import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import { acquireGraphIndexLock } from "../../modules/index-lock.js";
import { buildIndexFlow } from "./build-index-flow.js";

type Dependencies = {
  indexFlowProducer: FlowProducer;
  redis: Redis;
  getComposerRoot: () => string;
  getMountPath: () => string;
  getSourceDirectories: () => string[];
  getPhpVersion: () => string;
};

export function registerIndexResetAndReindexRoute(app: FastifyInstance, deps: Dependencies): void {
  const { indexFlowProducer, redis, getComposerRoot, getMountPath, getSourceDirectories, getPhpVersion } = deps;

  app.post("/api/graph/index/reset-and-reindex", async (_request, reply) => {
    if (!(await acquireGraphIndexLock(redis))) {
      return reply.status(409).send({
        ok: false,
        error: "a graph reindex or reset is already in progress"
      });
    }

    const flow = await indexFlowProducer.add(
      buildIndexFlow(getComposerRoot(), getMountPath(), getSourceDirectories(), true, getPhpVersion())
    );

    return reply.status(202).send({
      ok: true,
      jobId: flow.job.id,
      message: "Reset and reindex request accepted."
    });
  });
}
