import type { FastifyInstance } from "fastify";
import type { Driver } from "neo4j-driver";

type Dependencies = {
  neo4jDriver: Driver;
};

export function registerGraphStatsRoute(app: FastifyInstance, deps: Dependencies): void {
  const { neo4jDriver } = deps;

  app.get("/api/graph/stats", async (_request, reply) => {
    const session = neo4jDriver.session();

    try {
      const nodes = await session.run(
        "MATCH (n) RETURN coalesce(head(labels(n)), 'Unknown') AS label, count(*) AS count ORDER BY count DESC"
      );
      const edges = await session.run("MATCH ()-[r]->() RETURN count(r) AS count");

      const byLabel = nodes.records.map((record) => ({
        label: record.get("label") as string,
        count: (record.get("count") as { toNumber: () => number }).toNumber()
      }));

      return reply.send({
        ok: true,
        nodeCount: byLabel.reduce((sum, item) => sum + item.count, 0),
        relationshipCount: (edges.records[0]?.get("count") as { toNumber: () => number } | undefined)?.toNumber() ?? 0,
        byLabel
      });
    } catch (error) {
      app.log.error(error);

      return reply.status(500).send({ ok: false, error: "failed to read graph stats" });
    } finally {
      await session.close();
    }
  });
}
