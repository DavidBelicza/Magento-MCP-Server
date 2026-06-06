import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Driver } from "neo4j-driver";
import type { Pool, PoolClient } from "pg";

type DatabaseType = "postgresql" | "neo4j";

type SchemaScript = {
  id: string;
  databaseType: DatabaseType;
  scriptName: string;
  scriptPath: string;
  checksum: string;
  sql: string;
};

const schemaLockKey = 329908701;

const createSchemaHistorySql = `
CREATE TABLE IF NOT EXISTS application_schema_history (
  id TEXT PRIMARY KEY,
  database_type TEXT NOT NULL,
  script_name TEXT NOT NULL,
  script_checksum TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

export async function installSchemas(postgres: Pool, neo4jDriver: Driver): Promise<void> {
  const schemaRoot = await resolveSchemaRoot();
  const postgresScripts = await readSchemaScripts(schemaRoot, "postgresql", ".sql");
  const neo4jScripts = await readSchemaScripts(schemaRoot, "neo4j", ".cypher");
  const client = await postgres.connect();

  try {
    await client.query("SELECT pg_advisory_lock($1)", [schemaLockKey]);
    await client.query(createSchemaHistorySql);

    for (const script of postgresScripts) {
      await applyPostgresScript(client, script);
    }

    for (const script of neo4jScripts) {
      await applyNeo4jScript(client, neo4jDriver, script);
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [schemaLockKey]).catch(() => undefined);
    client.release();
  }
}

async function applyPostgresScript(client: PoolClient, script: SchemaScript): Promise<void> {
  if (await isScriptApplied(client, script)) {
    return;
  }

  await client.query("BEGIN");

  try {
    await client.query(script.sql);
    await recordScript(client, script);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function applyNeo4jScript(client: PoolClient, neo4jDriver: Driver, script: SchemaScript): Promise<void> {
  if (await isScriptApplied(client, script)) {
    return;
  }

  const session = neo4jDriver.session();

  try {
    for (const statement of splitCypherStatements(script.sql)) {
      await session.executeWrite(async (tx) => {
        await tx.run(statement);
      });
    }
  } finally {
    await session.close();
  }

  await client.query("BEGIN");

  try {
    await recordScript(client, script);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function isScriptApplied(client: PoolClient, script: SchemaScript): Promise<boolean> {
  const result = await client.query<{ script_checksum: string }>(
    "SELECT script_checksum FROM application_schema_history WHERE id = $1",
    [script.id]
  );

  if (result.rowCount === 0) {
    return false;
  }

  const existingChecksum = result.rows[0]?.script_checksum;

  if (existingChecksum !== script.checksum) {
    throw new Error(`Schema script checksum changed after being applied: ${script.id}`);
  }

  return true;
}

async function recordScript(client: PoolClient, script: SchemaScript): Promise<void> {
  await client.query(
    `INSERT INTO application_schema_history (id, database_type, script_name, script_checksum)
     VALUES ($1, $2, $3, $4)`,
    [script.id, script.databaseType, script.scriptName, script.checksum]
  );
}

async function readSchemaScripts(
  schemaRoot: string,
  databaseType: DatabaseType,
  extension: ".sql" | ".cypher"
): Promise<SchemaScript[]> {
  const scriptDirectory = join(schemaRoot, databaseType);
  const scriptNames = (await readdir(scriptDirectory))
    .filter((scriptName) => scriptName.endsWith(extension))
    .sort((left, right) => left.localeCompare(right));
  const scripts: SchemaScript[] = [];

  for (const scriptName of scriptNames) {
    const scriptPath = join(scriptDirectory, scriptName);
    const sql = await readFile(scriptPath, "utf-8");

    scripts.push({
      id: `${databaseType}:${scriptName}`,
      databaseType,
      scriptName,
      scriptPath,
      checksum: createChecksum(sql),
      sql
    });
  }

  return scripts;
}

async function resolveSchemaRoot(): Promise<string> {
  const candidates = [
    join(process.cwd(), "schema"),
    join(dirname(fileURLToPath(import.meta.url)), "../../schema"),
    join(dirname(fileURLToPath(import.meta.url)), "../schema")
  ];

  for (const candidate of candidates) {
    try {
      await readdir(candidate);

      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error("Schema directory was not found");
}

function createChecksum(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function splitCypherStatements(input: string): string[] {
  return input
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}
