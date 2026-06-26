import { describe, expect, it } from "vitest";
import { handleEventsXml } from "../../../../src/modules/processing/magento-xml/handlers/events-xml";
import { parseXml } from "../../../../src/modules/processing/magento-xml/parse-xml";

function records(xml: string) {
  return handleEventsXml("Vendor/Module/etc/events.xml", "global", parseXml(xml));
}

describe("handleEventsXml", () => {
  it("creates an Event node and OBSERVES edges for each observer", () => {
    const { nodes, relationships } = records(
      '<config><event name="catalog_product_save_after">' +
        '<observer name="obs_a" instance="Acme\\Observer\\Foo"/>' +
        '<observer name="obs_b" instance="Acme\\Observer\\Bar" disabled="true"/>' +
        '</event></config>'
    );

    const event = nodes.find((entry) => entry.id === "catalog_product_save_after");
    expect(event?.label).toBe("Event");
    expect(event?.fields.kind).toBe("event");

    expect(relationships).toHaveLength(2);
    const foo = relationships.find((edge) => edge.fromId === "Acme\\Observer\\Foo");
    const bar = relationships.find((edge) => edge.fromId === "Acme\\Observer\\Bar");

    expect(foo?.type).toBe("OBSERVES");
    expect(foo?.toId).toBe("catalog_product_save_after");
    expect(foo?.fields.disabled).toBe(false);
    expect(bar?.fields.disabled).toBe(true);
  });

  it("skips an observer with no instance", () => {
    const { relationships } = records(
      '<config><event name="some_event"><observer name="broken"/></event></config>'
    );
    expect(relationships).toHaveLength(0);
  });
});
