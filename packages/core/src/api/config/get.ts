import type { FastifyInstance } from "fastify";
import { readConfig } from "../../config.js";
import { getAppSettings, phpVersionOptions } from "../../modules/app-config.js";

type Dependencies = {
  getMountPath: () => string;
  getSourceHostPath: () => string;
};

export function registerGetConfigRoute(app: FastifyInstance, deps: Dependencies): void {
  app.get("/api/config", async (_request, reply) => {
    const settings = getAppSettings();
    const config = readConfig();

    return reply.send({
      ok: true,
      settings,
      mountPath: deps.getMountPath(),
      hostPath: deps.getSourceHostPath(),
      phpVersionOptions,
      localEmbedder: {
        url: config.localEmbedderUrl,
        model: config.localEmbedderModel,
        bearerToken: config.localEmbedderBearerToken ?? ""
      }
    });
  });
}
