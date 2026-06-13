import type { FastifyInstance } from "fastify";
import type { createIndexLinksQueue } from "../../queue/index-links.js";

type Dependencies = {
  indexLinksQueue: ReturnType<typeof createIndexLinksQueue>;
};

export function registerIndexLinksRoute(app: FastifyInstance, deps: Dependencies): void {
  const { indexLinksQueue } = deps;

  app.post<{ Body: { symbolId?: string | null } }>("/api/graph/index/links", async (request, reply) => {
    const job = await indexLinksQueue.add(request.body?.symbolId ?? null);

    return reply.status(202).send({
      ok: true,
      status: job.state,
      jobId: job.id,
      message: "Package linking request accepted."
    });
  });
}
