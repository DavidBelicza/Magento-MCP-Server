import type { FastifyInstance } from "fastify";
import type { createIndexPackagesQueue } from "../queue/index-packages.js";
import type { createIndexSourceQueue } from "../queue/index-source.js";

type IndexApiDependencies = {
  indexPackagesQueue: ReturnType<typeof createIndexPackagesQueue>;
  indexSourceQueue: ReturnType<typeof createIndexSourceQueue>;
  getAnalyzedSourcePath: () => string;
};

export function registerIndexApi(app: FastifyInstance, dependencies: IndexApiDependencies): void {
  const { indexPackagesQueue, indexSourceQueue, getAnalyzedSourcePath } = dependencies;

  app.post("/api/index/packages", async (_request, reply) => {
    const job = await indexPackagesQueue.add(getAnalyzedSourcePath());

    return reply.status(202).send({
      ok: true,
      status: job.state,
      jobId: job.id,
      message: "Package indexing request accepted."
    });
  });

  app.post<{ Body: { directories?: unknown[] | null } }>("/api/index/source", async (request, reply) => {
    const jobs = await indexSourceQueue.add(
      getAnalyzedSourcePath(),
      request.body?.directories ?? null
    );

    return reply.status(202).send({
      ok: true,
      jobs,
      message: "Source indexing request accepted."
    });
  });

  app.get<{ Querystring: { jobId?: string } }>("/api/index/get-status", async (request, reply) => {
    const jobId = request.query.jobId;

    if (!jobId) {
      return reply.status(400).send({
        ok: false,
        error: "jobId is required"
      });
    }

    const job = await indexPackagesQueue.getStatus(jobId);

    if (!job) {
      return reply.status(404).send({
        ok: false,
        error: "job not found"
      });
    }

    return {
      ok: true,
      jobId: job.id,
      status: job.state,
      message: "Index status loaded."
    };
  });
}
