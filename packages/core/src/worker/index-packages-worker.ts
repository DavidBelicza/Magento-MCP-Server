import { Worker } from "bullmq";
import type { Driver } from "neo4j-driver";
import {
  indexPackagesJobName,
  indexPackagesQueueName,
  type IndexPackagesJob
} from "../queue/index-packages.js";
import { createRedisConnectionOptions } from "../connections.js";
import { parseComposerLock } from "../modules/processing/composer-lock/parse-composer-lock.js";
import { saveComposerLockGraph } from "../modules/processing/composer-lock/save-graph.js";

type IndexPackagesResult = {
  composerLockPath: string;
  packageCount: number;
  authorCount: number;
  edgeCount: number;
  totalCount: number;
};

export function createIndexPackagesWorker(neo4jDriver: Driver) {
  const worker = new Worker<IndexPackagesJob, IndexPackagesResult, typeof indexPackagesJobName>(
    indexPackagesQueueName,
    async (job) => {
      await job.updateProgress({
        phase: "parsing",
        processed: 0,
        total: 0,
        percent: 0
      });

      const result = await parseComposerLock(job.data.analyzedSourcePath);
      const writeSummary = await saveComposerLockGraph(neo4jDriver, result.records, {
        onProgress: (progress) => job.updateProgress(progress)
      });

      return {
        composerLockPath: result.composerLockPath,
        packageCount: writeSummary.packageCount,
        authorCount: writeSummary.authorCount,
        edgeCount: writeSummary.edgeCount,
        totalCount: writeSummary.totalCount
      };
    },
    {
      connection: createRedisConnectionOptions()
    }
  );

  worker.on("completed", (job) => {
    console.log(`Completed index-packages job ${job.id}`);
  });

  worker.on("failed", (job, error) => {
    console.error(`Index-packages job ${job?.id ?? "unknown"} failed`, error);
  });

  return worker;
}
