import Fastify from "fastify";
import { createNeo4jDriver, createPostgresPool, createRedisConnection } from "./connections.js";
import { readConfig } from "./config.js";
import { createIndexPackagesQueue } from "./queue/index-packages.js";
import { installSchemas } from "./schema/install-schemas.js";

const config = readConfig();
const app = Fastify({
  logger: true
});

const redis = createRedisConnection();
const postgres = createPostgresPool();
const neo4jDriver = createNeo4jDriver();
const indexPackagesQueue = createIndexPackagesQueue();

app.get("/api/health", async () => {
  const [redisStatus, postgresStatus, neo4jStatus] = await Promise.allSettled([
    redis.ping(),
    postgres.query("SELECT 1"),
    neo4jDriver.verifyConnectivity()
  ]);

  return {
    ok: redisStatus.status === "fulfilled" && postgresStatus.status === "fulfilled" && neo4jStatus.status === "fulfilled",
    service: "backend",
    redis: redisStatus.status === "fulfilled" ? "ok" : "error",
    postgres: postgresStatus.status === "fulfilled" ? "ok" : "error",
    graphdb: neo4jStatus.status === "fulfilled" ? "ok" : "error"
  };
});

app.post("/api/index/packages", async (_request, reply) => {
  const job = await indexPackagesQueue.add(
    process.env.MAGENTIC_ANALYZED_SOURCE_PATH ?? "/mnt/analyzed-source"
  );

  return reply.status(202).send({
    ok: true,
    status: job.state,
    jobId: job.id,
    message: "Package indexing request accepted."
  });
});

app.get<{ Querystring: { jobId?: string } }>("/api/index/get-status", async (request, reply) => {
  const jobId = request.query.jobId;

  if (!jobId) {
    return reply.status(400).send({
      ok: false,
      error: "jobId is required"
    });
  }

  const job = await indexPackagesQueue.getStatus(jobId);

  if (!job) {
    return reply.status(404).send({
      ok: false,
      error: "job not found"
    });
  }

  return {
    ok: true,
    jobId: job.id,
    status: job.state,
    message: "Index status loaded."
  };
});

async function start() {
  try {
    await installSchemas(postgres, neo4jDriver);
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
  await indexPackagesQueue.close();
  await redis.quit();
  await postgres.end();
  await neo4jDriver.close();
});

await start();
