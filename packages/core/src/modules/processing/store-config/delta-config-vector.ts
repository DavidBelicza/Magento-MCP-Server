import type { Pool } from "pg";
import type { EmbeddingConfig } from "../../vector/embedding/types.js";
import { createVectorStore } from "../../vector/vector-store.js";
import { configEmbeddingsTable } from "./config-embeddings-table.js";
import { saveConfigVector } from "./save-config-vector.js";
import type { ConfigFieldDescription } from "./types.js";

export type ConfigVectorDelta = {
  upserted: number;
  deleted: number;
};

export async function deltaConfigVector(
  descriptions: ConfigFieldDescription[],
  pool: Pool,
  embeddingConfig: EmbeddingConfig
): Promise<ConfigVectorDelta> {
  const store = createVectorStore(pool, configEmbeddingsTable);
  const stored = new Map<string, { description: unknown; model: unknown }>();

  for (const row of await store.list()) {
    stored.set(String(row.path), { description: row.description, model: row.model });
  }

  const nextPaths = new Set(descriptions.map((description) => description.path));

  const toUpsert = descriptions.filter((description) => {
    const current = stored.get(description.path);

    return (
      !current || current.description !== description.description || current.model !== embeddingConfig.model
    );
  });

  const toDelete = [...stored.keys()].filter((path) => !nextPaths.has(path));

  await saveConfigVector(toUpsert, pool, embeddingConfig);
  await store.deleteByIds(toDelete);

  return { upserted: toUpsert.length, deleted: toDelete.length };
}
