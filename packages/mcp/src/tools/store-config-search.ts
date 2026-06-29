import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { type BackendClient, BackendError } from "../client.js";

const description = [
  "Semantic search over Magento admin store configuration (system.xml). Given a plain-English question about where or how to configure something, it returns the most relevant configuration fields by meaning, not keywords.",
  "Use it for questions like \"where do I set the payment gateway URL\" or \"how do I enable guest checkout\". Each result has a `path` (the Magento config path, usable with bin/magento config:set) and a `description` of where the setting lives in the admin, ordered by relevance score.",
  "This is distinct from graph_search: it answers descriptive configuration questions, not structural code questions."
].join(" ");

export function registerStoreConfigSearch(server: McpServer, backend: BackendClient): void {
  server.registerTool(
    "store_config_search",
    {
      title: "Search Magento store configuration",
      description,
      inputSchema: {
        query: z.string().min(1).describe("A plain-English question about a Magento admin configuration setting."),
        limit: z.number().int().min(1).max(20).optional().describe("Maximum number of results (default 5).")
      }
    },
    async ({ query, limit }) => {
      try {
        const response = await backend.searchStoreConfig({ query, limit });
        const payload = { results: response.results ?? [] };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(payload) }],
          structuredContent: payload
        };
      } catch (error) {
        if (error instanceof BackendError && error.status === 400) {
          return {
            content: [{ type: "text" as const, text: `The query was rejected: ${error.message}` }],
            isError: true
          };
        }

        const message = error instanceof BackendError ? error.message : "Store config search failed against the backend.";

        return {
          content: [{ type: "text" as const, text: message }],
          isError: true
        };
      }
    }
  );
}
