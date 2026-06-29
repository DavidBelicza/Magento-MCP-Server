import type { Pool } from "pg";
import { createVectorStore } from "../../vector/vector-store.js";
import { configEmbeddingsTable } from "./config-embeddings-table.js";

export async function resetConfigVector(pool: Pool): Promise<void> {
  await createVectorStore(pool, configEmbeddingsTable).reset();
}
