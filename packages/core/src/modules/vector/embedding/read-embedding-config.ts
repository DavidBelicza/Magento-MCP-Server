import { readConfig } from "../../../config.js";
import { getAppSettings } from "../../app-config.js";
import type { EmbeddingConfig } from "./types.js";

export function readEmbeddingConfig(): EmbeddingConfig {
  const config = readConfig();
  const settings = getAppSettings();

  if (settings.embedderType === "remote") {
    return {
      endpoint: settings.remoteEmbedderUrl,
      model: settings.remoteEmbedderModel,
      bearerToken: settings.remoteEmbedderBearerToken === "" ? null : settings.remoteEmbedderBearerToken
    };
  }

  return {
    endpoint: config.localEmbedderUrl,
    model: config.localEmbedderModel,
    bearerToken: config.localEmbedderBearerToken
  };
}
