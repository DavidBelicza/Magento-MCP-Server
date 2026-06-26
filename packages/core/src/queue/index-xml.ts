import { Queue } from "bullmq";
import { createRedisConnectionOptions } from "../connections.js";

export type IndexXmlOperation = "index" | "delete";

export type IndexXmlJob = {
  analyzedSourcePath: string;
  directories: string[];
  operation: IndexXmlOperation;
  requestedAt: string;
  fullIndexFlow?: boolean;
};

export const indexXmlQueueName = "index-xml";
export const indexXmlJobName = "index-xml-job";

export function createIndexXmlQueue() {
  const queue = new Queue<IndexXmlJob, unknown, typeof indexXmlJobName>(indexXmlQueueName, {
    connection: createRedisConnectionOptions()
  });

  return {
    add: async (
      analyzedSourcePath: string,
      directories: string[],
      operation: IndexXmlOperation = "index"
    ) => {
      const job = await queue.add(indexXmlJobName, {
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
