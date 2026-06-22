import { Worker, type Job } from "bullmq";
import type { Driver } from "neo4j-driver";
import { createRedisConnectionOptions } from "../connections.js";
import { classifyConfigXml, orderedConfigXmlBasenames } from "../modules/processing/magento-xml/discovery.js";
import { findConfigXmlFiles } from "../modules/processing/magento-xml/find-xml-files.js";
import { processXmlFiles } from "../modules/processing/magento-xml/process-xml-files.js";
import { deleteMagentoXmlByPaths, saveMagentoXmlGraph } from "../modules/processing/magento-xml/save-graph.js";
import { indexXmlJobName, indexXmlQueueName, type IndexXmlJob } from "../queue/index-xml.js";

type IndexXmlResult = {
  analyzedSourcePath: string;
  directories: string[];
  status: "accepted";
};

export function createIndexXmlWorker(driver: Driver, batchSize: number) {
  const worker = new Worker<IndexXmlJob, IndexXmlResult, typeof indexXmlJobName>(
    indexXmlQueueName,
    (job) => handleJob(job, driver, batchSize),
    {
      connection: createRedisConnectionOptions()
    }
  );

  worker.on("completed", (job) => {
    console.log(`Completed index-xml job ${job.id}`);
  });

  worker.on("failed", (job, error) => {
    console.error(`Index-xml job ${job?.id ?? "unknown"} failed`, error);
  });

  return worker;
}

async function handleJob(job: Job<IndexXmlJob>, driver: Driver, batchSize: number): Promise<IndexXmlResult> {
  const mountPath = job.data.analyzedSourcePath;

  if (job.data.operation === "delete") {
    return handleDeleteJob(job, driver);
  }

  const entries = job.data.directories.length > 0 ? job.data.directories : ["."];

  await job.updateProgress({ phase: "accepted", percent: 0 });

  const relativePaths = await findConfigXmlFiles(mountPath, entries);
  const filesByType = groupByBasename(relativePaths);
  const steps = orderedConfigXmlBasenames.filter((basename) => filesByType.has(basename));
  const total = steps.length;
  let nodes = 0;
  let edges = 0;

  for (let index = 0; index < total; index += 1) {
    const basename = steps[index];

    await job.updateProgress({ phase: "processing", step: basename, steps, current: index + 1, total, nodes, edges });

    const processed = await processXmlFiles(mountPath, filesByType.get(basename) ?? []);
    const summary = await saveMagentoXmlGraph(driver, processed.nodes, processed.relationships, processed.files, batchSize);
    nodes += summary.nodeCount;
    edges += summary.relationshipCount;
  }

  await job.updateProgress({ phase: "completed", percent: 100, steps, total, nodes, edges });

  return accepted(job);
}

function groupByBasename(relativePaths: string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();

  for (const relativePath of relativePaths) {
    const classification = classifyConfigXml(relativePath);

    if (!classification) {
      continue;
    }

    const group = groups.get(classification.basename) ?? [];
    group.push(relativePath);
    groups.set(classification.basename, group);
  }

  return groups;
}

async function handleDeleteJob(job: Job<IndexXmlJob>, driver: Driver): Promise<IndexXmlResult> {
  await job.updateProgress({ phase: "deleting", percent: 0 });

  const paths = job.data.directories.length > 0 ? job.data.directories : [];
  await deleteMagentoXmlByPaths(driver, paths);

  await job.updateProgress({ phase: "completed", percent: 100 });

  return accepted(job);
}

function accepted(job: Job<IndexXmlJob>): IndexXmlResult {
  return {
    analyzedSourcePath: job.data.analyzedSourcePath,
    directories: job.data.directories,
    status: "accepted"
  };
}
