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
  "Read-only Cypher over the Magentic code graph — use it to find and explore the project's code: locate specific symbols (e.g. a class or method by name like getMinimalPrice), and answer structural or general questions about classes, methods, dependencies, composer packages, and their relationships. Always include a LIMIT.",
  "Always also produce a visualization: run a query that RETURNs nodes/relationships/paths so a graphUrl comes back, and give that URL to the user. If they asked for a count or single value, return that too, but still run the graph query and share its graphUrl.",
  "graphUrl is only present when the result contains graph nodes/relationships. Call get_graph_schema if labels/relationships are uncertain, get_status if freshness matters.",
  "Schema cheat sheet:",
  cheatSheet
].join(" ");

export function registerGraphSearch(server: McpServer, backend: BackendClient, frontendBaseUrl: string): void {
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
        const result = (response.result ?? {}) as { columns?: unknown; rows?: unknown };
        const structured = (response.structuredResult ?? {}) as { nodes?: unknown[]; relationships?: unknown[] };
        const hasGraph = (structured.nodes?.length ?? 0) > 0 || (structured.relationships?.length ?? 0) > 0;

        const payload: Record<string, unknown> = {
          columns: result.columns ?? [],
          rows: result.rows ?? []
        };

        if (hasGraph) {
          payload.graphUrl = `${frontendBaseUrl}/graph?queryHistoryId=${response.historyId}`;
        }

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
