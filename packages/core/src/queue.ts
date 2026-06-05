import { Queue } from "bullmq";
import { createRedisConnectionOptions } from "./connections.js";

export type IndexingJob = {
  target: string;
  requestedAt: string;
};

export const indexingQueueName = "indexing";
export const indexingJobName = "index-target";

export function createIndexingQueue() {
  return new Queue<IndexingJob, unknown, typeof indexingJobName>(indexingQueueName, {
    connection: createRedisConnectionOptions()
  });
}
