import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { searchConfigVector } from "../../modules/processing/store-config/search-config-vector.js";
import type { EmbeddingConfig } from "../../modules/vector/embedding/types.js";

type Dependencies = {
  pgVector: Pool;
  getEmbeddingConfig: () => EmbeddingConfig;
};

export function registerVectorSearchRoute(app: FastifyInstance, deps: Dependencies): void {
  const { pgVector, getEmbeddingConfig } = deps;

  app.post<{ Body: { query?: unknown; limit?: unknown } }>("/api/vector/search", async (request, reply) => {
    const query = typeof request.body?.query === "string" ? request.body.query.trim() : "";

    if (query === "") {
      return reply.status(400).send({ ok: false, error: "query is required" });
    }

    try {
      const results = await searchConfigVector(query, pgVector, getEmbeddingConfig(), normalizeLimit(request.body?.limit));

      return { ok: true, results };
    } catch (error) {
      app.log.error(error);

      return reply.status(500).send({ ok: false, error: "Vector search failed" });
    }
  });
}

function normalizeLimit(value: unknown): number {
  const limit = typeof value === "number" ? Math.floor(value) : 5;

  return Math.min(Math.max(limit, 1), 20);
}
