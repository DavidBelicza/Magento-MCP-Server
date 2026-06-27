export type AppConfig = {
  port: number;
  redisUrl: string;
  postgresUrl: string;
  pgVectorUrl: string;
  neo4jUri: string;
  neo4jUsername: string;
  neo4jPassword: string;
  graphBatchSize: number;
  analyzerPhpUrl: string;
  embedderType: "local" | "remote";
  localEmbedderUrl: string;
  localEmbedderModel: string;
  localEmbedderBearerToken: string | null;
  remoteEmbedderUrl: string;
  remoteEmbedderModel: string;
  remoteEmbedderBearerToken: string | null;
  enableTelemetry: boolean;
};

function readNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function readConfig(): AppConfig {
  return {
    port: readNumber(process.env.PORT, 3000),
    redisUrl: process.env.REDIS_URL ?? "redis://magentic_redis:6379",
    postgresUrl: process.env.POSTGRES_URL ?? "postgres://magentic:dev-password@magentic_postgres:5432/magentic",
    pgVectorUrl:
      process.env.POSTGRES_VECTOR_URL ?? "postgres://magentic:dev-password@magentic_pgvector:5432/magentic_vectors",
    neo4jUri: process.env.NEO4J_URI ?? "bolt://magentic_graphdb:7687",
    neo4jUsername: process.env.NEO4J_USERNAME ?? "neo4j",
    neo4jPassword: process.env.NEO4J_PASSWORD ?? "dev-password",
    graphBatchSize: readNumber(process.env.GRAPH_BATCH_SIZE, 5000),
    analyzerPhpUrl: process.env.ANALYZER_PHP_URL ?? "http://magentic_analyzer_php",
    embedderType: process.env.EMBEDDER_TYPE === "remote" ? "remote" : "local",
    localEmbedderUrl: process.env.LOCAL_EMBEDDER_URL ?? "http://magentic_embedder:8080/v1/embeddings",
    localEmbedderModel: process.env.LOCAL_EMBEDDER_MODEL ?? "embeddinggemma-300m-qat",
    localEmbedderBearerToken: process.env.LOCAL_EMBEDDER_BEARER_TOKEN || null,
    remoteEmbedderUrl: process.env.REMOTE_EMBEDDER_URL ?? "http://host.docker.internal:1234/v1/embeddings",
    remoteEmbedderModel: process.env.REMOTE_EMBEDDER_MODEL ?? "text-embedding-embeddinggemma-300m-qat",
    remoteEmbedderBearerToken: process.env.REMOTE_EMBEDDER_BEARER_TOKEN || null,
    enableTelemetry: process.env.ENABLE_TELEMETRY === "true"
  };
}
