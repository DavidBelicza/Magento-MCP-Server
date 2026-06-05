export type AppConfig = {
  port: number;
  redisUrl: string;
  neo4jUri: string;
  neo4jUsername: string;
  neo4jPassword: string;
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
    neo4jUri: process.env.NEO4J_URI ?? "bolt://magentic_graphdb:7687",
    neo4jUsername: process.env.NEO4J_USERNAME ?? "neo4j",
    neo4jPassword: process.env.NEO4J_PASSWORD ?? "dev-password"
  };
}
