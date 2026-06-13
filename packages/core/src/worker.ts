import { createNeo4jDriver, createPostgresPool } from "./connections.js";
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

await installSchemas(postgres, neo4jDriver);

const indexPackagesWorker = createIndexPackagesWorker(neo4jDriver);
const indexSourceWorker = createIndexSourceWorker(neo4jDriver, config.graphBatchSize, config.analyzerPhpUrl);
const indexLinksWorker = createIndexLinksWorker(neo4jDriver);
const graphWipeWorker = createGraphWipeWorker(neo4jDriver);

logger.info({ event: 'worker_started' }, 'Magentic Worker is running');

process.on("SIGTERM", async () => {
  await indexPackagesWorker.close();
  await indexSourceWorker.close();
  await indexLinksWorker.close();
  await graphWipeWorker.close();
  await postgres.end();
  await neo4jDriver.close();
});
