import type { FastifyInstance } from "fastify";
import { getAppSettings, phpVersionOptions, updateAppSettings } from "../../modules/app-config.js";

type Body = {
  phpVersion?: string;
  analyzedSubpath?: string;
};

export function registerUpdateConfigRoute(app: FastifyInstance): void {
  app.put<{ Body: Body }>("/api/config", async (request, reply) => {
    const body = request.body ?? {};

    if (body.phpVersion !== undefined && !phpVersionOptions.includes(body.phpVersion as (typeof phpVersionOptions)[number])) {
      return reply.status(400).send({ ok: false, error: "unsupported phpVersion" });
    }

    try {
      const settings = updateAppSettings({
        phpVersion: body.phpVersion ?? getAppSettings().phpVersion,
        analyzedSubpath: body.analyzedSubpath ?? getAppSettings().analyzedSubpath
      });

      return reply.send({ ok: true, settings });
    } catch (error) {
      app.log.error(error);

      return reply.status(500).send({ ok: false, error: "failed to persist settings" });
    }
  });
}
