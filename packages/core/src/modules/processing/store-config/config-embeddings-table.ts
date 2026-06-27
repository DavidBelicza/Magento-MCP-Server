import type { VectorTable } from "../../vector/types.js";

export const configEmbeddingsTable: VectorTable = {
  name: "config_embeddings",
  idColumn: "path",
  embeddingColumn: "embedding",
  dataColumns: ["description", "config_path", "model", "source_file"]
};
