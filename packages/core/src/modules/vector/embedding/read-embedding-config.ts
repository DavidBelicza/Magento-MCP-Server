import { readConfig } from "../../../config.js";
import type { EmbeddingConfig } from "./types.js";

export function readEmbeddingConfig(): EmbeddingConfig {
  const config = readConfig();

  return {
    endpoint: config.embedderUrl,
    model: config.embedderModel,
    bearerToken: config.embedderBearerToken
  };
}
