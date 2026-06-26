import type { FastifyInstance } from "fastify";
import type { createIndexXmlQueue } from "../../queue/index-xml.js";

type Dependencies = {
  indexXmlQueue: ReturnType<typeof createIndexXmlQueue>;
  getMountPath: () => string;
  getSourceDirectories: () => string[];
};

function toStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

export function registerIndexXmlRoute(app: FastifyInstance, deps: Dependencies): void {
  const { indexXmlQueue, getMountPath, getSourceDirectories } = deps;

  app.post<{ Body: { directories?: unknown[] | null } }>("/api/graph/index/xml", async (request, reply) => {
    const requested = toStringList(request.body?.directories);
    const directories = requested.length > 0 ? requested : getSourceDirectories();
    const job = await indexXmlQueue.add(getMountPath(), directories, "index");

    return reply.status(202).send({
      ok: true,
      job,
      message: "XML indexing request accepted."
    });
  });

  app.delete<{ Body: { directories?: unknown[] | null } }>("/api/graph/index/xml", async (request, reply) => {
    const directories = toStringList(request.body?.directories);

    if (directories.length === 0) {
      return reply.status(400).send({
        ok: false,
        error: "directories is required and must be a non-empty array for deletion"
      });
    }

    const job = await indexXmlQueue.add(getMountPath(), directories, "delete");

    return reply.status(202).send({
      ok: true,
      job,
      message: "XML deletion request accepted."
    });
  });
}
