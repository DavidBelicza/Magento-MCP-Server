import { createNeo4jDriver, createPgVectorPool, createPostgresPool, createRedisConnection } from "./connections.js";
import { releaseGraphIndexLock, releaseVectorIndexLock } from "./modules/index-lock.js";
import { recordIndexRun } from "./modules/index-run-state.js";
import { installSchemas } from "./schema/install-schemas.js";
import { createDeleteGraphWorker } from "./worker/delete-graph-worker.js";
import { createIndexLinksWorker } from "./worker/index-links-worker.js";
import { createIndexPackagesWorker } from "./worker/index-packages-worker.js";
import { createIndexSourceWorker } from "./worker/index-source-worker.js";
import { readEmbeddingConfig } from "./modules/vector/embedding/read-embedding-config.js";
import { createIndexVectorWorker } from "./worker/index-vector-worker.js";
import { createIndexXmlWorker } from "./worker/index-xml-worker.js";
import { readConfig } from "./config.js";
import { logger } from "./logger.js";

const config = readConfig();

const neo4jDriver = createNeo4jDriver();
const postgres = createPostgresPool();
const pgVector = createPgVectorPool();
const redis = createRedisConnection();

await installSchemas(postgres, neo4jDriver, pgVector);

const indexPackagesWorker = createIndexPackagesWorker(neo4jDriver);
const indexSourceWorker = createIndexSourceWorker(neo4jDriver, config.graphBatchSize, config.analyzerPhpUrl);
const indexLinksWorker = createIndexLinksWorker(neo4jDriver, redis);
const indexXmlWorker = createIndexXmlWorker(neo4jDriver, config.graphBatchSize);
const indexVectorWorker = createIndexVectorWorker(pgVector, readEmbeddingConfig());
const deleteGraphWorker = createDeleteGraphWorker(neo4jDriver);

indexVectorWorker.on("completed", () => void releaseVectorIndexLock(redis));
indexVectorWorker.on("failed", () => void releaseVectorIndexLock(redis));

function releaseLockOnFlowFailure(job?: { data?: { graphIndexFlow?: boolean } }): void {
  if (job?.data?.graphIndexFlow) {
    void releaseGraphIndexLock(redis);
  }
}

indexPackagesWorker.on("failed", (job) => releaseLockOnFlowFailure(job));
indexSourceWorker.on("failed", (job) => releaseLockOnFlowFailure(job));
indexLinksWorker.on("failed", (job) => releaseLockOnFlowFailure(job));
indexXmlWorker.on("failed", (job) => releaseLockOnFlowFailure(job));
deleteGraphWorker.on("failed", (job) => releaseLockOnFlowFailure(job));

function recordRun(): void {
  void recordIndexRun(postgres, neo4jDriver).catch((error) => {
    logger.error({ event: 'record_index_run_failed', err: error }, 'Failed to record index run state');
  });
}

indexPackagesWorker.on("completed", recordRun);
indexSourceWorker.on("completed", recordRun);
indexLinksWorker.on("completed", recordRun);
indexXmlWorker.on("completed", recordRun);
deleteGraphWorker.on("completed", recordRun);

logger.info({ event: 'worker_started' }, 'Magentic Worker is running');

process.on("SIGTERM", async () => {
  await indexPackagesWorker.close();
  await indexSourceWorker.close();
  await indexLinksWorker.close();
  await indexXmlWorker.close();
  await indexVectorWorker.close();
  await deleteGraphWorker.close();
  await postgres.end();
  await pgVector.end();
  await redis.quit();
  await neo4jDriver.close();
});
