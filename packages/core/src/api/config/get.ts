import type { FastifyInstance } from "fastify";
import { getAppSettings, phpVersionOptions } from "../../modules/app-config.js";

type Dependencies = {
  getMountPath: () => string;
};

export function registerGetConfigRoute(app: FastifyInstance, deps: Dependencies): void {
  app.get("/api/config", async (_request, reply) => {
    const settings = getAppSettings();

    return reply.send({
      ok: true,
      settings,
      mountPath: deps.getMountPath(),
      phpVersionOptions
    });
  });
}
