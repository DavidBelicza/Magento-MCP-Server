import { Queue } from "bullmq";
import { createRedisConnectionOptions } from "../connections.js";

export type IndexPackagesJob = {
  analyzedSourcePath: string;
  requestedAt: string;
  graphIndexFlow?: boolean;
};

export const indexPackagesQueueName = "index-packages";
export const indexPackagesJobName = "index-packages-job";

export function createIndexPackagesQueue() {
  const queue = new Queue<IndexPackagesJob, unknown, typeof indexPackagesJobName>(
    indexPackagesQueueName,
    {
      connection: createRedisConnectionOptions()
    }
  );

  return {
    add: async (analyzedSourcePath: string) => {
      const job = await queue.add(indexPackagesJobName, {
        analyzedSourcePath,
        requestedAt: new Date().toISOString()
      });

      return {
        id: job.id,
        state: await job.getState()
      };
    },
    getStatus: async (jobId: string) => {
      const job = await queue.getJob(jobId);

      if (!job) {
        return null;
      }

      return {
        id: job.id,
        state: await job.getState()
      };
    },
    close: () => queue.close()
  };
}
