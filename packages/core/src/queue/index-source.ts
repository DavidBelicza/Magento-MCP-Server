import { Queue } from "bullmq";
import { createRedisConnectionOptions } from "../connections.js";

export type IndexSourceOperation = "index" | "delete";

export type IndexSourceJob = {
  analyzedSourcePath: string;
  directory: unknown | null;
  operation: IndexSourceOperation;
  requestedAt: string;
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
      directories: unknown[] | null,
      operation: IndexSourceOperation = "index"
    ) => {
      const requestedAt = new Date().toISOString();
      const jobDirectories = directories ?? [null];
      const jobs = await Promise.all(jobDirectories.map(async (directory) => {
        const job = await queue.add(indexSourceJobName, {
          analyzedSourcePath,
          directory,
          operation,
          requestedAt
        });

        return {
          id: job.id,
          state: await job.getState()
        };
      }));

      return jobs;
    },
    close: () => queue.close()
  };
}
