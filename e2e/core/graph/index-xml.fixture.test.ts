import { beforeAll, describe, expect, it } from "vitest";
import { searchScalar, triggerXmlIndex, waitForIdle } from "../../helpers/client";

const runFixture = process.env.MAGENTIC_E2E_FIXTURE === "1";

describe.skipIf(!runFixture)("e2e: XML indexing (sample fixture)", () => {
  beforeAll(async () => {
    await triggerXmlIndex(["vendor/acme/widget"]);
    await waitForIdle({ timeoutMs: 60_000 });
  }, 120_000);

  it("creates exactly the fixture's config-entity nodes", async () => {
    expect(await searchScalar("MATCH (e:Event) RETURN count(e) AS c")).toBe(1);
    expect(await searchScalar("MATCH (g:CronGroup) RETURN count(g) AS c")).toBe(1);
  });

  it("records the di.xml preference edge from interface to concrete class", async () => {
    expect(
      await searchScalar(
        "MATCH (:PHPClass {id: 'Acme\\\\Widget\\\\Api\\\\WidgetInterface'})-[:PREFERENCE_FOR]->(:PHPClass {id: 'Acme\\\\Widget\\\\Model\\\\Widget'}) RETURN count(*) AS c"
      )
    ).toBe(1);
  });

  it("records the virtualType node and its EXTENDS edge", async () => {
    expect(
      await searchScalar(
        "MATCH (:PHPClass {id: 'acmeVirtualWidget'})-[:EXTENDS]->(:PHPClass {id: 'Acme\\\\Widget\\\\Model\\\\Widget'}) RETURN count(*) AS c"
      )
    ).toBe(1);
  });

  it("records the events.xml observer edge", async () => {
    expect(
      await searchScalar(
        "MATCH (:PHPClass {id: 'Acme\\\\Widget\\\\Model\\\\Widget'})-[:OBSERVES]->(:Event {id: 'acme_widget_saved'}) RETURN count(*) AS c"
      )
    ).toBe(1);
  });

  it("records the crontab.xml scheduled-in edge to its group", async () => {
    expect(
      await searchScalar(
        "MATCH (:PHPMethod {id: 'Acme\\\\Widget\\\\Model\\\\Widget::withParent'})-[:SCHEDULED_IN]->(:CronGroup {id: 'acme'}) RETURN count(*) AS c"
      )
    ).toBe(1);
  });
});
