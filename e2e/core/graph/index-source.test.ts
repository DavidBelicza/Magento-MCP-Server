import { beforeAll, describe, expect, it } from "vitest";
import { searchScalar, triggerLinks, triggerSourceIndex, waitForIdle } from "../../helpers/client";

const sourceModule = process.env.MAGENTIC_E2E_SOURCE_MODULE ?? "vendor/magento/module-catalog";
const modulePrefix = `${sourceModule.replace(/\/+$/, "")}/`;
const packageName = sourceModule.split("/").slice(-2).join("/");
const knownClassFile = `${modulePrefix}Model/Product.php`;
const runRealModule = process.env.MAGENTIC_E2E_FIXTURE !== "1";

describe.skipIf(!runRealModule)(`e2e: source + links indexing (${packageName})`, () => {
  beforeAll(async () => {
    await triggerSourceIndex([sourceModule]);
    await waitForIdle({ timeoutMs: 180_000 });

    const indexedClasses = await searchScalar(
      `MATCH (c:Class) WHERE c.file STARTS WITH '${modulePrefix}' RETURN count(c) AS c`
    );

    if (indexedClasses === 0) {
      throw new Error(
        `No classes indexed under '${modulePrefix}'. Is the module present in the mounted source?`
      );
    }

    await triggerLinks();
    await waitForIdle({ timeoutMs: 180_000 });
  }, 420_000);

  it("indexes the module's classes, including a known stable class", async () => {
    const knownClass = await searchScalar(
      `MATCH (c:Class) WHERE c.file = '${knownClassFile}' RETURN count(c) AS c`
    );

    expect(knownClass).toBeGreaterThan(0);
  });

  it("records methods on the indexed classes", async () => {
    const methodCount = await searchScalar(
      `MATCH (c:Class)-[:HAS_METHOD]->(m) WHERE c.file STARTS WITH '${modulePrefix}' RETURN count(m) AS c`
    );

    expect(methodCount).toBeGreaterThan(0);
  });

  it("records inheritance edges from the module's classes", async () => {
    const inheritance = await searchScalar(
      `MATCH (c:Class)-[r:EXTENDS|IMPLEMENTS]->() WHERE c.file STARTS WITH '${modulePrefix}' RETURN count(r) AS c`
    );

    expect(inheritance).toBeGreaterThan(0);
  });

  it("records method parameter/return type edges from the module", async () => {
    const typeEdges = await searchScalar(
      `MATCH (m:Method)-[r:PARAM_TYPE|RETURNS_TYPE]->() WHERE m.file STARTS WITH '${modulePrefix}' RETURN count(r) AS c`
    );

    expect(typeEdges).toBeGreaterThan(0);
  });

  it("has the composer Package node for the module with a version", async () => {
    const withVersion = await searchScalar(
      `MATCH (p:Package {name: '${packageName}'}) WHERE p.version IS NOT NULL AND p.version <> '' RETURN count(p) AS c`
    );

    expect(withVersion).toBeGreaterThan(0);
  });

  it("links the module's declared symbols to its package after index/links", async () => {
    const declared = await searchScalar(
      `MATCH (s:Symbol)-[:DECLARED_IN_PACKAGE]->(p:Package {name: '${packageName}'}) RETURN count(s) AS c`
    );

    expect(declared).toBeGreaterThan(0);
  });
});
