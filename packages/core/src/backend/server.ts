import Fastify from "fastify";
import { createNeo4jDriver, createRedisConnection } from "../connections.js";
import { readConfig } from "../config.js";
import { createIndexingQueue, indexingJobName } from "../queue.js";

const config = readConfig();
const app = Fastify({
  logger: true
});

const redis = createRedisConnection();
const neo4jDriver = createNeo4jDriver();
const indexingQueue = createIndexingQueue();

app.get("/api/health", async () => {
  const [redisStatus, neo4jStatus] = await Promise.allSettled([
    redis.ping(),
    neo4jDriver.verifyConnectivity()
  ]);

  return {
    ok: redisStatus.status === "fulfilled" && neo4jStatus.status === "fulfilled",
    service: "backend",
    redis: redisStatus.status === "fulfilled" ? "ok" : "error",
    graphdb: neo4jStatus.status === "fulfilled" ? "ok" : "error"
  };
});

app.post<{ Body: { target?: string } }>("/api/index", async (request, reply) => {
  const target = request.body?.target;

  if (!target) {
    return reply.status(400).send({
      error: "target is required"
    });
  }

  const job = await indexingQueue.add(indexingJobName, {
    target,
    requestedAt: new Date().toISOString()
  });

  return reply.status(202).send({
    jobId: job.id,
    status: "queued"
  });
});

async function start() {
  try {
    await app.listen({
      host: "0.0.0.0",
      port: config.port
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

process.on("SIGTERM", async () => {
  await app.close();
  await indexingQueue.close();
  await redis.quit();
  await neo4jDriver.close();
});

await start();
