import { Worker } from "bullmq";
import { createRedisConnectionOptions } from "../connections.js";
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

export function createIndexSourceWorker() {
  const worker = new Worker<IndexSourceJob, IndexSourceResult, typeof indexSourceJobName>(
    indexSourceQueueName,
    async (job) => {
      await job.updateProgress({
        phase: "accepted",
        processed: 0,
        total: 0,
        percent: 0
      });

      return {
        analyzedSourcePath: job.data.analyzedSourcePath,
        directory: job.data.directory,
        status: "accepted"
      };
    },
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
