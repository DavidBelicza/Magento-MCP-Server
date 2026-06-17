import { describe, expect, it } from "vitest";
import { searchScalar, triggerPackageIndex, waitForIdle } from "../../helpers/client";

describe("e2e: package indexing workflow", () => {
  it("runs the queue -> worker -> Neo4j path and produces Package nodes", async () => {
    await triggerPackageIndex();
    await waitForIdle({ timeoutMs: 90_000 });

    const packageCount = await searchScalar("MATCH (p:Package) RETURN count(p) AS c");
    expect(packageCount).toBeGreaterThan(0);
  });

  it("writes a queryable psr4Namespaces list on Package nodes", async () => {
    const withNamespaces = await searchScalar(
      "MATCH (p:Package) WHERE p.psr4Namespaces IS NOT NULL RETURN count(p) AS c"
    );

    expect(withNamespaces).toBeGreaterThan(0);
  });
});
