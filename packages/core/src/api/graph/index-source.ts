import type { FastifyInstance } from "fastify";
import type { createIndexSourceQueue } from "../../queue/index-source.js";

type Dependencies = {
  indexSourceQueue: ReturnType<typeof createIndexSourceQueue>;
  getMountPath: () => string;
  getSourceDirectories: () => string[];
  getPhpVersion: () => string;
};

function toStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

export function registerIndexSourceRoute(app: FastifyInstance, deps: Dependencies): void {
  const { indexSourceQueue, getMountPath, getSourceDirectories, getPhpVersion } = deps;

  app.post<{ Body: { directories?: unknown[] | null } }>("/api/graph/index/source", async (request, reply) => {
    const requested = toStringList(request.body?.directories);
    const directories = requested.length > 0 ? requested : getSourceDirectories();
    const job = await indexSourceQueue.add(getMountPath(), directories, "index", getPhpVersion());

    return reply.status(202).send({
      ok: true,
      job,
      message: "Source indexing request accepted."
    });
  });

  app.delete<{ Body: { directories?: unknown[] | null } }>("/api/graph/index/source", async (request, reply) => {
    const directories = toStringList(request.body?.directories);

    if (directories.length === 0) {
      return reply.status(400).send({
        ok: false,
        error: "directories is required and must be a non-empty array for deletion"
      });
    }

    const job = await indexSourceQueue.add(getMountPath(), directories, "delete");

    return reply.status(202).send({
      ok: true,
      job,
      message: "Source deletion request accepted."
    });
  });
}
