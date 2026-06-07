import type { Driver } from "neo4j-driver";
import neo4j from "neo4j-driver";
import type { GraphSearchOptions, GraphSearchResult } from "../types.js";
import { normalizeGraphSearchResult } from "./normalize-result.js";
import { validateReadOnlyCypher } from "./validate-cypher.js";

const defaultTimeoutMs = 30_000;

export { GraphSearchValidationError } from "./validate-cypher.js";

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
  } finally {
    await session.close();
  }
}
