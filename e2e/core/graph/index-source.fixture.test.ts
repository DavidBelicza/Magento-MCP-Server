import { beforeAll, describe, expect, it } from "vitest";
import {
  searchScalar,
  triggerLinks,
  triggerPackageIndex,
  triggerSourceIndex,
  waitForIdle
} from "../../helpers/client";

const runFixture = process.env.MAGENTIC_E2E_FIXTURE === "1";

describe.skipIf(!runFixture)("e2e: source + links indexing (sample fixture)", () => {
  beforeAll(async () => {
    await triggerPackageIndex();
    await waitForIdle({ timeoutMs: 60_000 });

    await triggerSourceIndex(["vendor/acme/widget"]);
    await waitForIdle({ timeoutMs: 60_000 });

    await triggerLinks();
    await waitForIdle({ timeoutMs: 60_000 });
  }, 240_000);

  it("indexes exactly the fixture's classes and interface", async () => {
    expect(await searchScalar("MATCH (c:Class) RETURN count(c) AS c")).toBe(2);
    expect(await searchScalar("MATCH (i:Interface) RETURN count(i) AS c")).toBe(1);
    expect(await searchScalar("MATCH (m:Method) RETURN count(m) AS c")).toBe(6);
  });

  it("records the single inheritance edge (Widget extends AbstractWidget)", async () => {
    expect(
      await searchScalar(
        "MATCH (:Class {id: 'Acme\\\\Widget\\\\Model\\\\Widget'})-[:EXTENDS]->(:Class {id: 'Acme\\\\Widget\\\\Model\\\\AbstractWidget'}) RETURN count(*) AS c"
      )
    ).toBe(1);
  });

  it("records the single interface implementation (Widget implements WidgetInterface)", async () => {
    expect(
      await searchScalar(
        "MATCH (:Class {id: 'Acme\\\\Widget\\\\Model\\\\Widget'})-[:IMPLEMENTS]->(:Interface {id: 'Acme\\\\Widget\\\\Api\\\\WidgetInterface'}) RETURN count(*) AS c"
      )
    ).toBe(1);
  });

  it("records method parameter and return type edges", async () => {
    expect(
      await searchScalar(
        "MATCH (:Method {id: 'Acme\\\\Widget\\\\Model\\\\Widget::withParent'})-[:PARAM_TYPE]->(:Class {id: 'Acme\\\\Widget\\\\Model\\\\AbstractWidget'}) RETURN count(*) AS c"
      )
    ).toBe(1);
    expect(
      await searchScalar(
        "MATCH (:Method {id: 'Acme\\\\Widget\\\\Model\\\\Widget::withParent'})-[:RETURNS_TYPE]->(:Interface {id: 'Acme\\\\Widget\\\\Api\\\\WidgetInterface'}) RETURN count(*) AS c"
      )
    ).toBe(1);
  });

  it("links all three declared symbols to the package", async () => {
    expect(
      await searchScalar(
        "MATCH (s:Symbol)-[:DECLARED_IN_PACKAGE]->(:Package {name: 'acme/widget'}) RETURN count(s) AS c"
      )
    ).toBe(3);
  });

  it("records the package dependency edge from the composer.lock require", async () => {
    expect(
      await searchScalar(
        "MATCH (:Package {name: 'acme/widget'})-[:PACKAGE_REQUIRES_PACKAGE]->(:Package {name: 'acme/core'}) RETURN count(*) AS c"
      )
    ).toBe(1);
  });
});
