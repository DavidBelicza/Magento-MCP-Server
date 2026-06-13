import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { getQueryHistory, listQueryHistory } from "../../modules/search/query-history.js";
import { buildGraphSearchResult } from "../../modules/search/result-builder.js";

type Dependencies = {
  postgres: Pool;
};

export function registerGetQueryHistoryRoute(app: FastifyInstance, deps: Dependencies): void {
  const { postgres } = deps;

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
