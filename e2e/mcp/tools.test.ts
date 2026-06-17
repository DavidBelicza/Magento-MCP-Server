import { describe, expect, it } from "vitest";
import { mcpCall } from "../helpers/client";

describe("e2e: MCP endpoint", () => {
  it("lists the three Magentic tools", async () => {
    const { result } = await mcpCall("tools/list");
    const tools = (result?.tools ?? []) as Array<{ name: string }>;
    const names = tools.map((tool) => tool.name);

    expect(names).toEqual(expect.arrayContaining(["get_status", "graph_search", "get_graph_schema"]));
  });

  it("returns the graph schema", async () => {
    const { result } = await mcpCall("tools/call", { name: "get_graph_schema", arguments: {} });
    const content = (result?.content ?? []) as Array<{ type: string; text: string }>;

    expect(content[0]?.type).toBe("text");
    expect(content[0]?.text.length ?? 0).toBeGreaterThan(0);
  });

  it("executes a graph_search call over MCP", async () => {
    const { result } = await mcpCall("tools/call", {
      name: "graph_search",
      arguments: {
        cypherQuery: "MATCH (n) RETURN count(n) AS total LIMIT 1",
        description: "e2e mcp probe"
      }
    });

    const structured = result?.structuredContent as { columns?: string[]; rows?: unknown[] } | undefined;
    expect(structured?.columns).toContain("total");
    expect(structured?.rows).toHaveLength(1);
  });

  it("surfaces a backend rejection for a write query as a tool error", async () => {
    const { result } = await mcpCall("tools/call", {
      name: "graph_search",
      arguments: { cypherQuery: "MATCH (n) DETACH DELETE n", description: "e2e mcp write probe" }
    });

    expect(result?.isError).toBe(true);
  });
});
