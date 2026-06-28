import type { Pool } from "pg";
import type { EmbeddingConfig } from "../../vector/embedding/types.js";
import { createVectorStore } from "../../vector/vector-store.js";
import { computeConfigVectorDelta, type StoredConfigRow } from "./compute-config-vector-delta.js";
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
  const stored = new Map<string, StoredConfigRow>();

  for (const row of await store.list()) {
    stored.set(String(row.path), { description: row.description, model: row.model });
  }

  const { toUpsert, toDelete } = computeConfigVectorDelta(descriptions, stored, embeddingConfig.model);

  await saveConfigVector(toUpsert, pool, embeddingConfig);
  await store.deleteByIds(toDelete);

  return { upserted: toUpsert.length, deleted: toDelete.length };
}
