import { Redis } from "ioredis";
import neo4j from "neo4j-driver";
import pg from "pg";
import { readConfig } from "./config.js";

const { Pool } = pg;

export function createRedisConnection() {
  const config = readConfig();

  return new Redis(config.redisUrl, {
    maxRetriesPerRequest: null
  });
}

export function createRedisConnectionOptions() {
  const config = readConfig();
  const url = new URL(config.redisUrl);

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    password: url.password || undefined,
    maxRetriesPerRequest: null
  };
}

export function createNeo4jDriver() {
  const config = readConfig();

  return neo4j.driver(
    config.neo4jUri,
    neo4j.auth.basic(config.neo4jUsername, config.neo4jPassword)
  );
}

export function createPostgresPool() {
  const config = readConfig();

  return new Pool({
    connectionString: config.postgresUrl
  });
}

export function createPgVectorPool() {
  const config = readConfig();

  return new Pool({
    connectionString: config.pgVectorUrl
  });
}
