import { Worker } from "bullmq";
import { createNeo4jDriver, createRedisConnectionOptions } from "../connections.js";
import { indexingJobName, indexingQueueName, type IndexingJob } from "../queue.js";

const neo4jDriver = createNeo4jDriver();

const worker = new Worker<IndexingJob, unknown, typeof indexingJobName>(
  indexingQueueName,
  async (job) => {
    const session = neo4jDriver.session();

    try {
      await session.run(
        "MERGE (t:IndexedTarget {target: $target}) SET t.requestedAt = datetime($requestedAt), t.lastJobId = $jobId",
        {
          target: job.data.target,
          requestedAt: job.data.requestedAt,
          jobId: job.id
        }
      );

      return {
        indexed: job.data.target
      };
    } finally {
      await session.close();
    }
  },
  {
    connection: createRedisConnectionOptions()
  }
);

worker.on("completed", (job) => {
  console.log(`Completed indexing job ${job.id}`);
});

worker.on("failed", (job, error) => {
  console.error(`Indexing job ${job?.id ?? "unknown"} failed`, error);
});

process.on("SIGTERM", async () => {
  await worker.close();
  await neo4jDriver.close();
});
