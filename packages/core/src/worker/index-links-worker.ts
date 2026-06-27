import { Worker, type Job } from "bullmq";
import type { Redis } from "ioredis";
import type { Driver } from "neo4j-driver";
import { createRedisConnectionOptions } from "../connections.js";
import { releaseGraphIndexLock } from "../modules/index-lock.js";
import { linkSymbolsToPackages } from "../modules/processing/package-linking/link-symbols-to-packages.js";
import {
  indexLinksJobName,
  indexLinksQueueName,
  type IndexLinksJob
} from "../queue/index-links.js";

type IndexLinksResult = {
  linkedCount: number;
};

export function createIndexLinksWorker(driver: Driver, redis: Redis) {
  const worker = new Worker<IndexLinksJob, IndexLinksResult, typeof indexLinksJobName>(
    indexLinksQueueName,
    (job) => handleJob(job, driver, redis),
    {
      connection: createRedisConnectionOptions()
    }
  );

  worker.on("completed", (job) => {
    console.log(`Completed index-links job ${job.id}`);
  });

  worker.on("failed", (job, error) => {
    console.error(`Index-links job ${job?.id ?? "unknown"} failed`, error);
  });

  return worker;
}

async function handleJob(job: Job<IndexLinksJob>, driver: Driver, redis: Redis): Promise<IndexLinksResult> {
  const scope = job.data.symbolId ? { symbolId: job.data.symbolId } : null;

  try {
    return await linkSymbolsToPackages(driver, scope);
  } finally {
    if (job.data.graphIndexFlow) {
      await releaseGraphIndexLock(redis);
    }
  }
}
