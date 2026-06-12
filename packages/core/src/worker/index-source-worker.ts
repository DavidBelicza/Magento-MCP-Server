import { Worker, type Job } from "bullmq";
import type { Driver } from "neo4j-driver";
import { createRedisConnectionOptions } from "../connections.js";
import { consumeFactStream } from "../modules/processing/php-analysis/consume-fact-stream.js";
import { deleteSourceByPaths } from "../modules/processing/php-analysis/delete-source.js";
import {
  indexSourceJobName,
  indexSourceQueueName,
  type IndexSourceJob
} from "../queue/index-source.js";

type IndexSourceResult = {
  analyzedSourcePath: string;
  directory: unknown | null;
  status: "accepted";
};

export function createIndexSourceWorker(driver: Driver, batchSize: number, analyzerPhpUrl: string) {
  const worker = new Worker<IndexSourceJob, IndexSourceResult, typeof indexSourceJobName>(
    indexSourceQueueName,
    (job) => handleJob(job, driver, batchSize, analyzerPhpUrl),
    {
      connection: createRedisConnectionOptions()
    }
  );

  worker.on("completed", (job) => {
    console.log(`Completed index-source job ${job.id}`);
  });

  worker.on("failed", (job, error) => {
    console.error(`Index-source job ${job?.id ?? "unknown"} failed`, error);
  });

  return worker;
}

async function handleJob(job: Job<IndexSourceJob>, driver: Driver, batchSize: number, analyzerPhpUrl: string): Promise<IndexSourceResult> {
  if (job.data.operation === "delete") {
    return handleDeleteJob(job, driver);
  }

  await job.updateProgress({ phase: "accepted", percent: 0 });

  const directory = extractDirectory(job.data.directory);
  const reader = await fetchAnalyzerStream(directory, analyzerPhpUrl);

  await consumeFactStream(reader, driver, batchSize, () => job.updateProgress({ phase: "processing" }));

  await job.updateProgress({ phase: "completed", percent: 100 });

  return {
    analyzedSourcePath: job.data.analyzedSourcePath,
    directory: job.data.directory,
    status: "accepted"
  };
}

async function handleDeleteJob(job: Job<IndexSourceJob>, driver: Driver): Promise<IndexSourceResult> {
  await job.updateProgress({ phase: "deleting", percent: 0 });

  const path = extractDirectory(job.data.directory);
  await deleteSourceByPaths(driver, [path]);

  await job.updateProgress({ phase: "completed", percent: 100 });

  return {
    analyzedSourcePath: job.data.analyzedSourcePath,
    directory: job.data.directory,
    status: "accepted"
  };
}

function extractDirectory(directory: unknown): string {
  return typeof directory === "string" && directory.trim() !== ""
    ? directory
    : ".";
}

async function fetchAnalyzerStream(directory: string, analyzerPhpUrl: string): Promise<ReadableStreamDefaultReader<Uint8Array>> {
  const response = await fetch(`${analyzerPhpUrl}/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ path: directory })
  });

  if (!response.ok) {
    throw new Error(`Failed to start analysis: ${response.status} ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error("No response body received from analyzer.");
  }

  return response.body.getReader();
}
