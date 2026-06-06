import { Worker } from "bullmq";
import {
  indexPackagesJobName,
  indexPackagesQueueName,
  type IndexPackagesJob
} from "./queue/index-packages.js";
import { createNeo4jDriver, createPostgresPool, createRedisConnectionOptions } from "./connections.js";
import { parseComposerLock } from "./processing/composer-lock/parse-composer-lock.js";
import { saveComposerLockGraph } from "./processing/composer-lock/save-graph.js";
import { installSchemas } from "./schema/install-schemas.js";

type IndexPackagesResult = {
  composerLockPath: string;
  packageCount: number;
  authorCount: number;
  edgeCount: number;
  totalCount: number;
};

const neo4jDriver = createNeo4jDriver();
const postgres = createPostgresPool();

await installSchemas(postgres, neo4jDriver);

const worker = new Worker<IndexPackagesJob, IndexPackagesResult, typeof indexPackagesJobName>(
  indexPackagesQueueName,
  async (job) => {
    await job.updateProgress({
      phase: "parsing",
      processed: 0,
      total: 0,
      percent: 0
    });

    const result = await parseComposerLock(job.data.analyzedSourcePath);
    const writeSummary = await saveComposerLockGraph(neo4jDriver, result.records, {
      onProgress: (progress) => job.updateProgress(progress)
    });

    return {
      composerLockPath: result.composerLockPath,
      packageCount: writeSummary.packageCount,
      authorCount: writeSummary.authorCount,
      edgeCount: writeSummary.edgeCount,
      totalCount: writeSummary.totalCount
    };
  },
  {
    connection: createRedisConnectionOptions()
  }
);

worker.on("completed", (job) => {
  console.log(`Completed index-packages job ${job.id}`);
});

worker.on("failed", (job, error) => {
  console.error(`Index-packages job ${job?.id ?? "unknown"} failed`, error);
});

process.on("SIGTERM", async () => {
  await worker.close();
  await postgres.end();
  await neo4jDriver.close();
});
