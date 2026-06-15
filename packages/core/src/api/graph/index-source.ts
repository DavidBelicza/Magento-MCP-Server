import type { FastifyInstance } from "fastify";
import type { createIndexSourceQueue } from "../../queue/index-source.js";

type Dependencies = {
  indexSourceQueue: ReturnType<typeof createIndexSourceQueue>;
  getAnalyzedSourcePath: () => string;
  getPhpVersion: () => string;
};

export function registerIndexSourceRoute(app: FastifyInstance, deps: Dependencies): void {
  const { indexSourceQueue, getAnalyzedSourcePath, getPhpVersion } = deps;

  app.post<{ Body: { directories?: unknown[] | null } }>("/api/graph/index/source", async (request, reply) => {
    const jobs = await indexSourceQueue.add(getAnalyzedSourcePath(), request.body?.directories ?? null, "index", getPhpVersion());

    return reply.status(202).send({
      ok: true,
      jobs,
      message: "Source indexing request accepted."
    });
  });

  app.delete<{ Body: { directories?: unknown[] | null } }>("/api/graph/index/source", async (request, reply) => {
    const directories = request.body?.directories;

    if (!Array.isArray(directories) || directories.length === 0) {
      return reply.status(400).send({
        ok: false,
        error: "directories is required and must be a non-empty array for deletion"
      });
    }

    const jobs = await indexSourceQueue.add(getAnalyzedSourcePath(), directories, "delete");

    return reply.status(202).send({
      ok: true,
      jobs,
      message: "Source deletion request accepted."
    });
  });
}
