import { FlowProducer } from "bullmq";
import Fastify from "fastify";
import { createNeo4jDriver, createPgVectorPool, createPostgresPool, createRedisConnection, createRedisConnectionOptions } from "./connections.js";
import { readConfig } from "./config.js";
import { createIndexStatus, graphIndexQueueNames, vectorIndexQueueNames } from "./modules/index-status.js";
import { createIndexLinksQueue } from "./queue/index-links.js";
import { createIndexPackagesQueue } from "./queue/index-packages.js";
import { createIndexSourceQueue } from "./queue/index-source.js";
import { createIndexVectorQueue } from "./queue/index-vector.js";
import { createIndexXmlQueue } from "./queue/index-xml.js";
import { installSchemas } from "./schema/install-schemas.js";
import { registerGetQueryHistoryRoute } from "./api/graph/get-query-history.js";
import { registerIndexDeltaRoute } from "./api/graph/index-delta.js";
import { registerIndexLinksRoute } from "./api/graph/index-links.js";
import { registerIndexPackagesRoute } from "./api/graph/index-packages.js";
import { registerIndexReindexRoute } from "./api/graph/index-reindex.js";
import { registerIndexResetAndReindexRoute } from "./api/graph/index-reset-and-reindex.js";
import { registerIndexSourceRoute } from "./api/graph/index-source.js";
import { registerIndexXmlRoute } from "./api/graph/index-xml.js";
import { registerVectorIndexReindexRoute } from "./api/vector/index-reindex.js";
import { registerVectorIndexResetAndReindexRoute } from "./api/vector/index-reset-and-reindex.js";
import { registerVectorIndexDeltaRoute } from "./api/vector/index-delta.js";
import { registerVectorSearchRoute } from "./api/vector/search.js";
import { readEmbeddingConfig } from "./modules/vector/embedding/read-embedding-config.js";
import { registerIndexStatusRoute } from "./api/graph/index-status.js";
import { registerSearchRoute } from "./api/graph/search.js";
import { registerHealthApi } from "./api/health.js";
import { registerStatusRoute } from "./api/status.js";
import { registerStreamStatusRoute } from "./api/stream/status.js";
import { buildStatusSnapshot } from "./modules/stream/build-status-snapshot.js";
import { createStreamer } from "./modules/stream/streamer.js";
import { registerUsagePingRoute } from "./api/usage/ping.js";
import { registerGetConfigRoute } from "./api/config/get.js";
import { registerUpdateConfigRoute } from "./api/config/update.js";
import { registerGraphStatsRoute } from "./api/graph/stats.js";
import { getAppSettings, loadAppSettings } from "./modules/app-config.js";
import { posix } from "node:path";

const config = readConfig();
const app = Fastify({
  logger: true
});

const redis = createRedisConnection();
const postgres = createPostgresPool();
const pgVector = createPgVectorPool();
const getEmbeddingConfig = () => readEmbeddingConfig();
const neo4jDriver = createNeo4jDriver();
const indexPackagesQueue = createIndexPackagesQueue();
const indexSourceQueue = createIndexSourceQueue();
const indexLinksQueue = createIndexLinksQueue();
const indexXmlQueue = createIndexXmlQueue();
const indexVectorQueue = createIndexVectorQueue();
const indexFlowProducer = new FlowProducer({ connection: createRedisConnectionOptions() });
const indexStatus = createIndexStatus(graphIndexQueueNames);
const vectorIndexStatus = createIndexStatus(vectorIndexQueueNames);
const statusSnapshotDeps = { indexStatus, vectorIndexStatus, redis, postgres };
const streamer = createStreamer({
  redis,
  snapshot: () => buildStatusSnapshot(statusSnapshotDeps)
});

loadAppSettings();

function getMountPath(): string {
  return process.env.MAGENTIC_ANALYZED_SOURCE_PATH ?? "/mnt/analyzed-source";
}

function getSourceHostPath(): string {
  return process.env.MAGENTIC_ANALYZED_SOURCE_HOST_PATH ?? "";
}

function getComposerRoot(): string {
  const root = getAppSettings().projectRoot;

  return root === "" ? getMountPath() : posix.join(getMountPath(), root);
}

function getSourceDirectories(): string[] {
  return getAppSettings().sourceSubpaths;
}

function getPhpVersion(): string {
  return getAppSettings().phpVersion;
}

registerHealthApi(app, {
  redis,
  postgres,
  neo4jDriver
});

registerSearchRoute(app, { postgres, neo4jDriver });
registerGetQueryHistoryRoute(app, { postgres });
registerIndexPackagesRoute(app, { indexPackagesQueue, getComposerRoot });
registerIndexSourceRoute(app, { indexSourceQueue, getMountPath, getSourceDirectories, getPhpVersion });
registerIndexXmlRoute(app, { indexXmlQueue, getMountPath, getSourceDirectories });
registerVectorIndexReindexRoute(app, { indexVectorQueue, redis, getMountPath, getSourceDirectories, getEmbeddingConfig });
registerVectorIndexResetAndReindexRoute(app, { indexVectorQueue, redis, getMountPath, getSourceDirectories, getEmbeddingConfig });
registerVectorIndexDeltaRoute(app, { indexVectorQueue, redis, getMountPath, getSourceDirectories, getEmbeddingConfig });
registerVectorSearchRoute(app, { pgVector, getEmbeddingConfig });
registerIndexLinksRoute(app, { indexLinksQueue });
registerIndexDeltaRoute(app, { redis });
registerIndexReindexRoute(app, { indexFlowProducer, redis, getComposerRoot, getMountPath, getSourceDirectories, getPhpVersion });
registerIndexResetAndReindexRoute(app, { indexFlowProducer, redis, getComposerRoot, getMountPath, getSourceDirectories, getPhpVersion });
registerIndexStatusRoute(app, { indexStatus, redis });
registerStatusRoute(app, { indexStatus, vectorIndexStatus, redis, postgres });
registerStreamStatusRoute(app, { streamer });
registerGetConfigRoute(app, { getMountPath, getSourceHostPath });
registerUpdateConfigRoute(app);
registerGraphStatsRoute(app, { neo4jDriver });
registerUsagePingRoute(app, { redis });

async function start() {
  try {
    await installSchemas(postgres, neo4jDriver, pgVector);
    await app.listen({
      host: "0.0.0.0",
      port: config.port
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

process.on("SIGTERM", async () => {
  await app.close();
  await indexPackagesQueue.close();
  await indexSourceQueue.close();
  await indexLinksQueue.close();
  await indexXmlQueue.close();
  await indexVectorQueue.close();
  await indexFlowProducer.close();
  await indexStatus.close();
  await vectorIndexStatus.close();
  await streamer.close();
  await redis.quit();
  await postgres.end();
  await pgVector.end();
  await neo4jDriver.close();
});

await start();
