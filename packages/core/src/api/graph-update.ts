import type { FlowJob, FlowProducer } from "bullmq";
import type { FastifyInstance } from "fastify";
import type { Redis } from "ioredis";
import { acquireFullIndexLock, isFullIndexLocked } from "../modules/index-lock.js";
import { graphWipeJobName, graphWipeQueueName } from "../queue/graph-wipe.js";
import { indexLinksJobName, indexLinksQueueName, type createIndexLinksQueue } from "../queue/index-links.js";
import { indexPackagesJobName, indexPackagesQueueName, type createIndexPackagesQueue } from "../queue/index-packages.js";
import { indexSourceJobName, indexSourceQueueName, type createIndexSourceQueue } from "../queue/index-source.js";
import type { createIndexStatus } from "../queue/index-status.js";

type GraphUpdateApiDependencies = {
  indexPackagesQueue: ReturnType<typeof createIndexPackagesQueue>;
  indexSourceQueue: ReturnType<typeof createIndexSourceQueue>;
  indexLinksQueue: ReturnType<typeof createIndexLinksQueue>;
  indexFlowProducer: FlowProducer;
  indexStatus: ReturnType<typeof createIndexStatus>;
  redis: Redis;
  getAnalyzedSourcePath: () => string;
};

export function registerGraphUpdateApi(app: FastifyInstance, dependencies: GraphUpdateApiDependencies): void {
  const {
    indexPackagesQueue,
    indexSourceQueue,
    indexLinksQueue,
    indexFlowProducer,
    indexStatus,
    redis,
    getAnalyzedSourcePath
  } = dependencies;

  app.post("/api/index/packages", async (_request, reply) => {
    const job = await indexPackagesQueue.add(getAnalyzedSourcePath());

    return reply.status(202).send({
      ok: true,
      status: job.state,
      jobId: job.id,
      message: "Package indexing request accepted."
    });
  });

  app.post<{ Body: { directories?: unknown[] | null } }>("/api/index/source", async (request, reply) => {
    const jobs = await indexSourceQueue.add(
      getAnalyzedSourcePath(),
      request.body?.directories ?? null
    );

    return reply.status(202).send({
      ok: true,
      jobs,
      message: "Source indexing request accepted."
    });
  });

  app.delete<{ Body: { directories?: unknown[] | null } }>("/api/index/source", async (request, reply) => {
    const directories = request.body?.directories;

    if (!Array.isArray(directories) || directories.length === 0) {
      return reply.status(400).send({
        ok: false,
        error: "directories is required and must be a non-empty array for deletion"
      });
    }

    const jobs = await indexSourceQueue.add(getAnalyzedSourcePath(), directories, "delete");

    return reply.status(202).send({
      ok: true,
      jobs,
      message: "Source deletion request accepted."
    });
  });

  app.post<{ Body: { symbolId?: string | null } }>("/api/index/links", async (request, reply) => {
    const job = await indexLinksQueue.add(request.body?.symbolId ?? null);

    return reply.status(202).send({
      ok: true,
      status: job.state,
      jobId: job.id,
      message: "Package linking request accepted."
    });
  });

  app.post<{ Body: { operation?: unknown; paths?: unknown } }>("/api/sync", async (request, reply) => {
    if (await isFullIndexLocked(redis)) {
      return reply.status(409).send({
        ok: false,
        error: "a reset or full reindex is in progress; sync is paused"
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

    const routed = routeSyncPaths(paths);
    const dispatched: Record<string, unknown> = {};

    if (routed.sourcePaths.length > 0) {
      dispatched.source = await proxy(app, operation === "delete" ? "DELETE" : "POST", "/api/index/source", {
        directories: routed.sourcePaths
      });
    }

    if (routed.composerChanged && operation === "upsert") {
      dispatched.packages = await proxy(app, "POST", "/api/index/packages", {});
    }

    if (operation === "upsert" && Object.keys(dispatched).length > 0) {
      dispatched.links = await proxy(app, "POST", "/api/index/links", {});
    }

    if (Object.keys(dispatched).length === 0) {
      return reply.status(400).send({
        ok: false,
        error: "no syncable paths in request",
        skipped: routed.skipped
      });
    }

    return reply.status(202).send({
      ok: true,
      operation,
      dispatched,
      skipped: routed.skipped,
      message: "Sync request accepted."
    });
  });

  app.post("/api/index/reindex", async (_request, reply) => {
    if (!(await acquireFullIndexLock(redis))) {
      return reply.status(409).send({
        ok: false,
        error: "a reset or full reindex is already in progress"
      });
    }

    const flow = await indexFlowProducer.add(buildIndexFlow(getAnalyzedSourcePath(), false));

    return reply.status(202).send({
      ok: true,
      jobId: flow.job.id,
      message: "Reindex request accepted."
    });
  });

  app.post("/api/index/reset", async (_request, reply) => {
    if (!(await acquireFullIndexLock(redis))) {
      return reply.status(409).send({
        ok: false,
        error: "a reset or full reindex is already in progress"
      });
    }

    const flow = await indexFlowProducer.add(buildIndexFlow(getAnalyzedSourcePath(), true));

    return reply.status(202).send({
      ok: true,
      jobId: flow.job.id,
      message: "Reset and reindex request accepted."
    });
  });

  app.get("/api/index/status", async (_request, reply) => {
    const items = await indexStatus.getInProgress();

    return reply.send({
      ok: true,
      inProgress: items.length,
      locked: await isFullIndexLocked(redis),
      items
    });
  });

  app.get<{ Querystring: { jobId?: string } }>("/api/index/get-status", async (request, reply) => {
    const jobId = request.query.jobId;

    if (!jobId) {
      return reply.status(400).send({
        ok: false,
        error: "jobId is required"
      });
    }

    const job = await indexPackagesQueue.getStatus(jobId);

    if (!job) {
      return reply.status(404).send({
        ok: false,
        error: "job not found"
      });
    }

    return {
      ok: true,
      jobId: job.id,
      status: job.state,
      message: "Index status loaded."
    };
  });
}

function buildIndexFlow(analyzedSourcePath: string, withWipe: boolean): FlowJob {
  const requestedAt = new Date().toISOString();
  const failParent = { failParentOnFailure: true };
  const wipeChildren: FlowJob[] = withWipe
    ? [
        {
          name: graphWipeJobName,
          queueName: graphWipeQueueName,
          data: { requestedAt, fullIndexFlow: true },
          opts: failParent
        }
      ]
    : [];

  return {
    name: indexLinksJobName,
    queueName: indexLinksQueueName,
    data: { symbolId: null, requestedAt, fullIndexFlow: true },
    children: [
      {
        name: indexSourceJobName,
        queueName: indexSourceQueueName,
        data: { analyzedSourcePath, directory: null, operation: "index", requestedAt, fullIndexFlow: true },
        opts: failParent,
        children: [
          {
            name: indexPackagesJobName,
            queueName: indexPackagesQueueName,
            data: { analyzedSourcePath, requestedAt, fullIndexFlow: true },
            opts: failParent,
            children: wipeChildren
          }
        ]
      }
    ]
  };
}

type SyncRouting = {
  sourcePaths: string[];
  composerChanged: boolean;
  skipped: string[];
};

function routeSyncPaths(paths: string[]): SyncRouting {
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
