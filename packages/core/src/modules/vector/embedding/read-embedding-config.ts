import { readConfig } from "../../../config.js";
import type { EmbeddingConfig } from "./types.js";

export function readEmbeddingConfig(): EmbeddingConfig {
  const config = readConfig();

  if (config.embedderType === "remote") {
    return {
      endpoint: config.remoteEmbedderUrl,
      model: config.remoteEmbedderModel,
      bearerToken: config.remoteEmbedderBearerToken
    };
  }

  return {
    endpoint: config.localEmbedderUrl,
    model: config.localEmbedderModel,
    bearerToken: config.localEmbedderBearerToken
  };
}
