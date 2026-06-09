import type { FastifyInstance } from "fastify";
import type { Driver } from "neo4j-driver";
import type { Pool } from "pg";
import { GraphSearchValidationError, searchGraph } from "../modules/graph/search/index.js";
import { getQueryHistory, listQueryHistory, saveQueryHistory } from "../modules/search/query-history.js";
import { buildGraphSearchResult } from "../modules/search/result-builder.js";

type GraphApiDependencies = {
  postgres: Pool;
  neo4jDriver: Driver;
};

export function registerGraphApi(app: FastifyInstance, dependencies: GraphApiDependencies): void {
  const { postgres, neo4jDriver } = dependencies;

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
      if (error instanceof GraphSearchValidationError) {
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

  app.get("/api/graph/get-query-history", async (_request, reply) => {
    try {
      const items = await listQueryHistory(postgres);

      return {
        ok: true,
        items
      };
    } catch (error) {
      app.log.error(error);

      return reply.status(500).send({
        ok: false,
        error: "Query history could not be loaded"
      });
    }
  });

  app.get<{ Params: { id: string } }>("/api/graph/get-query-history/:id", async (request, reply) => {
    try {
      const history = await getQueryHistory(postgres, request.params.id);

      if (!history) {
        return reply.status(404).send({
          ok: false,
          error: "Query history item not found"
        });
      }

      return {
        ok: true,
        ...history,
        structuredResult: buildGraphSearchResult(history.result)
      };
    } catch (error) {
      app.log.error(error);

      return reply.status(500).send({
        ok: false,
        error: "Query history item could not be loaded"
      });
    }
  });
}
