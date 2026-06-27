import type { Pool } from "pg";
import { embedding } from "../../vector/embedding.js";
import type { EmbeddingConfig } from "../../vector/embedding/types.js";
import type { VectorTable } from "../../vector/types.js";
import { createVectorStore } from "../../vector/vector-store.js";
import type { ConfigFieldDescription } from "./types.js";

const configEmbeddingsTable: VectorTable = {
  name: "config_embeddings",
  idColumn: "path",
  embeddingColumn: "embedding",
  dataColumns: ["description", "config_path", "model", "source_file"]
};

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
