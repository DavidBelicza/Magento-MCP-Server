import type { FastifyInstance } from "fastify";
import type { createIndexPackagesQueue } from "../../queue/index-packages.js";

type Dependencies = {
  indexPackagesQueue: ReturnType<typeof createIndexPackagesQueue>;
  getAnalyzedSourcePath: () => string;
};

export function registerIndexPackagesRoute(app: FastifyInstance, deps: Dependencies): void {
  const { indexPackagesQueue, getAnalyzedSourcePath } = deps;

  app.post("/api/graph/index/packages", async (_request, reply) => {
    const job = await indexPackagesQueue.add(getAnalyzedSourcePath());

    return reply.status(202).send({
      ok: true,
      status: job.state,
      jobId: job.id,
      message: "Package indexing request accepted."
    });
  });
}
