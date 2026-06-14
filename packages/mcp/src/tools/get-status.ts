import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type BackendClient, BackendError, type InProgressJob } from "../client.js";

const description = [
  "Report whether graph indexing or a full rebuild is currently running.",
  "Call this before graph_search when freshness matters: a locked or in-progress graph may be missing recent changes.",
  "Takes no input."
].join(" ");

function trimItem(item: InProgressJob) {
  return {
    queue: item.queue,
    id: item.id,
    name: item.name,
    state: item.state,
    progress: item.progress,
    timestamp: item.timestamp
  };
}

function buildVerdict(locked: boolean, inProgress: number): string {
  if (locked) {
    return "A full reset/reindex is active; graph results may be incomplete.";
  }

  if (inProgress > 0) {
    return "Indexing is active; recent changes may still be missing.";
  }

  return "Idle; graph search results are ready to use.";
}

export function registerGetStatus(server: McpServer, backend: BackendClient): void {
  server.registerTool(
    "get_status",
    {
      title: "Get graph index status",
      description,
      inputSchema: {}
    },
    async () => {
      try {
        const status = await backend.getStatus();
        const payload = {
          locked: status.locked,
          inProgress: status.inProgress,
          items: status.items.map(trimItem),
          verdict: buildVerdict(status.locked, status.inProgress)
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
          structuredContent: payload
        };
      } catch (error) {
        const message =
          error instanceof BackendError ? error.message : "Failed to read graph index status from the backend.";

        return {
          content: [{ type: "text" as const, text: message }],
          isError: true
        };
      }
    }
  );
}
