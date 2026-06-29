import { logger } from "../../logger.js";
import { estimateTokens } from "./embedding/estimate-tokens.js";
import { requestEmbeddings } from "./embedding/request-embeddings.js";
import type { EmbeddingConfig } from "./embedding/types.js";

const maxTokens = 1800;
const charsPerToken = 3;

export async function embedding(texts: string[], config: EmbeddingConfig): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  return requestEmbeddings(texts.map(capInput), config);
}

function capInput(text: string): string {
  if (estimateTokens(text) <= maxTokens) {
    return text;
  }

  logger.warn(
    { event: "embedding_input_truncated", estimatedTokens: estimateTokens(text) },
    "Embedding input exceeded the token budget and was truncated"
  );

  return text.slice(0, maxTokens * charsPerToken);
}
