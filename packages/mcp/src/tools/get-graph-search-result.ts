import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { type BackendClient, BackendError } from "../client.js";
import {
  buildGraphPayload,
  buildTablePayload,
  hasGraphEntities,
  type GraphSearchResultShape,
  type StructuredResultShape
} from "../graph-search-result.js";

const description = [
  "Fetch the full stored result of an earlier graph_search by its queryId.",
  "graph_search returns only a handle plus an estimatedTokens figure per form; call this once you have decided the cost is worth it.",
  "viewResult selects the form: \"table\" returns columns and rows (entity cells are node ids); \"graph\" returns de-duplicated nodes and relationships plus rows whose entity cells are node ids (join ids back to recover per-row correlation). Requesting \"graph\" for a result that has no graph entities falls back to the table form."
].join(" ");

export function registerGetGraphSearchResult(server: McpServer, backend: BackendClient): void {
  server.registerTool(
    "get_graph_search_result",
    {
      title: "Get a stored graph search result",
      description,
      inputSchema: {
        queryId: z.string().min(1).describe("The queryId returned by graph_search."),
        viewResult: z
          .enum(["graph", "table"])
          .optional()
          .describe("Which form to return; defaults to the result's natural format.")
      }
    },
    async ({ queryId, viewResult }) => {
      try {
        const response = await backend.getGraphSearchResult(queryId);
        const result = (response.result ?? {}) as GraphSearchResultShape;
        const structured = (response.structuredResult ?? {}) as StructuredResultShape;
        const hasGraph = hasGraphEntities(structured);
        const wantsGraph = (viewResult ?? (hasGraph ? "graph" : "table")) === "graph" && hasGraph;

        const payload = wantsGraph
          ? { resultFormat: "graph", ...buildGraphPayload(result, structured) }
          : { resultFormat: "table", ...buildTablePayload(result) };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(payload) }],
          structuredContent: payload
        };
      } catch (error) {
        if (error instanceof BackendError && error.status === 404) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No stored result for queryId ${queryId}; run graph_search first.`
              }
            ],
            isError: true
          };
        }

        const message =
          error instanceof BackendError ? error.message : "Fetching the stored query result failed.";

        return {
          content: [{ type: "text" as const, text: message }],
          isError: true
        };
      }
    }
  );
}
