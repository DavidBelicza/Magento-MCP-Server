import { describe, expect, it } from "vitest";
import { apiRequest, searchGraph } from "../../helpers/client";

describe("e2e: graph search contract", () => {
  it("runs a read-only query and returns columns and rows", async () => {
    const { status, body } = await searchGraph("MATCH (n) RETURN count(n) AS total LIMIT 1");

    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    const result = body.result as { columns: string[]; rows: Array<Record<string, unknown>> };
    expect(result.columns).toContain("total");
    expect(result.rows).toHaveLength(1);
  });

  it("requires a description", async () => {
    const { status, body } = await apiRequest("/api/graph/search", {
      method: "POST",
      body: JSON.stringify({ cypherQuery: "MATCH (n) RETURN n LIMIT 1" })
    });

    expect(status).toBe(400);
    expect(body.ok).toBe(false);
  });

  it("rejects a write query end-to-end", async () => {
    const { status, body } = await searchGraph("MATCH (n) DETACH DELETE n");

    expect(status).toBe(400);
    expect(body.ok).toBe(false);
    expect(String(body.error)).toMatch(/write, admin, or unsafe procedure/);
  });

  it("rejects a non-read-only starter", async () => {
    const { status, body } = await searchGraph("CREATE (n:Test) RETURN n");

    expect(status).toBe(400);
    expect(body.ok).toBe(false);
  });
});
