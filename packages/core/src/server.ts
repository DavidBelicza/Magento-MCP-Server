import Fastify from "fastify";
import { createNeo4jDriver, createPostgresPool, createRedisConnection } from "./connections.js";
import { readConfig } from "./config.js";
import { createIndexPackagesQueue } from "./queue/index-packages.js";
import { installSchemas } from "./schema/install-schemas.js";
import { GraphSearchValidationError, searchGraph } from "./graph/search/index.js";
import { getQueryHistory, listQueryHistory, saveQueryHistory } from "./search/query-history.js";
import { buildGraphSearchResult } from "./search/result-builder.js";

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

app.post<{ Body: { description?: unknown; cypherQuery?: unknown } }>("/api/graph/search", async (request, reply) => {
  const description = typeof request.body?.description === "string" ? request.body.description : "";
  const cypherQuery = typeof request.body?.cypherQuery === "string" ? request.body.cypherQuery : "";

  if (!description.trim()) {
    return reply.status(400).send({
      ok: false,
      error: "description is required"
    });
  }

  if (!cypherQuery.trim()) {
    return reply.status(400).send({
      ok: false,
      error: "cypherQuery is required"
    });
  }

  try {
    const result = await searchGraph(neo4jDriver, cypherQuery);
    const historyId = await saveQueryHistory(postgres, {
      description,
      cypherQuery,
      result
    });
    const structuredResult = buildGraphSearchResult(result);

    return {
      ok: true,
      historyId,
      description,
      cypherQuery,
      result,
      structuredResult
    };
  } catch (error) {
    if (error instanceof GraphSearchValidationError) {
      return reply.status(400).send({
        ok: false,
        error: error.message
      });
    }

    app.log.error(error);

    return reply.status(500).send({
      ok: false,
      error: "Graph search failed"
    });
  }
});

app.get("/api/graph/get-query-history", async (_request, reply) => {
  try {
    const items = await listQueryHistory(postgres);

    return {
      ok: true,
      items
    };
  } catch (error) {
    app.log.error(error);

    return reply.status(500).send({
      ok: false,
      error: "Query history could not be loaded"
    });
  }
});

app.get<{ Params: { id: string } }>("/api/graph/get-query-history/:id", async (request, reply) => {
  try {
    const history = await getQueryHistory(postgres, request.params.id);

    if (!history) {
      return reply.status(404).send({
        ok: false,
        error: "Query history item not found"
      });
    }

    return {
      ok: true,
      ...history,
      structuredResult: buildGraphSearchResult(history.result)
    };
  } catch (error) {
    app.log.error(error);

    return reply.status(500).send({
      ok: false,
      error: "Query history item could not be loaded"
    });
  }
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
