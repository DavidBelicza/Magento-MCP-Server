import { Queue } from "bullmq";
import { createRedisConnectionOptions } from "../connections.js";

export type IndexSourceOperation = "index" | "delete";

export type IndexSourceJob = {
  analyzedSourcePath: string;
  directories: string[];
  operation: IndexSourceOperation;
  phpVersion?: string;
  requestedAt: string;
  graphIndexFlow?: boolean;
};

export const indexSourceQueueName = "index-source";
export const indexSourceJobName = "index-source-job";

export function createIndexSourceQueue() {
  const queue = new Queue<IndexSourceJob, unknown, typeof indexSourceJobName>(
    indexSourceQueueName,
    {
      connection: createRedisConnectionOptions()
    }
  );

  return {
    add: async (
      analyzedSourcePath: string,
      directories: string[],
      operation: IndexSourceOperation = "index",
      phpVersion?: string
    ) => {
      const job = await queue.add(indexSourceJobName, {
        analyzedSourcePath,
        directories,
        operation,
        phpVersion,
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
