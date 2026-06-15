import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import { recordUsage } from "../../modules/usage.js";

type Dependencies = {
  redis: Redis;
};

export function registerUsagePingRoute(app: FastifyInstance, deps: Dependencies): void {
  const { redis } = deps;

  app.post("/api/usage/ping", async (_request, reply) => {
    try {
      await recordUsage(redis);

      return reply.send({ ok: true });
    } catch (error) {
      app.log.error(error);

      return reply.status(500).send({ ok: false, error: "failed to record usage" });
    }
  });
}
