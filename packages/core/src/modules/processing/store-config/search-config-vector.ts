import type { Pool } from "pg";
import { embedding } from "../../vector/embedding.js";
import type { EmbeddingConfig } from "../../vector/embedding/types.js";
import { createVectorStore } from "../../vector/vector-store.js";
import { configEmbeddingsTable } from "./config-embeddings-table.js";
import type { ConfigVectorMatch } from "./types.js";

export async function searchConfigVector(
  query: string,
  pool: Pool,
  embeddingConfig: EmbeddingConfig,
  limit: number
): Promise<ConfigVectorMatch[]> {
  const [vector] = await embedding([query], embeddingConfig);

  if (!vector) {
    return [];
  }

  const matches = await createVectorStore(pool, configEmbeddingsTable).search(vector, limit);

  return matches.map((match) => ({
    path: (match.row.config_path as string | null) ?? (match.row.path as string),
    description: match.row.description as string,
    score: match.score
  }));
}
