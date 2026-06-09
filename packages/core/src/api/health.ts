import type { FastifyInstance } from "fastify";
import type { Driver } from "neo4j-driver";
import type { Pool } from "pg";
import type { createRedisConnection } from "../connections.js";

type HealthApiDependencies = {
  redis: ReturnType<typeof createRedisConnection>;
  postgres: Pool;
  neo4jDriver: Driver;
};

export function registerHealthApi(app: FastifyInstance, dependencies: HealthApiDependencies): void {
  const { redis, postgres, neo4jDriver } = dependencies;

  app.get("/api/health", async () => {
    const [redisStatus, postgresStatus, neo4jStatus] = await Promise.allSettled([
      redis.ping(),
      postgres.query("SELECT 1"),
      neo4jDriver.verifyConnectivity()
    ]);

    return {
      ok: redisStatus.status === "fulfilled" && postgresStatus.status === "fulfilled" && neo4jStatus.status === "fulfilled",
      service: "backend",
      redis: redisStatus.status === "fulfilled" ? "ok" : "error",
      postgres: postgresStatus.status === "fulfilled" ? "ok" : "error",
      graphdb: neo4jStatus.status === "fulfilled" ? "ok" : "error"
    };
  });
}
