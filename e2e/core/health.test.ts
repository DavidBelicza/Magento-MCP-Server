import { beforeAll, describe, expect, it } from "vitest";
import { apiRequest, baseUrl } from "../helpers/client";

describe("e2e: stack health", () => {
  beforeAll(async () => {
    const { status } = await apiRequest("/api/health").catch(() => ({ status: 0 }));

    if (status === 0) {
      throw new Error(
        `Stack is not reachable at ${baseUrl}. Start it with "npm run docker:up" or set MAGENTIC_E2E_BASE_URL.`
      );
    }
  });

  it("reports all backing services healthy", async () => {
    const { status, body } = await apiRequest("/api/health");

    expect(status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      service: "backend",
      redis: "ok",
      postgres: "ok",
      graphdb: "ok"
    });
  });

  it("exposes graph stats", async () => {
    const { status, body } = await apiRequest("/api/graph/stats");

    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(typeof body.nodeCount).toBe("number");
    expect(typeof body.relationshipCount).toBe("number");
  });
});
