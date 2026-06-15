import { Worker, type Job } from "bullmq";
import type { Driver } from "neo4j-driver";
import { createRedisConnectionOptions } from "../connections.js";
import { consumeFactStream } from "../modules/processing/source-php/consume-fact-stream.js";
import { deleteSourceByPaths } from "../modules/processing/source-php/delete-source.js";
import {
  indexSourceJobName,
  indexSourceQueueName,
  type IndexSourceJob
} from "../queue/index-source.js";

type IndexSourceResult = {
  analyzedSourcePath: string;
  directories: string[];
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

  const directories = job.data.directories.length > 0 ? job.data.directories : ["."];
  const total = directories.length;
  let nodes = 0;
  let edges = 0;

  await job.updateProgress({ phase: "accepted", percent: 0, directories, total });

  for (let index = 0; index < total; index += 1) {
    const directory = directories[index];
    const current = index + 1;

    await job.updateProgress({ phase: "processing", directory, current, total, directories, nodes, edges });

    const reader = await fetchAnalyzerStream(directory, analyzerPhpUrl, job.data.phpVersion);
    await consumeFactStream(reader, driver, batchSize, async (counts) => {
      nodes += counts.nodes;
      edges += counts.relationships;
      await job.updateProgress({ phase: "processing", directory, current, total, directories, nodes, edges });
    });
  }

  await job.updateProgress({ phase: "completed", percent: 100, directories, total, nodes, edges });

  return {
    analyzedSourcePath: job.data.analyzedSourcePath,
    directories: job.data.directories,
    status: "accepted"
  };
}

async function handleDeleteJob(job: Job<IndexSourceJob>, driver: Driver): Promise<IndexSourceResult> {
  await job.updateProgress({ phase: "deleting", percent: 0 });

  const paths = job.data.directories.length > 0 ? job.data.directories : ["."];
  await deleteSourceByPaths(driver, paths);

  await job.updateProgress({ phase: "completed", percent: 100 });

  return {
    analyzedSourcePath: job.data.analyzedSourcePath,
    directories: job.data.directories,
    status: "accepted"
  };
}

async function fetchAnalyzerStream(directory: string, analyzerPhpUrl: string, phpVersion?: string): Promise<ReadableStreamDefaultReader<Uint8Array>> {
  const response = await fetch(`${analyzerPhpUrl}/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ path: directory, phpVersion })
  });

  if (!response.ok) {
    throw new Error(`Failed to start analysis: ${response.status} ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error("No response body received from analyzer.");
  }

  return response.body.getReader();
}
