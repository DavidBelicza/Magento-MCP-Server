import { readFileSync } from "node:fs";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const graphSchema = JSON.parse(
  readFileSync(new URL("../../resource/graph-schema.json", import.meta.url), "utf8")
) as Record<string, unknown>;

const description = [
  "Return the Magentic code-graph schema: node kinds and their labels/properties, relationship types and their edge",
  "properties, and the type-mapping rules. Use it to write correct Cypher for graph_search when labels or",
  "relationships are uncertain. Takes no input."
].join(" ");

export function registerGetGraphSchema(server: McpServer): void {
  server.registerTool(
    "get_graph_schema",
    {
      title: "Get graph schema",
      description,
      inputSchema: {}
    },
    async () => ({
      content: [{ type: "text" as const, text: JSON.stringify(graphSchema) }],
      structuredContent: graphSchema
    })
  );
}
