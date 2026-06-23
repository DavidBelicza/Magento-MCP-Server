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
  "Response shape: `dataVisualization` is either \"visual graph\" (the query returned nodes/relationships/paths) or \"tabular\" (the query returned only scalar values). `webViewUrl` always points to the rendered result in the Magentic web UI — the graph canvas for a visual graph, the inspection table for tabular — share it with the user.",
  "For a visual graph the response gives `nodes` and `relationships` de-duplicated (each entity appears once, with full properties) plus `rows` where every entity cell is the node's id — join a row's ids back to `nodes`/`relationships` to recover per-row correlation. For tabular results the response gives `columns` and `rows` directly.",
  "Choosing what to RETURN controls both size and shape, like SQL SELECT: RETURN scalar properties (e.g. c.fqcn, c.file) for a lean table; RETURN whole nodes plus the relationships between them — or a path — to get a connected visual graph. Returning only nodes draws unconnected nodes; to show edges you must RETURN the relationship or a path, not just the nodes. Project only the fields you need.",
  "Call get_graph_schema if labels/relationships are uncertain, get_status if freshness matters.",
  "Schema cheat sheet:",
  cheatSheet
].join(" ");

type GraphSearchResultShape = {
  columns?: string[];
  rows?: Array<Record<string, unknown>>;
};

type StructuredResultShape = {
  nodes?: unknown[];
  relationships?: unknown[];
};

function collapseEntityReferences(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(collapseEntityReferences);
  }

  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;

    if (typeof record.id === "string") {
      return record.id;
    }

    const collapsed: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(record)) {
      collapsed[key] = collapseEntityReferences(item);
    }

    return collapsed;
  }

  return value;
}

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
        const result = (response.result ?? {}) as GraphSearchResultShape;
        const structured = (response.structuredResult ?? {}) as StructuredResultShape;
        const columns = result.columns ?? [];
        const rows = result.rows ?? [];
        const nodes = structured.nodes ?? [];
        const relationships = structured.relationships ?? [];
        const hasGraph = nodes.length > 0 || relationships.length > 0;

        const payload: Record<string, unknown> = hasGraph
          ? {
              dataVisualization: "visual graph",
              webViewUrl: `${frontendBaseUrl}/graph?queryHistoryId=${response.historyId}`,
              columns,
              rows: rows.map(collapseEntityReferences),
              nodes,
              relationships
            }
          : {
              dataVisualization: "tabular",
              webViewUrl: `${frontendBaseUrl}/graph?queryHistoryId=${response.historyId}&view=inspect`,
              columns,
              rows
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
