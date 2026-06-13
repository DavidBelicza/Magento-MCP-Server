import { Worker } from "bullmq";
import type { Driver } from "neo4j-driver";
import { createRedisConnectionOptions } from "../connections.js";
import { deleteGraph } from "../modules/graph/delete-graph.js";
import {
  deleteGraphJobName,
  deleteGraphQueueName,
  type DeleteGraphJob
} from "../queue/delete-graph.js";

export function createDeleteGraphWorker(driver: Driver) {
  const worker = new Worker<DeleteGraphJob, void, typeof deleteGraphJobName>(
    deleteGraphQueueName,
    async () => {
      await deleteGraph(driver);
    },
    {
      connection: createRedisConnectionOptions()
    }
  );

  worker.on("completed", (job) => {
    console.log(`Completed delete-graph job ${job.id}`);
  });

  worker.on("failed", (job, error) => {
    console.error(`Delete-graph job ${job?.id ?? "unknown"} failed`, error);
  });

  return worker;
}
