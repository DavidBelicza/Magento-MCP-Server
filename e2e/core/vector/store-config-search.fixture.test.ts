import { beforeAll, describe, expect, it } from "vitest";
import {
  apiRequest,
  mcpCall,
  searchVector,
  triggerVectorDelta,
  triggerVectorReindex,
  waitForVectorIdle,
  type VectorMatch
} from "../../helpers/client";

const runFixture = process.env.MAGENTIC_E2E_FIXTURE === "1";

const paymentPath = "widget/payment/api_key";
const enabledPath = "widget/general/enabled";

function topPath(matches: VectorMatch[]): string {
  return matches[0]?.path ?? "";
}

describe.skipIf(!runFixture)("e2e: store-config vector search (sample fixture)", () => {
  beforeAll(async () => {
    await triggerVectorReindex();
    await waitForVectorIdle({ timeoutMs: 120_000 });
  }, 180_000);

  it("ranks the payment gateway field first for a payment question", async () => {
    const matches = await searchVector("where do I set the payment gateway api key", 5);

    expect(matches.length).toBeGreaterThan(0);
    expect(topPath(matches)).toBe(paymentPath);
    expect(matches[0]?.score).toBeGreaterThan(0);
  });

  it("ranks the enable field first for an on/off question", async () => {
    const matches = await searchVector("how do I turn the widget on or off", 5);

    expect(topPath(matches)).toBe(enabledPath);
  });

  it("orders results by descending score", async () => {
    const matches = await searchVector("widget configuration", 5);
    const scores = matches.map((match) => match.score);

    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it("honors the result limit", async () => {
    const matches = await searchVector("widget configuration", 1);

    expect(matches).toHaveLength(1);
  });

  it("rejects an empty query", async () => {
    const { status, body } = await apiRequest("/api/vector/search", {
      method: "POST",
      body: JSON.stringify({ query: "   " })
    });

    expect(status).toBe(400);
    expect(body.ok).toBe(false);
  });

  it("skips a delta with no store-config paths without locking", async () => {
    const { status, body } = await triggerVectorDelta(["app/code/Acme/Foo/Model/Config.php"]);

    expect(status).toBe(200);
    expect(body.skipped).toBe(true);
  });

  it("answers the same question through the store_config_search MCP tool", async () => {
    const { result } = await mcpCall("tools/call", {
      name: "store_config_search",
      arguments: { query: "where do I set the payment gateway api key", limit: 5 }
    });

    const payload = result?.structuredContent as { results?: VectorMatch[] } | undefined;

    expect(payload?.results?.length ?? 0).toBeGreaterThan(0);
    expect(topPath(payload?.results ?? [])).toBe(paymentPath);
  });

  it("rejects an empty MCP query as a tool error", async () => {
    const { result, error } = await mcpCall("tools/call", {
      name: "store_config_search",
      arguments: { query: "" }
    });

    expect(result?.isError === true || error !== undefined).toBe(true);
  });
});
