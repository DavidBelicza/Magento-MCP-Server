import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { type BackendClient, BackendError } from "../client.js";
import {
  buildGraphPayload,
  buildTablePayload,
  estimateTokens,
  hasGraphEntities,
  readResultShapes
} from "../graph-search-result.js";

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
  "This tool returns a handle, not the data: `resultFormat` is \"graph\" (the query returned nodes/relationships/paths) or \"table\" (only scalar values), `webViewUrl` opens the rendered result in the Magentic web UI (share it with the user), `queryId` identifies the stored result, and `summary` carries `rowCount`/`nodeCount`/`relationshipCount`/`columns` plus `estimatedTokens` for each fetchable form. Inspect the estimate, then call get_graph_search_result(queryId, viewResult) to pull the data only when you need to reason over it.",
  "Choosing what to RETURN controls both size and shape, like SQL SELECT: RETURN scalar properties (e.g. c.fqcn, c.file) for a lean table; RETURN whole nodes plus the relationships between them — or a path — for a connected graph. Returning only nodes gives unconnected nodes; to show edges RETURN the relationship or a path, not just the nodes. To investigate, run narrow projected queries; to give the user something to explore, run a broad query and share its webViewUrl without fetching its data.",
  "Call get_graph_schema if labels/relationships are uncertain, get_status if freshness matters.",
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
        const { result, structured } = readResultShapes(response);
        const hasGraph = hasGraphEntities(structured);

        const estimatedTokens: Record<string, number> = {
          table: estimateTokens(buildTablePayload(result))
        };

        if (hasGraph) {
          estimatedTokens.graph = estimateTokens(buildGraphPayload(result, structured));
        }

        const graphUrl = `${frontendBaseUrl}/graph?queryHistoryId=${response.historyId}`;

        const payload = {
          resultFormat: hasGraph ? "graph" : "table",
          webViewUrl: hasGraph ? graphUrl : `${graphUrl}&view=inspect`,
          queryId: response.historyId,
          summary: {
            rowCount: result.rows?.length ?? 0,
            nodeCount: structured.nodes?.length ?? 0,
            relationshipCount: structured.relationships?.length ?? 0,
            columns: result.columns ?? [],
            estimatedTokens
          }
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(payload) }],
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
