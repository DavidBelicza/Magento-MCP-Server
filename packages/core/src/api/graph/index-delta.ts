import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import { isGraphIndexLocked } from "../../modules/index-lock.js";
import { isConfigXml } from "../../modules/processing/magento-xml/discovery.js";

type Dependencies = {
  redis: Redis;
};

export function registerIndexDeltaRoute(app: FastifyInstance, deps: Dependencies): void {
  const { redis } = deps;

  app.post<{ Body: { operation?: unknown; paths?: unknown } }>("/api/graph/index/delta", async (request, reply) => {
    if (await isGraphIndexLocked(redis)) {
      return reply.status(409).send({
        ok: false,
        error: "a graph reindex or reset is in progress; delta updates are paused"
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

    if (routed.xmlPaths.length > 0) {
      dispatched.xml = await proxy(app, operation === "delete" ? "DELETE" : "POST", "/api/graph/index/xml", {
        directories: routed.xmlPaths
      });
    }

    if (operation === "upsert" && (routed.sourcePaths.length > 0 || routed.composerChanged)) {
      dispatched.links = await proxy(app, "POST", "/api/graph/index/links", {});
    }

    if (Object.keys(dispatched).length === 0) {
      return reply.status(200).send({
        ok: true,
        skipped: routed.skipped,
        message: "No graph-relevant paths in request."
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
  xmlPaths: string[];
  composerChanged: boolean;
  skipped: string[];
};

type DeltaCategory = "composer" | "xml" | "source" | "skip";

function routeDeltaPaths(paths: string[]): DeltaRouting {
  const sourcePaths: string[] = [];
  const xmlPaths: string[] = [];
  const skipped: string[] = [];
  let composerChanged = false;

  for (const path of paths) {
    const category = categorizeDeltaPath(path);

    if (category === "composer") {
      composerChanged = true;
    } else if (category === "xml") {
      xmlPaths.push(path);
    } else if (category === "source") {
      sourcePaths.push(path);
    } else {
      skipped.push(path);
    }
  }

  return { sourcePaths, xmlPaths, composerChanged, skipped };
}

function categorizeDeltaPath(path: string): DeltaCategory {
  if (isComposerLock(path)) {
    return "composer";
  }

  if (path.endsWith(".xml")) {
    return isConfigXml(path) ? "xml" : "skip";
  }

  return "source";
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
