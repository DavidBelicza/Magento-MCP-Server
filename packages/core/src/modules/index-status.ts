import { Queue, type JobType } from "bullmq";
import { createRedisConnectionOptions } from "../connections.js";
import { deleteGraphQueueName } from "../queue/delete-graph.js";
import { indexLinksQueueName } from "../queue/index-links.js";
import { indexPackagesQueueName } from "../queue/index-packages.js";
import { indexSourceQueueName } from "../queue/index-source.js";

const indexQueueNames = [
  deleteGraphQueueName,
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
    getJob: async (jobId: string, queueName?: string): Promise<InProgressJob | null> => {
      // BullMQ job ids are unique per queue but collide across queues, so a
      // bare id is ambiguous. When a queue is given, look it up there only.
      const candidates = queueName ? queues.filter((queue) => queue.name === queueName) : queues;

      for (const queue of candidates) {
        const job = await queue.getJob(jobId);

        if (job) {
          return {
            queue: queue.name,
            id: job.id,
            name: job.name,
            state: await job.getState(),
            progress: job.progress,
            timestamp: job.timestamp
          };
        }
      }

      return null;
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
