import { posix } from "node:path";
import { Worker, type Job } from "bullmq";
import type { Pool } from "pg";
import { createRedisConnectionOptions } from "../connections.js";
import { logger } from "../logger.js";
import { buildConfigDescriptions } from "../modules/processing/store-config/build-config-descriptions.js";
import { deltaConfigVector } from "../modules/processing/store-config/delta-config-vector.js";
import { mergeStoreConfig } from "../modules/processing/store-config/merge-store-config.js";
import { readStoreConfigSources } from "../modules/processing/store-config/read-store-config-sources.js";
import { resetConfigVector } from "../modules/processing/store-config/reset-config-vector.js";
import { saveConfigVector } from "../modules/processing/store-config/save-config-vector.js";
import type { StoreConfigSource } from "../modules/processing/store-config/types.js";
import { indexVectorJobName, indexVectorQueueName, type IndexVectorJob } from "../queue/index-vector.js";

export function createIndexVectorWorker(pgVector: Pool) {
  return new Worker<IndexVectorJob, void, typeof indexVectorJobName>(
    indexVectorQueueName,
    (job) => handleJob(job, pgVector),
    {
      connection: createRedisConnectionOptions()
    }
  );
}

async function handleJob(job: Job<IndexVectorJob>, pgVector: Pool): Promise<void> {
  const embeddingConfig = job.data.embeddingConfig;
  const sources = await collectSources(job.data.analyzedSourcePath, job.data.directories);
  const descriptions = buildConfigDescriptions(mergeStoreConfig(sources));

  if (job.data.operation === "delta") {
    const delta = await deltaConfigVector(descriptions, pgVector, embeddingConfig);

    logger.info(
      { event: "index_vector_delta", upserted: delta.upserted, deleted: delta.deleted },
      "Applied store configuration vector delta"
    );

    return;
  }

  logger.info(
    { event: "index_vector_descriptions", count: descriptions.length, operation: job.data.operation },
    "Embedding store configuration descriptions"
  );

  if (job.data.operation === "reset-and-index") {
    await resetConfigVector(pgVector);
  }

  await saveConfigVector(descriptions, pgVector, embeddingConfig);
}

async function collectSources(mountPath: string, directories: string[]): Promise<StoreConfigSource[]> {
  const roots = directories.length > 0 ? directories : [""];
  const collected: StoreConfigSource[] = [];

  for (const directory of roots) {
    const root = directory === "" ? mountPath : posix.join(mountPath, directory);
    collected.push(...(await readStoreConfigSources(root)));
  }

  return collected;
}
