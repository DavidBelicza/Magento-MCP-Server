import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { type BackendClient, BackendError } from "../client.js";

const cheatSheet = [
  "PHP symbols carry combined labels, e.g. :Symbol:PHP:Class (also Interface, Trait, Enum, Method), so MATCH (c:Class) works.",
  "Composer nodes are :Package and :Author.",
  "Common relationships: EXTENDS, IMPLEMENTS, USES, HAS_METHOD, PARAM_TYPE, RETURNS_TYPE, DECLARED_IN_PACKAGE,",
  "PACKAGE_REQUIRES_PACKAGE, PACKAGE_REQUIRES_DEV_PACKAGE, PACKAGE_AUTHORED_BY, PACKAGE_SUGGESTS_PACKAGE,",
  "PACKAGE_REPLACES_PACKAGE, PACKAGE_PROVIDES_PACKAGE, PACKAGE_CONFLICTS_WITH_PACKAGE.",
  "Symbol ids are FQNs; method ids are <owner FQN>::<method name>."
].join(" ");

const description = [
  "Run a read-only Cypher query against the Magentic code graph.",
  "Always include a LIMIT.",
  "Call get_status first if graph freshness matters, and get_graph_schema if labels or relationships are uncertain.",
  "Writes, admin procedures, multiple statements, and unsafe procedures are rejected by the backend.",
  "Schema cheat sheet:",
  cheatSheet
].join(" ");

export function registerGraphSearch(server: McpServer, backend: BackendClient): void {
  server.registerTool(
    "graph_search",
    {
      title: "Search the code graph",
      description,
      inputSchema: {
        cypherQuery: z.string().min(1).describe("A read-only Cypher query. Always include a LIMIT."),
        description: z.string().min(1).describe("The plain-language goal behind the query; stored in query history.")
      }
    },
    async ({ cypherQuery, description: queryDescription }) => {
      try {
        const response = await backend.searchGraph({ cypherQuery, description: queryDescription });
        const payload = {
          historyId: response.historyId,
          description: response.description,
          cypherQuery: response.cypherQuery,
          result: response.structuredResult
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
          structuredContent: payload
        };
      } catch (error) {
        if (error instanceof BackendError && error.status === 400) {
          return {
            content: [
              {
                type: "text" as const,
                text: `The query was rejected by the backend (fix and retry): ${error.message}`
              }
            ],
            isError: true
          };
        }

        const message =
          error instanceof BackendError ? error.message : "Graph search failed against the backend.";

        return {
          content: [{ type: "text" as const, text: message }],
          isError: true
        };
      }
    }
  );
}
