import { createNeo4jDriver, createPostgresPool, createRedisConnection } from "./connections.js";
import { releaseFullIndexLock } from "./modules/index-lock.js";
import { recordIndexRun } from "./modules/index-run-state.js";
import { installSchemas } from "./schema/install-schemas.js";
import { createDeleteGraphWorker } from "./worker/delete-graph-worker.js";
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
const deleteGraphWorker = createDeleteGraphWorker(neo4jDriver);

function releaseLockOnFlowFailure(job?: { data?: { fullIndexFlow?: boolean } }): void {
  if (job?.data?.fullIndexFlow) {
    void releaseFullIndexLock(redis);
  }
}

indexPackagesWorker.on("failed", (job) => releaseLockOnFlowFailure(job));
indexSourceWorker.on("failed", (job) => releaseLockOnFlowFailure(job));
indexLinksWorker.on("failed", (job) => releaseLockOnFlowFailure(job));
deleteGraphWorker.on("failed", (job) => releaseLockOnFlowFailure(job));

function recordRun(): void {
  void recordIndexRun(postgres, neo4jDriver).catch((error) => {
    logger.error({ event: 'record_index_run_failed', err: error }, 'Failed to record index run state');
  });
}

indexPackagesWorker.on("completed", recordRun);
indexSourceWorker.on("completed", recordRun);
indexLinksWorker.on("completed", recordRun);
deleteGraphWorker.on("completed", recordRun);

logger.info({ event: 'worker_started' }, 'Magentic Worker is running');

process.on("SIGTERM", async () => {
  await indexPackagesWorker.close();
  await indexSourceWorker.close();
  await indexLinksWorker.close();
  await deleteGraphWorker.close();
  await postgres.end();
  await redis.quit();
  await neo4jDriver.close();
});
