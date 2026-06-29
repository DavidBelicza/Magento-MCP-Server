import type { EmbeddingConfig } from "./types.js";

type EmbeddingResponse = {
  data?: Array<{ embedding: number[] }>;
};

export async function requestEmbeddings(texts: string[], config: EmbeddingConfig): Promise<number[][]> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (config.bearerToken) {
    headers.Authorization = `Bearer ${config.bearerToken}`;
  }

  const response = await fetch(config.endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ input: texts, model: config.model })
  });

  if (!response.ok) {
    throw new Error(`Embedding request failed (${response.status}): ${await response.text()}`);
  }

  const body = (await response.json()) as EmbeddingResponse;

  return (body.data ?? []).map((item) => item.embedding);
}
