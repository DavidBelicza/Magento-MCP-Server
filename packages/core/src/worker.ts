import { createNeo4jDriver, createPostgresPool, createRedisConnection } from "./connections.js";
import { releaseFullIndexLock } from "./modules/index-lock.js";
import { installSchemas } from "./schema/install-schemas.js";
import { createGraphWipeWorker } from "./worker/graph-wipe-worker.js";
import { createIndexLinksWorker } from "./worker/index-links-worker.js";
import { createIndexPackagesWorker } from "./worker/index-packages-worker.js";
import { createIndexSourceWorker } from "./worker/index-source-worker.js";
import { readConfig } from "./config.js";
import { logger } from "./logger.js";

const config = readConfig();

const neo4jDriver = createNeo4jDriver();
const postgres = createPostgresPool();
const redis = createRedisConnection();

await installSchemas(postgres, neo4jDriver);

const indexPackagesWorker = createIndexPackagesWorker(neo4jDriver);
const indexSourceWorker = createIndexSourceWorker(neo4jDriver, config.graphBatchSize, config.analyzerPhpUrl);
const indexLinksWorker = createIndexLinksWorker(neo4jDriver, redis);
const graphWipeWorker = createGraphWipeWorker(neo4jDriver);

function releaseLockOnFlowFailure(job?: { data?: { fullIndexFlow?: boolean } }): void {
  if (job?.data?.fullIndexFlow) {
    void releaseFullIndexLock(redis);
  }
}

indexPackagesWorker.on("failed", (job) => releaseLockOnFlowFailure(job));
indexSourceWorker.on("failed", (job) => releaseLockOnFlowFailure(job));
indexLinksWorker.on("failed", (job) => releaseLockOnFlowFailure(job));
graphWipeWorker.on("failed", (job) => releaseLockOnFlowFailure(job));

logger.info({ event: 'worker_started' }, 'Magentic Worker is running');

process.on("SIGTERM", async () => {
  await indexPackagesWorker.close();
  await indexSourceWorker.close();
  await indexLinksWorker.close();
  await graphWipeWorker.close();
  await postgres.end();
  await redis.quit();
  await neo4jDriver.close();
});
