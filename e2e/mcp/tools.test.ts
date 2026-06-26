import { describe, expect, it } from "vitest";
import { mcpCall } from "../helpers/client";

type GraphSearchHandle = {
  resultFormat?: string;
  webViewUrl?: string;
  queryId?: string;
  summary?: {
    rowCount?: number;
    columns?: string[];
    estimatedTokens?: Record<string, number>;
  };
};

type FetchedResult = {
  resultFormat?: string;
  columns?: string[];
  rows?: unknown[];
};

describe("e2e: MCP endpoint", () => {
  it("lists the Magentic tools", async () => {
    const { result } = await mcpCall("tools/list");
    const tools = (result?.tools ?? []) as Array<{ name: string }>;
    const names = tools.map((tool) => tool.name);

    expect(names).toEqual(
      expect.arrayContaining(["get_status", "graph_search", "get_graph_search_result", "get_graph_schema"])
    );
  });

  it("returns the graph schema", async () => {
    const { result } = await mcpCall("tools/call", { name: "get_graph_schema", arguments: {} });
    const content = (result?.content ?? []) as Array<{ type: string; text: string }>;

    expect(content[0]?.type).toBe("text");
    expect(content[0]?.text.length ?? 0).toBeGreaterThan(0);
  });

  it("returns a handle with a token estimate instead of inline data", async () => {
    const { result } = await mcpCall("tools/call", {
      name: "graph_search",
      arguments: {
        cypherQuery: "MATCH (n) RETURN count(n) AS total LIMIT 1",
        description: "e2e mcp probe"
      }
    });

    const handle = result?.structuredContent as GraphSearchHandle | undefined;
    expect(handle?.resultFormat).toBe("table");
    expect(handle?.queryId).toEqual(expect.any(String));
    expect(handle?.summary?.columns).toContain("total");
    expect(handle?.summary?.rowCount).toBe(1);
    expect(handle?.summary?.estimatedTokens?.table).toBeGreaterThan(0);
    expect(handle).not.toHaveProperty("rows");
  });

  it("fetches the stored result by queryId", async () => {
    const { result: searchResult } = await mcpCall("tools/call", {
      name: "graph_search",
      arguments: {
        cypherQuery: "MATCH (n) RETURN count(n) AS total LIMIT 1",
        description: "e2e mcp fetch probe"
      }
    });
    const queryId = (searchResult?.structuredContent as GraphSearchHandle | undefined)?.queryId;
    expect(queryId).toEqual(expect.any(String));

    const { result } = await mcpCall("tools/call", {
      name: "get_graph_search_result",
      arguments: { queryId, viewResult: "table" }
    });
    const fetched = result?.structuredContent as FetchedResult | undefined;

    expect(fetched?.resultFormat).toBe("table");
    expect(fetched?.columns).toContain("total");
    expect(fetched?.rows).toHaveLength(1);
  });

  it("surfaces a missing queryId as a tool error", async () => {
    const { result } = await mcpCall("tools/call", {
      name: "get_graph_search_result",
      arguments: { queryId: "00000000-0000-0000-0000-000000000000" }
    });

    expect(result?.isError).toBe(true);
  });

  it("surfaces a backend rejection for a write query as a tool error", async () => {
    const { result } = await mcpCall("tools/call", {
      name: "graph_search",
      arguments: { cypherQuery: "MATCH (n) DETACH DELETE n", description: "e2e mcp write probe" }
    });

    expect(result?.isError).toBe(true);
  });
});
