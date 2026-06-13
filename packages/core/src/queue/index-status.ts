import { Queue, type JobType } from "bullmq";
import { createRedisConnectionOptions } from "../connections.js";
import { graphWipeQueueName } from "./graph-wipe.js";
import { indexLinksQueueName } from "./index-links.js";
import { indexPackagesQueueName } from "./index-packages.js";
import { indexSourceQueueName } from "./index-source.js";

const indexQueueNames = [
  graphWipeQueueName,
  indexPackagesQueueName,
  indexSourceQueueName,
  indexLinksQueueName
];

const inProgressStates: JobType[] = ["active", "waiting", "waiting-children", "delayed", "prioritized"];

export type InProgressJob = {
  queue: string;
  id: string | undefined;
  name: string;
  state: string;
  progress: unknown;
  timestamp: number;
};

export function createIndexStatus() {
  const queues = indexQueueNames.map(
    (name) => new Queue(name, { connection: createRedisConnectionOptions() })
  );

  return {
    getInProgress: async (): Promise<InProgressJob[]> => {
      const grouped = await Promise.all(queues.map((queue) => collectQueueJobs(queue)));

      return grouped.flat().sort((left, right) => left.timestamp - right.timestamp);
    },
    close: async () => {
      await Promise.all(queues.map((queue) => queue.close()));
    }
  };
}

async function collectQueueJobs(queue: Queue): Promise<InProgressJob[]> {
  const jobs = await queue.getJobs(inProgressStates);

  return Promise.all(
    jobs.map(async (job) => ({
      queue: queue.name,
      id: job.id,
      name: job.name,
      state: await job.getState(),
      progress: job.progress,
      timestamp: job.timestamp
    }))
  );
}
