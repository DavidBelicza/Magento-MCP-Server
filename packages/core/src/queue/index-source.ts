import { Queue } from "bullmq";
import { createRedisConnectionOptions } from "../connections.js";

export type IndexSourceJob = {
  analyzedSourcePath: string;
  directory: unknown | null;
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
    add: async (analyzedSourcePath: string, directories: unknown[] | null) => {
      const requestedAt = new Date().toISOString();
      const jobDirectories = directories ?? [null];
      const jobs = await Promise.all(jobDirectories.map(async (directory) => {
        const job = await queue.add(indexSourceJobName, {
          analyzedSourcePath,
          directory,
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
