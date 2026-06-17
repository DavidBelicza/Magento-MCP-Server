import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import { isFullIndexLocked } from "../../modules/index-lock.js";
import type { createIndexStatus } from "../../modules/index-status.js";

type Dependencies = {
  indexStatus: ReturnType<typeof createIndexStatus>;
  redis: Redis;
};

export function registerIndexStatusRoute(app: FastifyInstance, deps: Dependencies): void {
  const { indexStatus, redis } = deps;

  app.get("/api/graph/index/status", async (_request, reply) => {
    const items = await indexStatus.getInProgress();

    return reply.send({
      ok: true,
      inProgress: items.length,
      locked: await isFullIndexLocked(redis),
      items
    });
  });

  app.get<{ Params: { jobId: string }; Querystring: { queue?: string } }>(
    "/api/graph/index/status/:jobId",
    async (request, reply) => {
      const job = await indexStatus.getJob(request.params.jobId, request.query.queue);

      if (!job) {
        return reply.status(404).send({
          ok: false,
          error: "job not found"
        });
      }

      return reply.send({
        ok: true,
        job
      });
    }
  );
}
