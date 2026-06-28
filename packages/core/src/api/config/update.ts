import type { FastifyInstance } from "fastify";
import { getAppSettings, phpVersionOptions, updateAppSettings } from "../../modules/app-config.js";

type Body = {
  phpVersion?: string;
  projectRoot?: string;
  sourceSubpaths?: string[];
  watcherEnabled?: boolean;
  embedderType?: string;
  remoteEmbedderUrl?: string;
  remoteEmbedderModel?: string;
  remoteEmbedderBearerToken?: string;
};

export function registerUpdateConfigRoute(app: FastifyInstance): void {
  app.put<{ Body: Body }>("/api/config", async (request, reply) => {
    const body = request.body ?? {};

    if (body.phpVersion !== undefined && !phpVersionOptions.includes(body.phpVersion as (typeof phpVersionOptions)[number])) {
      return reply.status(400).send({ ok: false, error: "unsupported phpVersion" });
    }

    if (body.embedderType !== undefined && body.embedderType !== "local" && body.embedderType !== "remote") {
      return reply.status(400).send({ ok: false, error: "embedderType must be 'local' or 'remote'" });
    }

    const settings = getAppSettings();

    try {
      const updated = updateAppSettings({
        phpVersion: body.phpVersion ?? settings.phpVersion,
        projectRoot: body.projectRoot ?? settings.projectRoot,
        sourceSubpaths: body.sourceSubpaths ?? settings.sourceSubpaths,
        watcherEnabled: body.watcherEnabled ?? settings.watcherEnabled,
        embedderType: (body.embedderType as "local" | "remote" | undefined) ?? settings.embedderType,
        remoteEmbedderUrl: body.remoteEmbedderUrl ?? settings.remoteEmbedderUrl,
        remoteEmbedderModel: body.remoteEmbedderModel ?? settings.remoteEmbedderModel,
        remoteEmbedderBearerToken: body.remoteEmbedderBearerToken ?? settings.remoteEmbedderBearerToken
      });

      return reply.send({ ok: true, settings: updated });
    } catch (error) {
      app.log.error(error);

      return reply.status(500).send({ ok: false, error: "failed to persist settings" });
    }
  });
}
