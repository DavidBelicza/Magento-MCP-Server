import { Queue } from "bullmq";
import { createRedisConnectionOptions } from "../connections.js";
import type { EmbeddingConfig } from "../modules/vector/embedding/types.js";

export type IndexVectorOperation = "index" | "reset-and-index" | "delta";

export type IndexVectorJob = {
  analyzedSourcePath: string;
  directories: string[];
  operation: IndexVectorOperation;
  embeddingConfig: EmbeddingConfig;
  requestedAt: string;
};

export const indexVectorQueueName = "index-vector";
export const indexVectorJobName = "index-vector-job";

export function createIndexVectorQueue() {
  const queue = new Queue<IndexVectorJob, unknown, typeof indexVectorJobName>(indexVectorQueueName, {
    connection: createRedisConnectionOptions()
  });

  return {
    add: async (
      analyzedSourcePath: string,
      directories: string[],
      embeddingConfig: EmbeddingConfig,
      operation: IndexVectorOperation = "index"
    ) => {
      const job = await queue.add(indexVectorJobName, {
        analyzedSourcePath,
        directories,
        operation,
        embeddingConfig,
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
