import { FlowProducer } from "bullmq";
import Fastify from "fastify";
import { createNeo4jDriver, createPostgresPool, createRedisConnection, createRedisConnectionOptions } from "./connections.js";
import { readConfig } from "./config.js";
import { createIndexLinksQueue } from "./queue/index-links.js";
import { createIndexPackagesQueue } from "./queue/index-packages.js";
import { createIndexSourceQueue } from "./queue/index-source.js";
import { installSchemas } from "./schema/install-schemas.js";
import { registerGraphSearchApi } from "./api/graph-search.js";
import { registerHealthApi } from "./api/health.js";
import { registerGraphUpdateApi } from "./api/graph-update.js";

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

function getAnalyzedSourcePath(): string {
  return process.env.MAGENTIC_ANALYZED_SOURCE_PATH ?? "/mnt/analyzed-source";
}

registerHealthApi(app, {
  redis,
  postgres,
  neo4jDriver
});

registerGraphUpdateApi(app, {
  indexPackagesQueue,
  indexSourceQueue,
  indexLinksQueue,
  indexFlowProducer,
  getAnalyzedSourcePath
});

registerGraphSearchApi(app, {
  postgres,
  neo4jDriver
});

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
  await redis.quit();
  await postgres.end();
  await neo4jDriver.close();
});

await start();
