import { Queue } from "bullmq";
import { createRedisConnectionOptions } from "../connections.js";

export type IndexVectorOperation = "index" | "reset";

export type IndexVectorJob = {
  analyzedSourcePath: string;
  directories: string[];
  operation: IndexVectorOperation;
  requestedAt: string;
};

export const indexVectorQueueName = "index-vector";
export const indexVectorJobName = "index-vector-job";

export function createIndexVectorQueue() {
  const queue = new Queue<IndexVectorJob, unknown, typeof indexVectorJobName>(indexVectorQueueName, {
    connection: createRedisConnectionOptions()
  });

  return {
    add: async (analyzedSourcePath: string, directories: string[], operation: IndexVectorOperation = "index") => {
      const job = await queue.add(indexVectorJobName, {
        analyzedSourcePath,
        directories,
        operation,
        requestedAt: new Date().toISOString()
      });

      return {
        id: job.id,
        state: await job.getState()
      };
    },
    close: () => queue.close()
  };
}
