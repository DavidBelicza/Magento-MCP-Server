import { createNeo4jDriver, createPostgresPool } from "./connections.js";
import { installSchemas } from "./schema/install-schemas.js";
import { createIndexPackagesWorker } from "./worker/index-packages-worker.js";
import { createIndexSourceWorker } from "./worker/index-source-worker.js";

const neo4jDriver = createNeo4jDriver();
const postgres = createPostgresPool();

await installSchemas(postgres, neo4jDriver);

const indexPackagesWorker = createIndexPackagesWorker(neo4jDriver);
const indexSourceWorker = createIndexSourceWorker();

process.on("SIGTERM", async () => {
  await indexPackagesWorker.close();
  await indexSourceWorker.close();
  await postgres.end();
  await neo4jDriver.close();
});
