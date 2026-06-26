import type { Driver } from "neo4j-driver";
import neo4j from "neo4j-driver";
import type { GraphSearchOptions, GraphSearchResult } from "../types.js";
import { normalizeGraphSearchResult } from "./normalize-result.js";
import { validateReadOnlyCypher } from "./validate-cypher.js";

const defaultTimeoutMs = 30_000;

export { GraphSearchValidationError } from "./validate-cypher.js";

export class GraphSearchQueryError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "GraphSearchQueryError";
    this.code = code;
  }
}

export async function searchGraph(
  driver: Driver,
  cypherQuery: string,
  options: GraphSearchOptions = {}
): Promise<GraphSearchResult> {
  validateReadOnlyCypher(cypherQuery);

  const session = driver.session({ defaultAccessMode: neo4j.session.READ });

  try {
    const result = await session.executeRead(
      async (tx) => tx.run(cypherQuery),
      {
        timeout: options.timeoutMs ?? defaultTimeoutMs
      }
    );

    return normalizeGraphSearchResult(result);
  } catch (error) {
    if (isNeo4jClientError(error)) {
      throw new GraphSearchQueryError(error.message, error.code);
    }

    throw error;
  } finally {
    await session.close();
  }
}

function isNeo4jClientError(error: unknown): error is { code: string; message: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string" &&
    (error as { code: string }).code.startsWith("Neo.ClientError")
  );
}
