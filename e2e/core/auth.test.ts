import { describe, expect, it } from "vitest";
import { apiToken, baseUrl } from "../helpers/client";

async function status(path: string, headers: Record<string, string> = {}): Promise<number> {
  const response = await fetch(`${baseUrl}${path}`, { headers });
  return response.status;
}

describe("e2e: token auth gate", () => {
  it("rejects an /api request without a token", async () => {
    expect(await status("/api/graph/stats")).toBe(401);
  });

  it("rejects an /api request with the wrong token", async () => {
    expect(await status("/api/graph/stats", { Authorization: "Bearer wrong" })).toBe(401);
  });

  it("accepts an /api request with the correct token", async () => {
    expect(await status("/api/graph/stats", { Authorization: `Bearer ${apiToken}` })).toBe(200);
  });

  it("leaves /api/health open", async () => {
    expect(await status("/api/health")).toBe(200);
  });

  it("leaves the SPA open", async () => {
    expect(await status("/")).toBe(200);
  });

  it("rejects an /mcp request without a token", async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" })
    });
    expect(response.status).toBe(401);
  });
});
