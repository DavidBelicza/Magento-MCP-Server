import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import type { Pool } from "pg";
import { buildStatusSnapshot } from "../modules/stream/build-status-snapshot.js";
import type { createIndexStatus } from "../modules/index-status.js";

type Dependencies = {
  indexStatus: ReturnType<typeof createIndexStatus>;
  vectorIndexStatus: ReturnType<typeof createIndexStatus>;
  redis: Redis;
  postgres: Pool;
};

export function registerStatusRoute(app: FastifyInstance, deps: Dependencies): void {
  app.get("/api/status", async (_request, reply) => {
    try {
      const snapshot = await buildStatusSnapshot(deps);

      return reply.send({ ok: true, ...snapshot });
    } catch (error) {
      app.log.error(error);

      return reply.status(500).send({ ok: false, error: "failed to read status" });
    }
  });
}
