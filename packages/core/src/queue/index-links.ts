import { Queue } from "bullmq";
import { createRedisConnectionOptions } from "../connections.js";

export type IndexLinksJob = {
  symbolId: string | null;
  requestedAt: string;
};

export const indexLinksQueueName = "index-links";
export const indexLinksJobName = "index-links-job";

export function createIndexLinksQueue() {
  const queue = new Queue<IndexLinksJob, unknown, typeof indexLinksJobName>(
    indexLinksQueueName,
    {
      connection: createRedisConnectionOptions()
    }
  );

  return {
    add: async (symbolId: string | null) => {
      const job = await queue.add(indexLinksJobName, {
        symbolId,
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
