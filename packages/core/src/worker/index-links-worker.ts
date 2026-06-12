import { Worker, type Job } from "bullmq";
import type { Driver } from "neo4j-driver";
import { createRedisConnectionOptions } from "../connections.js";
import { linkSymbolsToPackages } from "../modules/processing/package-linking/link-symbols-to-packages.js";
import {
  indexLinksJobName,
  indexLinksQueueName,
  type IndexLinksJob
} from "../queue/index-links.js";

type IndexLinksResult = {
  linkedCount: number;
};

export function createIndexLinksWorker(driver: Driver) {
  const worker = new Worker<IndexLinksJob, IndexLinksResult, typeof indexLinksJobName>(
    indexLinksQueueName,
    (job) => handleJob(job, driver),
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

async function handleJob(job: Job<IndexLinksJob>, driver: Driver): Promise<IndexLinksResult> {
  const scope = job.data.symbolId ? { symbolId: job.data.symbolId } : null;

  return linkSymbolsToPackages(driver, scope);
}
