import type { Pool } from "pg";
import { embedding } from "../../vector/embedding.js";
import type { EmbeddingConfig } from "../../vector/embedding/types.js";
import { createVectorStore } from "../../vector/vector-store.js";
import { configEmbeddingsTable } from "./config-embeddings-table.js";
import type { ConfigFieldDescription } from "./types.js";

export async function saveConfigVector(
  descriptions: ConfigFieldDescription[],
  pool: Pool,
  embeddingConfig: EmbeddingConfig
): Promise<void> {
  if (descriptions.length === 0) {
    return;
  }

  const vectors = await embedding(
    descriptions.map((description) => description.description),
    embeddingConfig
  );
  const store = createVectorStore(pool, configEmbeddingsTable);
  const rows = descriptions.map((description, index) => ({
    path: description.path,
    description: description.description,
    config_path: description.configPath,
    model: embeddingConfig.model,
    source_file: description.sourceFile,
    embedding: vectors[index]
  }));

  await store.upsert(rows);
}
