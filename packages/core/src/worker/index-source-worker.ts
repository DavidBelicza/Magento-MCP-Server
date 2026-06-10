import { Worker, type Job } from "bullmq";
import type { Driver } from "neo4j-driver";
import { createRedisConnectionOptions } from "../connections.js";
import { processFact } from "../modules/processing/php-analysis/process-fact.js";
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
  await job.updateProgress({ phase: "accepted", percent: 0 });

  const directory = extractDirectory(job.data.directory);
  const reader = await fetchAnalyzerStream(directory, analyzerPhpUrl);

  await processStream(reader, job, driver, batchSize);

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

async function processStream(reader: ReadableStreamDefaultReader<Uint8Array>, job: Job<IndexSourceJob>, driver: Driver, batchSize: number): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      buffer = await processBufferLines(buffer, job, driver, batchSize);
    }

    if (buffer.trim()) {
      await processFact(driver, buffer.trim(), batchSize);
    }
  } finally {
    reader.releaseLock();
  }
}

async function processBufferLines(buffer: string, job: Job<IndexSourceJob>, driver: Driver, batchSize: number): Promise<string> {
  const lines = buffer.split("\n");
  const remainingBuffer = lines.pop() ?? "";

  for (const line of lines) {
    if (line.trim()) {
      await processFact(driver, line.trim(), batchSize);
      await job.updateProgress({ phase: "processing" });
    }
  }

  return remainingBuffer;
}
