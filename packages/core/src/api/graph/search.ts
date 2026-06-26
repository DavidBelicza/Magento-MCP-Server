import type { FastifyInstance } from "fastify";
import type { Driver } from "neo4j-driver";
import type { Pool } from "pg";
import { GraphSearchQueryError, GraphSearchValidationError, searchGraph } from "../../modules/graph/search/index.js";
import { saveQueryHistory } from "../../modules/search/query-history.js";
import { buildGraphSearchResult } from "../../modules/search/result-builder.js";

type Dependencies = {
  postgres: Pool;
  neo4jDriver: Driver;
};

export function registerSearchRoute(app: FastifyInstance, deps: Dependencies): void {
  const { postgres, neo4jDriver } = deps;

  app.post<{ Body: { description?: unknown; cypherQuery?: unknown } }>("/api/graph/search", async (request, reply) => {
    const description = typeof request.body?.description === "string" ? request.body.description : "";
    const cypherQuery = typeof request.body?.cypherQuery === "string" ? request.body.cypherQuery : "";

    if (!description.trim()) {
      return reply.status(400).send({
        ok: false,
        error: "description is required"
      });
    }

    if (!cypherQuery.trim()) {
      return reply.status(400).send({
        ok: false,
        error: "cypherQuery is required"
      });
    }

    try {
      const result = await searchGraph(neo4jDriver, cypherQuery);
      const historyId = await saveQueryHistory(postgres, {
        description,
        cypherQuery,
        result
      });
      const structuredResult = buildGraphSearchResult(result);

      return {
        ok: true,
        historyId,
        description,
        cypherQuery,
        result,
        structuredResult
      };
    } catch (error) {
      if (error instanceof GraphSearchValidationError || error instanceof GraphSearchQueryError) {
        return reply.status(400).send({
          ok: false,
          error: error.message
        });
      }

      app.log.error(error);

      return reply.status(500).send({
        ok: false,
        error: "Graph search failed"
      });
    }
  });
}
