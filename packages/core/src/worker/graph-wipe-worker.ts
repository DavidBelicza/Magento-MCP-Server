import { Worker } from "bullmq";
import type { Driver } from "neo4j-driver";
import { createRedisConnectionOptions } from "../connections.js";
import { wipeGraph } from "../modules/graph/wipe-graph.js";
import {
  graphWipeJobName,
  graphWipeQueueName,
  type GraphWipeJob
} from "../queue/graph-wipe.js";

export function createGraphWipeWorker(driver: Driver) {
  const worker = new Worker<GraphWipeJob, void, typeof graphWipeJobName>(
    graphWipeQueueName,
    async () => {
      await wipeGraph(driver);
    },
    {
      connection: createRedisConnectionOptions()
    }
  );

  worker.on("completed", (job) => {
    console.log(`Completed graph-wipe job ${job.id}`);
  });

  worker.on("failed", (job, error) => {
    console.error(`Graph-wipe job ${job?.id ?? "unknown"} failed`, error);
  });

  return worker;
}
