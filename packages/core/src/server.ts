import { FlowProducer } from "bullmq";
import Fastify from "fastify";
import { createNeo4jDriver, createPostgresPool, createRedisConnection, createRedisConnectionOptions } from "./connections.js";
import { readConfig } from "./config.js";
import { createIndexStatus } from "./modules/index-status.js";
import { createIndexLinksQueue } from "./queue/index-links.js";
import { createIndexPackagesQueue } from "./queue/index-packages.js";
import { createIndexSourceQueue } from "./queue/index-source.js";
import { installSchemas } from "./schema/install-schemas.js";
import { registerGetQueryHistoryRoute } from "./api/graph/get-query-history.js";
import { registerIndexDeltaRoute } from "./api/graph/index-delta.js";
import { registerIndexLinksRoute } from "./api/graph/index-links.js";
import { registerIndexPackagesRoute } from "./api/graph/index-packages.js";
import { registerIndexReindexRoute } from "./api/graph/index-reindex.js";
import { registerIndexResetAndReindexRoute } from "./api/graph/index-reset-and-reindex.js";
import { registerIndexSourceRoute } from "./api/graph/index-source.js";
import { registerIndexStatusRoute } from "./api/graph/index-status.js";
import { registerSearchRoute } from "./api/graph/search.js";
import { registerHealthApi } from "./api/health.js";
import { registerStatusRoute } from "./api/usage/status.js";
import { registerUsagePingRoute } from "./api/usage/ping.js";

const config = readConfig();
const app = Fastify({
  logger: true
});

const redis = createRedisConnection();
const postgres = createPostgresPool();
const neo4jDriver = createNeo4jDriver();
const indexPackagesQueue = createIndexPackagesQueue();
const indexSourceQueue = createIndexSourceQueue();
const indexLinksQueue = createIndexLinksQueue();
const indexFlowProducer = new FlowProducer({ connection: createRedisConnectionOptions() });
const indexStatus = createIndexStatus();

function getAnalyzedSourcePath(): string {
  return process.env.MAGENTIC_ANALYZED_SOURCE_PATH ?? "/mnt/analyzed-source";
}

registerHealthApi(app, {
  redis,
  postgres,
  neo4jDriver
});

registerSearchRoute(app, { postgres, neo4jDriver });
registerGetQueryHistoryRoute(app, { postgres });
registerIndexPackagesRoute(app, { indexPackagesQueue, getAnalyzedSourcePath });
registerIndexSourceRoute(app, { indexSourceQueue, getAnalyzedSourcePath });
registerIndexLinksRoute(app, { indexLinksQueue });
registerIndexDeltaRoute(app, { redis });
registerIndexReindexRoute(app, { indexFlowProducer, redis, getAnalyzedSourcePath });
registerIndexResetAndReindexRoute(app, { indexFlowProducer, redis, getAnalyzedSourcePath });
registerIndexStatusRoute(app, { indexStatus, redis });
registerStatusRoute(app, { indexStatus, redis });
registerUsagePingRoute(app, { redis });

async function start() {
  try {
    await installSchemas(postgres, neo4jDriver);
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
  await indexFlowProducer.close();
  await indexStatus.close();
  await redis.quit();
  await postgres.end();
  await neo4jDriver.close();
});

await start();
