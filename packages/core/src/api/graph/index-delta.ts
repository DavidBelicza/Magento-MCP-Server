import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import { isFullIndexLocked } from "../../modules/index-lock.js";

type Dependencies = {
  redis: Redis;
};

export function registerIndexDeltaRoute(app: FastifyInstance, deps: Dependencies): void {
  const { redis } = deps;

  app.post<{ Body: { operation?: unknown; paths?: unknown } }>("/api/graph/index/delta", async (request, reply) => {
    if (await isFullIndexLocked(redis)) {
      return reply.status(409).send({
        ok: false,
        error: "a reset or full reindex is in progress; delta updates are paused"
      });
    }

    const operation = request.body?.operation;
    const paths = request.body?.paths;

    if (operation !== "upsert" && operation !== "delete") {
      return reply.status(400).send({
        ok: false,
        error: "operation must be 'upsert' or 'delete'"
      });
    }

    if (!Array.isArray(paths) || paths.length === 0 || !paths.every((path) => typeof path === "string")) {
      return reply.status(400).send({
        ok: false,
        error: "paths must be a non-empty array of strings"
      });
    }

    const routed = routeDeltaPaths(paths);
    const dispatched: Record<string, unknown> = {};

    if (routed.sourcePaths.length > 0) {
      dispatched.source = await proxy(app, operation === "delete" ? "DELETE" : "POST", "/api/graph/index/source", {
        directories: routed.sourcePaths
      });
    }

    if (routed.composerChanged && operation === "upsert") {
      dispatched.packages = await proxy(app, "POST", "/api/graph/index/packages", {});
    }

    if (operation === "upsert" && Object.keys(dispatched).length > 0) {
      dispatched.links = await proxy(app, "POST", "/api/graph/index/links", {});
    }

    if (Object.keys(dispatched).length === 0) {
      return reply.status(400).send({
        ok: false,
        error: "no applicable paths in request",
        skipped: routed.skipped
      });
    }

    return reply.status(202).send({
      ok: true,
      operation,
      dispatched,
      skipped: routed.skipped,
      message: "Delta update request accepted."
    });
  });
}

type DeltaRouting = {
  sourcePaths: string[];
  composerChanged: boolean;
  skipped: string[];
};

function routeDeltaPaths(paths: string[]): DeltaRouting {
  const sourcePaths: string[] = [];
  const skipped: string[] = [];
  let composerChanged = false;

  for (const path of paths) {
    if (isComposerLock(path)) {
      composerChanged = true;
    } else if (path.endsWith(".xml")) {
      skipped.push(path);
    } else {
      sourcePaths.push(path);
    }
  }

  return { sourcePaths, composerChanged, skipped };
}

function isComposerLock(path: string): boolean {
  return path === "composer.lock" || path.endsWith("/composer.lock");
}

async function proxy(
  app: FastifyInstance,
  method: "POST" | "DELETE",
  url: string,
  payload: Record<string, unknown>
): Promise<{ status: number; body: unknown }> {
  const response = await app.inject({ method, url, payload });

  return { status: response.statusCode, body: response.json() };
}
